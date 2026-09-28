'use client';

import { useMemo, useRef } from 'react';
import {
  Briefcase,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Phone,
  Stethoscope,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { useAuth } from '@/hooks/use-auth';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { usePublicDoctors } from '@/hooks/use-public-doctors';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';

// Concrete, checkable statements only (docs/design.md 4.5 rule 5) — no
// "hiện đại/chuyên nghiệp/tận tâm/toàn diện/uy tín" filler.
const HIGHLIGHTS = [
  'Gửi yêu cầu đặt lịch khám trực tuyến bất kỳ lúc nào, không cần gọi điện chờ tổng đài',
  'Tra cứu kết quả xét nghiệm và đơn thuốc ngay trên hệ thống, không cần quay lại phòng khám để lấy kết quả',
  '10 chuyên khoa khám và điều trị: Nội, Ngoại, Sản, Tai Mũi Họng, Mắt, Răng Hàm Mặt cùng các chuyên khoa cận lâm sàng',
  'Bác sĩ chuyên khoa I và sau đại học trực tiếp thăm khám',
  'Phòng xét nghiệm, chẩn đoán hình ảnh và nội soi tiêu hóa ngay tại phòng khám',
  'Bảng giá dịch vụ công khai, minh bạch trên website',
];

// Full-bleed auth-banner.png photo, no text overlay — per explicit user
// request (repeated after an intervening mockup-matching revision added
// text back) the 2 CTA buttons only reveal on hover/focus, centered in the
// hero. group-focus-within keeps them reachable via keyboard Tab even
// without a visible hover state; pointer-events stay enabled while
// opacity-0 so a blind touch-tap on the button's location still works.
function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  const bookingHref = isAuthenticated ? '/book-appointment' : '/guest-booking';

  return (
    <section className="group relative overflow-hidden">
      {/* auth-banner.png is a 1920x715 (~2.69:1) wide banner photo — the
          container matches that exact ratio so object-cover shows the full
          image at its own proportions instead of cropping/shrinking it. */}
      <div className="relative w-full aspect-[1920/715]">
        <Image
          src="/auth-banner.png"
          alt="Phòng Khám Đa Khoa Âu Cơ Phú Hà"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/30 group-focus-within:bg-black/30" />
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href={bookingHref}
          >
            <CalendarPlus className="h-4 w-4" />
            Đặt Lịch Khám Ngay
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white bg-white/10 px-5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20"
            href="/clinic/services"
          >
            Tất Cả Dịch Vụ
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function ClinicPublicPage() {
  const { isAuthenticated } = useAuth();
  const hasMounted = useHasMounted();
  const showAuthenticatedUI = hasMounted && isAuthenticated;

  const { data: clinicInfo } = useClinicInfo();
  const specialties = clinicInfo?.specialties ?? [];

  // usePublicDoctors() has no pagination — this is the full doctor list,
  // used both for the "featured" strip below and to compute a real
  // per-specialty doctor count for the services grid (no fabricated
  // "20+ Bác sĩ" style numbers).
  const { data: allDoctors, isLoading: isDoctorsLoading } = usePublicDoctors();
  const doctorCountBySpecialty = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doctor of allDoctors ?? []) {
      if (!doctor.specialtyId) continue;
      counts.set(doctor.specialtyId, (counts.get(doctor.specialtyId) ?? 0) + 1);
    }
    return counts;
  }, [allDoctors]);
  // Slide/carousel shows more doctors than the old static 4-card grid did.
  const featuredDoctors = allDoctors?.slice(0, 10) ?? [];
  const doctorSliderRef = useRef<HTMLDivElement>(null);
  function scrollDoctorSlider(direction: 'prev' | 'next') {
    const el = doctorSliderRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetWidth + 24 : 280;
    el.scrollBy({ left: direction === 'next' ? cardWidth : -cardWidth, behavior: 'smooth' });
  }

  return (
    <PatientSiteShell>
      <Hero isAuthenticated={showAuthenticatedUI} />

      {/* Giới thiệu — 3-photo mosaic (real facility/procedure photos) +
          checklist. No testimonial card — no verifiable patient review
          exists in the system (docs/design.md 4.5 rule 5). */}
      <section className="mx-auto max-w-6xl p-5 py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative col-span-2 aspect-[16/10] overflow-hidden rounded-2xl shadow-card">
              <Image
                src="/facility-consultation.png"
                alt="Bác sĩ tư vấn, đo huyết áp cho bệnh nhân tại Phòng Khám Đa Khoa Âu Cơ Phú Hà"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-card">
              <Image src="/clinic-facade.png" alt="Cơ sở Phòng Khám Đa Khoa Âu Cơ Phú Hà" fill className="object-cover" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-card">
              <Image
                src="/clinic-ultrasound.png"
                alt="Siêu âm tại Phòng Khám Đa Khoa Âu Cơ Phú Hà"
                fill
                className="object-cover"
              />
            </div>
          </div>

          <div>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Giải pháp chăm sóc sức khỏe toàn diện
            </span>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Phòng Khám Đa Khoa Âu Cơ Phú Hà
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {clinicInfo?.description ||
                'Thành lập năm 1998 tại Việt Trì, là phòng khám tư nhân đa khoa đầu tiên của tỉnh Phú Thọ. Hiện tổ chức khám và điều trị theo 10 chuyên khoa, có phòng xét nghiệm, chẩn đoán hình ảnh và nội soi tiêu hóa ngay tại chỗ, phục vụ người dân Phú Thọ và các vùng lân cận.'}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {HIGHLIGHTS.map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/clinic/about"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Tìm Hiểu Thêm Về Chúng Tôi
            </Link>
          </div>
        </div>
      </section>

      {/* Dịch vụ — icon grid, real specialty name/description from
          useClinicInfo (no invented per-specialty icons/procedure lists:
          one consistent Stethoscope icon and a real computed doctor count
          since the API doesn't return a per-specialty icon or sub-service
          list). */}
      {specialties.length > 0 && (
        <section className="bg-secondary/30 px-5 py-14">
          <div className="mx-auto max-w-6xl text-center">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Dịch vụ đa dạng
            </span>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Cung Cấp Dịch Vụ Chuyên Sâu, Chất Lượng Hàng Đầu
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {specialties.slice(0, 8).map((specialty) => {
              const doctorCount = doctorCountBySpecialty.get(specialty.id) ?? 0;
              return (
                <Card
                  key={specialty.id}
                  className="flex flex-col items-center p-5 text-center transition-transform hover:-translate-y-1"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">{specialty.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {doctorCount > 0 ? `${doctorCount} bác sĩ` : 'Đang cập nhật bác sĩ'}
                  </p>
                  <Link
                    href={`/clinic/departments/${specialty.id}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform hover:translate-x-0.5"
                  >
                    Xem chi tiết →
                  </Link>
                </Card>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link href="/clinic/departments" className="text-sm font-semibold text-primary hover:underline">
              Xem tất cả chuyên khoa →
            </Link>
          </div>
        </section>
      )}

      {/* Đội ngũ bác sĩ — nền trắng như các section khác (không còn banner
          tối, tách biệt hẳn khỏi footer tối bên dưới thay vì chỉ ngăn bằng
          viền). Slide bằng nút trái/phải (scrollBy trên doctorSliderRef),
          không dựa vào cuộn chuột/chạm làm cách tương tác chính. Real doctor
          data: avatar/fullName/specialtyName/degree/yearsExperience. No
          fabricated academic titles ("PGS.TS.BS") or weekly duty schedule —
          neither field exists on the public doctor list. */}
      <section className="mx-auto max-w-6xl p-5 py-14 text-center">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Đội ngũ chuyên gia
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Đội Ngũ Bác Sĩ Chuyên Gia Giàu Kinh Nghiệm
        </h2>

        {isDoctorsLoading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Đang tải danh sách bác sĩ...</p>
        ) : !featuredDoctors.length ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chưa có thông tin bác sĩ khả dụng.</p>
        ) : (
          <div className="relative mt-8">
            {/* Prev/next nav overlaid on the slider itself, vertically
                centered — not up in the heading row. */}
            <button
              type="button"
              onClick={() => scrollDoctorSlider('prev')}
              aria-label="Xem bác sĩ trước"
              className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-white text-foreground shadow-card transition-colors hover:bg-secondary sm:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollDoctorSlider('next')}
              aria-label="Xem bác sĩ tiếp theo"
              className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-input bg-white text-foreground shadow-card transition-colors hover:bg-secondary sm:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              ref={doctorSliderRef}
              className="-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {featuredDoctors.map((doctor) => (
                <Card
                  key={doctor.id}
                  className="w-64 shrink-0 snap-start overflow-hidden transition-transform hover:-translate-y-1"
                >
                  <div
                    className="aspect-[3/4] w-full bg-muted bg-cover bg-center"
                    style={doctor.avatarUrl ? { backgroundImage: `url(${resolveAvatarUrl(doctor.avatarUrl)})` } : undefined}
                  >
                    {!doctor.avatarUrl && (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300">
                        <Stethoscope className="h-16 w-16" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-bold text-foreground">{doctor.fullName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {doctor.degree || doctor.specialtyName || 'Chưa cập nhật chuyên khoa'}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5 text-accent" />
                      {doctor.yearsExperience ?? 0} năm kinh nghiệm
                    </p>
                    <Link
                      href={`/clinic/doctors/${doctor.id}`}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-white text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Đặt khám
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href={showAuthenticatedUI ? '/book-appointment' : '/guest-booking'}
          >
            <CalendarPlus className="h-4 w-4" />
            Đặt Lịch Khám Ngay
          </Link>
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-secondary"
            href="tel:0969434729"
          >
            <Phone className="h-4 w-4" />
            Tổng đài tư vấn: 0969.434.729
          </a>
        </div>
      </section>
    </PatientSiteShell>
  );
}
