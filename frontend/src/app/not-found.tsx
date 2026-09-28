import type { Metadata } from 'next';
import { CalendarPlus, Home, Search, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Không tìm thấy trang | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
};

const SUGGESTIONS = [
  { href: '/clinic/departments', icon: Stethoscope, label: 'Chuyên khoa khám chữa bệnh' },
  { href: '/clinic/doctors', icon: Search, label: 'Tìm bác sĩ' },
  { href: '/guest-booking', icon: CalendarPlus, label: 'Đặt lịch khám' },
];

export default function NotFound() {
  return (
    <PatientSiteShell>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center">
        <span className="text-7xl font-black text-primary/20 sm:text-8xl">404</span>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">Không tìm thấy trang bạn yêu cầu</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Trang bạn tìm có thể đã bị xóa, đổi tên hoặc không tồn tại. Vui lòng quay lại trang chủ hoặc thử một trong
          các mục dưới đây.
        </p>

        <Link
          href="/clinic"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-transform hover:scale-105"
        >
          <Home className="h-4 w-4" />
          Về trang chủ
        </Link>

        <div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
          {SUGGESTIONS.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <Card className="flex flex-col items-center gap-2 p-4 transition-shadow hover:shadow-md">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </PatientSiteShell>
  );
}
