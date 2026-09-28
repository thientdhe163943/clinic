import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatRequestDto, AiChatResponseDto } from '../../dtos/ai/ai-chat.dto';
import { SuggestedSlotDto } from '../../dtos/appointments/suggest-slots-response.dto';
import { AI_CHAT_LOG_PORT, AiChatLogPort } from '../../ports/ai-chat-log.port';
import { AI_PROVIDER_PORT, AiMessage, AiProviderPort } from '../../ports/ai-provider.port';
import { ListSpecialtiesUseCase } from '../doctor-specialties/list-specialties.use-case';
import { SuggestAppointmentSlotsUseCase } from '../appointments/suggest-appointment-slots.use-case';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';
import { nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';

export interface ChatWithAiInput extends AiChatRequestDto {
  userId: string | null;
}

// Feature 83 business rule: only the last few turns are resent as context —
// keeps the prompt small and the free-tier Groq request fast; the widget
// itself keeps the full local history for display.
const AI_HISTORY_TURNS = 6;

const DISCLAIMER = 'Chatbot không thay thế tư vấn/chẩn đoán của bác sĩ. Vui lòng đặt lịch khám để được tư vấn chính xác.';

// Marker the model is instructed to append on its own last line when the
// patient's message implies they want to see/book an available slot — parsed
// out and never shown to the user; everything after it is deterministically
// validated before it's ever used (see resolveSlotRequest), same "don't trust
// the model's structured output" rule as suggestedSpecialties below.
const SLOT_REQUEST_PATTERN = /\n?SLOT_REQUEST:\s*(\{.*\})\s*$/s;

interface RawSlotRequest {
  specialty?: string;
  date?: string;
  preferredTime?: string;
}

// Feature 88 marker — analogous to SLOT_REQUEST: the model only signals
// intent + search text, it never states drug facts itself in the visible
// reply. The backend looks the query up in the clinic's real Medicine table
// (never trusts the model's own medical knowledge as authoritative) and only
// falls back to general AI knowledge — clearly caveated — when nothing
// matches, per Feature 88 business rule.
const MEDICINE_LOOKUP_PATTERN = /\n?MEDICINE_LOOKUP:\s*(\{.*\})\s*$/s;

interface RawMedicineLookup {
  query?: string;
}

@Injectable()
export class ChatWithAiUseCase {
  private readonly logger = new Logger(ChatWithAiUseCase.name);

  constructor(
    @Inject(AI_PROVIDER_PORT) private readonly aiProvider: AiProviderPort,
    @Inject(AI_CHAT_LOG_PORT) private readonly chatLog: AiChatLogPort,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository,
    private readonly listSpecialtiesUseCase: ListSpecialtiesUseCase,
    private readonly suggestAppointmentSlotsUseCase: SuggestAppointmentSlotsUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: ChatWithAiInput): Promise<AiChatResponseDto> {
    await this.chatLog.write({
      userId: input.userId,
      sessionId: input.sessionId,
      role: 'USER',
      message: input.message,
    });

    // Feature 83/86/87 business rules: suggestions/answers must be grounded
    // in the clinic's real specialty and service catalog — never invented.
    const [specialties, { items: services }] = await Promise.all([
      this.listSpecialtiesUseCase.execute(),
      this.serviceRepository.findMany({ page: 1, limit: 100 }),
    ]);

    const today = nowAsClinicNaiveUtc();
    const todayLabel = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

    const systemPrompt = this.buildSystemPrompt(specialties, services, todayLabel);
    const historyMessages: AiMessage[] = (input.history ?? []).slice(-AI_HISTORY_TURNS).map((turn) => ({
      role: turn.from === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));

    const rawReply = await this.aiProvider.chat([
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: input.message },
    ]);

    const slotRequestMatch = SLOT_REQUEST_PATTERN.exec(rawReply);
    const medicineLookupMatch = slotRequestMatch ? null : MEDICINE_LOOKUP_PATTERN.exec(rawReply);
    const markerMatch = slotRequestMatch ?? medicineLookupMatch;
    let reply = markerMatch ? rawReply.slice(0, markerMatch.index).trim() : rawReply;

    // Deterministic grounding (Feature 87 business rule: "gợi ý dựa trên
    // danh sách chuyên khoa thực tế có tại phòng khám") — never trust the
    // model to emit structured output; only surface a specialty as
    // "suggested" if it's both a real catalog entry AND actually named in
    // the reply text.
    const suggestedSpecialties = specialties.filter((specialty) =>
      reply.toLowerCase().includes(specialty.name.toLowerCase()),
    );

    const suggestedSlots = slotRequestMatch
      ? await this.resolveSlotRequest(slotRequestMatch[1], specialties, services)
      : [];

    if (medicineLookupMatch) {
      const medicineAnswer = await this.resolveMedicineLookup(medicineLookupMatch[1]);
      if (medicineAnswer) reply = `${reply}\n\n${medicineAnswer}`.trim();
    }

    await this.chatLog.write({
      userId: input.userId,
      sessionId: input.sessionId,
      role: 'ASSISTANT',
      message: reply,
      suggestedSpecialtyId: suggestedSpecialties[0]?.id ?? null,
    });

    return {
      reply,
      suggestedSpecialties: suggestedSpecialties.map((specialty) => ({ id: specialty.id, name: specialty.name })),
      suggestedSlots,
      disclaimer: DISCLAIMER,
    };
  }

  // Best-effort: the model's SLOT_REQUEST block is free-form JSON it wrote
  // itself — every field is re-validated against real data (specialty name
  // must match a real specialty, date must parse and not be in the past)
  // before SuggestAppointmentSlotsUseCase (the actual scoring algorithm) is
  // ever called. Any failure here just means no slots are attached — it
  // never breaks the normal chat reply.
  private async resolveSlotRequest(
    jsonBlock: string,
    specialties: { id: string; name: string }[],
    services: { id: string; name: string; specialtyId: string | null }[],
  ): Promise<SuggestedSlotDto[]> {
    try {
      const parsed = JSON.parse(jsonBlock) as RawSlotRequest;
      if (!parsed.specialty || !parsed.date) return [];

      const specialty = specialties.find((s) => s.name.toLowerCase() === parsed.specialty!.toLowerCase().trim());
      if (!specialty) return [];

      const service = services.find((s) => s.specialtyId === specialty.id);
      if (!service) return [];

      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return [];
      const date = new Date(parsed.date);
      if (Number.isNaN(date.getTime())) return [];
      if (date.getTime() < nowAsClinicNaiveUtc().setUTCHours(0, 0, 0, 0)) return [];

      const preferredTime =
        parsed.preferredTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.preferredTime)
          ? parsed.preferredTime
          : undefined;

      return await this.suggestAppointmentSlotsUseCase.execute({ serviceId: service.id, date, preferredTime });
    } catch (error) {
      this.logger.warn(`Skipped slot request: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // Feature 88: "Ưu tiên tra cứu trong database thuốc nội bộ trước, fallback
  // sang AI knowledge nếu không tìm thấy" — DB lookup result is rendered
  // deterministically from real fields (never re-narrated by the model, so
  // it can't drift from what's actually in the system). Only when nothing
  // matches does the model get asked, in a separate call, for a clearly
  // caveated general-knowledge answer.
  private async resolveMedicineLookup(jsonBlock: string): Promise<string | null> {
    try {
      const parsed = JSON.parse(jsonBlock) as RawMedicineLookup;
      const query = parsed.query?.trim();
      if (!query) return null;

      const { items } = await this.medicineRepository.findMany({ search: query, onlyActive: true, page: 1, limit: 1 });
      const medicine = items[0];

      if (medicine) {
        const lines = [
          `📋 Thông tin từ hệ thống phòng khám — ${medicine.name} (${medicine.activeIngredient}):`,
          `- Dạng bào chế: ${medicine.dosageForm}, đơn vị: ${medicine.unit}`,
          medicine.description ? `- Công dụng: ${medicine.description}` : null,
          medicine.contraindications ? `- Chống chỉ định/lưu ý: ${medicine.contraindications}` : null,
          'Liều dùng cụ thể cần theo chỉ định của bác sĩ/dược sĩ, không tự ý sử dụng.',
        ].filter((line): line is string => !!line);
        return lines.join('\n');
      }

      return await this.answerMedicineFromGeneralKnowledge(query);
    } catch (error) {
      this.logger.warn(`Skipped medicine lookup: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async answerMedicineFromGeneralKnowledge(query: string): Promise<string | null> {
    try {
      const reply = await this.aiProvider.chat([
        {
          role: 'system',
          content:
            'Thuốc/hoạt chất được hỏi không có trong hệ thống của phòng khám. Hãy trả lời ngắn gọn (tối đa 4 câu) ' +
            'bằng kiến thức chung: công dụng phổ biến và lưu ý/chống chỉ định thường gặp — KHÔNG chỉ định liều dùng ' +
            'cụ thể. Bắt đầu câu trả lời bằng đúng câu: "Thuốc này chưa có trong hệ thống của phòng khám, đây là thông tin tham khảo chung:"',
        },
        { role: 'user', content: query },
      ]);
      return reply.trim();
    } catch (error) {
      this.logger.warn(`Medicine fallback failed: ${error instanceof Error ? error.message : String(error)}`);
      return 'Thuốc này chưa có trong hệ thống của phòng khám. Vui lòng hỏi trực tiếp dược sĩ/bác sĩ để được tư vấn chính xác.';
    }
  }

  private buildSystemPrompt(
    specialties: { id: string; name: string; description: string | null }[],
    services: { name: string; price: number }[],
    todayLabel: string,
  ): string {
    const clinicName = this.configService.get<string>('clinic.name') ?? '';
    const clinicAddress = this.configService.get<string>('clinic.address') ?? '';
    const clinicPhone = this.configService.get<string>('clinic.phone') ?? '';
    const operatingHours = this.configService.get<string>('clinic.operatingHours') ?? '';

    const specialtyList = specialties
      .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ''}`)
      .join('\n');
    const serviceList = services.map((s) => `- ${s.name} (${s.price.toLocaleString('vi-VN')}đ)`).join('\n');

    return `Bạn là trợ lý AI của phòng khám "${clinicName}", địa chỉ ${clinicAddress}, điện thoại ${clinicPhone}, giờ làm việc: ${operatingHours}. Hôm nay là ngày ${todayLabel}.

Nhiệm vụ của bạn:
1. Tư vấn sơ bộ triệu chứng: nêu 1-2 nguyên nhân THÔNG THƯỜNG, phổ biến có thể liên quan (ví dụ "có thể liên quan đến cảm cúm thông thường/viêm họng"), và gợi ý CHUYÊN KHOA phù hợp để khám.
2. Gợi ý 2-3 biện pháp chăm sóc tại nhà AN TOÀN, không cần kê đơn để bệnh nhân đỡ khó chịu trong lúc chờ khám (nghỉ ngơi, uống đủ nước, chườm ấm/lạnh, súc miệng nước muối, hạ sốt bằng paracetamol theo liều thông thường trên bao bì nếu sốt nhẹ...). KHÔNG gợi ý thuốc kê đơn, kháng sinh, hoặc chỉ định liều lượng thuốc cụ thể ngoài paracetamol liều phổ thông.
3. Trả lời câu hỏi về dịch vụ, giá khám, giờ làm việc, quy trình khám của phòng khám.
4. Hướng dẫn quy trình khám: Đăng ký/đặt lịch → Tiếp đón & lấy số thứ tự → Khám lâm sàng → Cận lâm sàng (nếu được chỉ định) → Nhận kết quả & tư vấn → Thanh toán.
5. Khi bệnh nhân muốn xem/đặt khung giờ khám còn trống (vd "gợi ý giờ khám giúp tôi", "tôi muốn khám chiều mai", "có giờ nào trống thứ 3 tuần sau không"): hệ thống sẽ TỰ ĐỘNG tìm và hiển thị các khung giờ trống ngay bên dưới câu trả lời của bạn — vì vậy câu trả lời của bạn chỉ cần nói ngắn gọn kiểu "Đây là một số khung giờ phù hợp bạn có thể chọn:" hoặc tương tự, KHÔNG bảo bệnh nhân gọi lễ tân hay tự đặt lịch thủ công trong trường hợp này. Sau đó thêm đúng 1 dòng CUỐI CÙNG theo định dạng chính xác sau (không thêm chữ nào khác trên dòng này):
SLOT_REQUEST:{"specialty":"<đúng tên 1 chuyên khoa trong danh sách bên dưới>","date":"YYYY-MM-DD","preferredTime":"HH:MM hoặc bỏ trống nếu không rõ"}
Tự suy ra ngày YYYY-MM-DD từ hôm nay (${todayLabel}) và điều bệnh nhân nói (vd "mai", "thứ 3 tuần sau"). Chỉ thêm dòng này khi bệnh nhân THỰC SỰ muốn xem giờ trống — không thêm nếu chỉ hỏi thông tin chung.
6. Khi bệnh nhân hỏi về một loại THUỐC hoặc HOẠT CHẤT cụ thể (vd "thuốc Paracetamol dùng để làm gì", "Amoxicillin có chống chỉ định gì không"): KHÔNG tự trả lời công dụng/chống chỉ định bằng kiến thức của bạn — hệ thống sẽ TỰ ĐỘNG tra cứu trong cơ sở dữ liệu thuốc thật của phòng khám và đính kèm ngay bên dưới câu trả lời. Câu trả lời của bạn chỉ cần một câu ngắn dẫn dắt kiểu "Để tôi tra cứu thông tin thuốc này giúp bạn:". Sau đó thêm đúng 1 dòng CUỐI CÙNG theo định dạng chính xác sau (không thêm chữ nào khác trên dòng này, và không dùng chung với SLOT_REQUEST):
MEDICINE_LOOKUP:{"query":"<tên thuốc hoặc hoạt chất bệnh nhân hỏi>"}

Chỉ được nhắc tới các chuyên khoa và dịch vụ có trong danh sách dưới đây — không tự bịa thêm:

Danh sách chuyên khoa:
${specialtyList || '(chưa có dữ liệu)'}

Danh sách dịch vụ:
${serviceList || '(chưa có dữ liệu)'}

Quy tắc bắt buộc:
- KHÔNG khẳng định chắc chắn bệnh nhân đang mắc bệnh gì — chỉ nêu khả năng, luôn kèm câu khuyên đến khám trực tiếp để bác sĩ chẩn đoán chính xác.
- Nếu triệu chứng có dấu hiệu nguy hiểm (đau ngực dữ dội, khó thở, sốt rất cao, chảy máu nhiều, lú lẫn, co giật...), khuyên đến cơ sở y tế/cấp cứu NGAY LẬP TỨC thay vì chỉ gợi ý đặt lịch thường.
- Không kê đơn thuốc, không chỉ định kháng sinh hay thuốc kê đơn dưới bất kỳ hình thức nào.
- Nếu không chắc chắn hoặc câu hỏi ngoài phạm vi phòng khám, hướng dẫn liên hệ lễ tân qua số điện thoại trên.
- Trả lời ngắn gọn, thân thiện, bằng tiếng Việt, không dùng markdown phức tạp.`;
  }
}
