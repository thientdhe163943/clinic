import { Inject, Injectable, Logger } from '@nestjs/common';
import { SuggestedSlotDto } from '../../dtos/appointments/suggest-slots-response.dto';
import { AI_PROVIDER_PORT, AiProviderPort } from '../../ports/ai-provider.port';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { FindAvailableDoctorsUseCase, toDateOnly } from './find-available-doctors.use-case';

export interface SuggestAppointmentSlotsInput {
  serviceId: string;
  date: Date;
  preferredTime?: string;
}

const TOP_N = 3;
// Normalization window for the time-proximity score: a slot 4h+ away from the
// preferred time scores 0 on this dimension, same as if no preference was given.
const TIME_SCORE_WINDOW_MINUTES = 240;
const TIME_WEIGHT = 0.6;
const WORKLOAD_WEIGHT = 0.4;

interface CandidateSlot {
  time: string;
  datetime: string;
  roomId: string | null;
  roomName: string | null;
}

interface RankedCandidate {
  doctorId: string;
  doctorName: string;
  roomId: string | null;
  roomName: string | null;
  time: string;
  datetime: string;
  score: number;
  bookedCount: number;
  totalSlots: number;
}

function parseHHMM(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

// Business rule: this feature is patient-facing only — the AI explanation is
// a "nice to have" on top of a deterministic score, so if Groq is unavailable
// the suggestions still return with plain, factual reasons (never blocked by
// AI availability).
@Injectable()
export class SuggestAppointmentSlotsUseCase {
  private readonly logger = new Logger(SuggestAppointmentSlotsUseCase.name);

  constructor(
    private readonly findAvailableDoctorsUseCase: FindAvailableDoctorsUseCase,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(AI_PROVIDER_PORT) private readonly aiProvider: AiProviderPort,
  ) {}

  async execute(input: SuggestAppointmentSlotsInput): Promise<SuggestedSlotDto[]> {
    const doctors = await this.findAvailableDoctorsUseCase.execute({
      serviceId: input.serviceId,
      date: input.date,
    });
    if (doctors.length === 0) return [];

    const day = toDateOnly(input.date);
    const preferredMinutes = input.preferredTime ? parseHHMM(input.preferredTime) : null;

    const candidates = await Promise.all(
      doctors.map((doctor) => this.scoreDoctorBestSlot(doctor, day, preferredMinutes)),
    );

    const ranked = candidates
      .filter((c): c is RankedCandidate => c !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);

    const withReasons: SuggestedSlotDto[] = ranked.map((c) => ({
      ...c,
      serviceId: input.serviceId,
      reason: this.buildDeterministicReason(c, preferredMinutes),
    }));

    return this.polishReasonsWithAi(withReasons, input.preferredTime);
  }

  private async scoreDoctorBestSlot(
    doctor: Awaited<ReturnType<FindAvailableDoctorsUseCase['execute']>>[number],
    day: Date,
    preferredMinutes: number | null,
  ): Promise<RankedCandidate | null> {
    const availableSlots: CandidateSlot[] = doctor.shifts.flatMap((shift) =>
      shift.slots
        .filter((slot) => slot.available)
        .map((slot) => ({ time: slot.time, datetime: slot.datetime, roomId: shift.roomId, roomName: shift.roomName })),
    );
    if (availableSlots.length === 0) return null;

    const totalSlots = doctor.shifts.reduce((sum, shift) => sum + shift.slots.length, 0);

    const { items } = await this.appointmentRepository.findMany({
      doctorId: doctor.doctorId,
      date: day,
      page: 1,
      limit: 200,
    });
    const bookedCount = items.filter((item) => item.appointment.status !== AppointmentStatus.CANCELLED).length;
    // Fewer booked appointments relative to capacity -> higher workload score.
    const workloadScore = totalSlots > 0 ? 1 - bookedCount / totalSlots : 0.5;

    let best: { slot: CandidateSlot; score: number } | null = null;
    for (const slot of availableSlots) {
      const slotMinutes = parseHHMM(slot.time);
      const timeScore =
        preferredMinutes !== null
          ? Math.max(0, 1 - Math.abs(slotMinutes - preferredMinutes) / TIME_SCORE_WINDOW_MINUTES)
          : null;
      const score = timeScore !== null ? TIME_WEIGHT * timeScore + WORKLOAD_WEIGHT * workloadScore : workloadScore;
      if (!best || score > best.score) best = { slot, score };
    }
    if (!best) return null;

    return {
      doctorId: doctor.doctorId,
      doctorName: doctor.doctorName,
      roomId: best.slot.roomId,
      roomName: best.slot.roomName,
      time: best.slot.time,
      datetime: best.slot.datetime,
      score: Math.round(best.score * 100) / 100,
      bookedCount,
      totalSlots,
    };
  }

  private buildDeterministicReason(candidate: RankedCandidate, preferredMinutes: number | null): string {
    const availableRatio = candidate.totalSlots > 0
      ? Math.round(((candidate.totalSlots - candidate.bookedCount) / candidate.totalSlots) * 100)
      : 0;
    const workloadNote = `Bác sĩ hiện có ${candidate.bookedCount} lịch hẹn trong ngày (còn trống khoảng ${availableRatio}% khung giờ).`;

    if (preferredMinutes === null) return workloadNote;

    const slotMinutes = parseHHMM(candidate.time);
    const diffMinutes = Math.abs(slotMinutes - preferredMinutes);
    const timeNote = diffMinutes === 0
      ? `Khung giờ ${candidate.time} đúng với giờ bạn mong muốn.`
      : `Khung giờ ${candidate.time} lệch ${diffMinutes} phút so với giờ bạn mong muốn.`;

    return `${timeNote} ${workloadNote}`;
  }

  // Best-effort: rewrite the deterministic reasons into more natural
  // sentences via the AI provider. Never trusts the model's numbers — it only
  // rephrases facts already computed above — and falls back silently to the
  // deterministic text if the AI call fails or returns something unparsable.
  private async polishReasonsWithAi(
    slots: SuggestedSlotDto[],
    preferredTime?: string,
  ): Promise<SuggestedSlotDto[]> {
    if (slots.length === 0) return slots;

    const factsList = slots
      .map((s, i) => `${i + 1}. Bác sĩ ${s.doctorName}, khung giờ ${s.time}, ${s.reason}`)
      .join('\n');

    try {
      const reply = await this.aiProvider.chat([
        {
          role: 'system',
          content:
            'Bạn viết lại các gợi ý lịch khám sau thành câu văn tự nhiên, thân thiện, ngắn gọn (tối đa 30 từ/câu), ' +
            'giữ nguyên toàn bộ số liệu đã cho (không được đổi giờ, không đổi số liệu). ' +
            `Trả lời đúng ${slots.length} dòng, mỗi dòng bắt đầu bằng số thứ tự và dấu chấm (vd "1. ..."), không thêm lời dẫn hay ghi chú nào khác.`,
        },
        {
          role: 'user',
          content: `${preferredTime ? `Giờ bệnh nhân mong muốn: ${preferredTime}.\n` : ''}${factsList}`,
        },
      ]);

      const lines = [...reply.matchAll(/^\s*\d+\.\s*(.+)$/gm)].map((m) => m[1].trim());
      if (lines.length !== slots.length) return slots;

      return slots.map((slot, i) => ({ ...slot, reason: lines[i] }));
    } catch (error) {
      this.logger.warn(`AI reason polishing skipped: ${error instanceof Error ? error.message : String(error)}`);
      return slots;
    }
  }
}
