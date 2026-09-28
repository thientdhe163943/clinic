'use client';

import { CalendarPlus, ChevronDown, Clock, MapPin, Menu, Phone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { AiChatWidget } from '@/components/shared/ai-chat-widget';
import { Breadcrumb, type BreadcrumbItem } from '@/components/shared/breadcrumb';
import { FloatingActions } from '@/components/shared/floating-actions';
import { MobileNavDrawer, type NavGroup } from '@/components/shared/mobile-nav-drawer';
import { NotificationBell } from '@/components/shared/notification-bell';
import { PublicSearch } from '@/components/shared/public-search';
import { UserMenu } from '@/components/shared/user-menu';
import { useAuth } from '@/hooks/use-auth';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { useHasMounted } from '@/hooks/use-has-mounted';

const NAV_GROUPS: NavGroup[] = [
  { label: 'Trang chủ', href: '/clinic' },
  {
    label: 'Chuyên khoa',
    href: '/clinic/departments',
  },
  { label: 'Bác sĩ', href: '/clinic/doctors' },
  { label: 'Dịch vụ', href: '/clinic/services' },
  { label: 'Giới thiệu', href: '/clinic/about' },
];

export function PatientSiteShell({
  children,
  breadcrumb,
}: {
  children: ReactNode;
  breadcrumb?: BreadcrumbItem[];
}) {
  const { user, isAuthenticated, logout } = useAuth();
  // `isAuthenticated` comes from a client-persisted (localStorage) store, so
  // on the server (and the very first client paint) it is always `false` —
  // gating on mount avoids a server/client markup mismatch that would
  // otherwise make React discard and rebuild this subtree, briefly leaving
  // the login/register links in place (and their click handlers detached)
  // even for an already-authenticated user.
  const hasMounted = useHasMounted();
  const showAuthenticatedUI = hasMounted && isAuthenticated;
  const { data: clinicInfo } = useClinicInfo();
  const specialties = clinicInfo?.specialties ?? [];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // "/clinic" needs an exact match — every other public route also starts
  // with "/clinic/..." and would otherwise light up "Trang chủ" too.
  const pathname = usePathname();
  function isNavActive(href?: string): boolean {
    if (!href) return false;
    return href === '/clinic' ? pathname === '/clinic' : pathname.startsWith(href);
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="bg-primary px-5 py-2 text-xs text-primary-foreground sm:text-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Hotline: 0969.434.729
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <MapPin className="h-3.5 w-3.5" />
              Số 38, Minh Lang, Việt Trì, Phú Thọ
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            07:00 - 17:30 (Tất cả các ngày)
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        {/* flex-nowrap (not flex-wrap) — the whole point of the breakpoints
            below is to keep this row's total width under control at every
            viewport, since wrapping onto a 2nd line was the reported bug.
            max-w-7xl (wider than the rest of the page's max-w-6xl) gives
            just enough room for logo + nav + the full labeled cluster to
            coexist right at the xl breakpoint where both reveal together —
            at max-w-6xl this combination was ~50px too wide and wrapped. */}
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-2">
          <Link href="/clinic" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
              <Image
                src="/logo.jpg"
                alt="Phòng Khám Đa Khoa Âu Cơ Phú Hà"
                width={48}
                height={48}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-base font-bold leading-tight text-foreground sm:text-lg">Phòng Khám Đa Khoa</p>
              <p className="text-base font-bold leading-tight text-primary sm:text-lg">Âu Cơ Phú Hà</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium text-foreground xl:flex">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="group relative">
                <Link
                  href={group.href ?? '#'}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-3 py-2 transition-colors hover:bg-primary/10 hover:text-primary',
                    isNavActive(group.href) && 'bg-primary/10 font-semibold text-primary',
                  )}
                >
                  {group.label}
                  {group.children && <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />}
                </Link>

                {group.children && (
                  <div className="invisible absolute left-0 top-full z-50 w-56 rounded-lg border border-border bg-white p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
                    {group.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}

                {group.label === 'Chuyên khoa' && specialties.length > 0 && (
                  <div className="invisible absolute left-0 top-full z-50 grid w-[560px] grid-cols-2 gap-1 rounded-lg border border-border bg-white p-3 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
                    {specialties.slice(0, 10).map((specialty) => (
                      <Link
                        key={specialty.id}
                        href={`/clinic/departments/${specialty.id}`}
                        className="rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        {specialty.name}
                      </Link>
                    ))}
                    <Link
                      href="/clinic/departments"
                      className="col-span-2 mt-1 rounded-md border-t border-border px-3 pt-3 text-sm font-semibold text-primary hover:underline"
                    >
                      Xem tất cả chuyên khoa →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex flex-nowrap items-center gap-2">
            {/* Matches nav's own xl breakpoint below — revealing these
                labels earlier (e.g. at lg) left a band just under xl where
                the full-width cluster and the about-to-appear nav would
                have overflowed the header at the same time. */}
            <div className="hidden xl:block">
              <PublicSearch />
            </div>
            {showAuthenticatedUI ? (
              <>
                <Link
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  href="/book-appointment"
                >
                  <CalendarPlus className="h-4 w-4" />
                  <span className="hidden xl:inline">Đặt Lịch Khám</span>
                </Link>
                <NotificationBell />
                <UserMenu fullName={user?.fullName} onLogout={logout} />
              </>
            ) : (
              <>
                <Link
                  className="hidden h-10 items-center justify-center rounded-md border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-secondary sm:inline-flex"
                  href="/login"
                >
                  Đăng nhập
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  href="/guest-booking"
                >
                  Đặt lịch khám
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Mở menu"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        groups={NAV_GROUPS}
        specialties={specialties}
      />

      <div className="flex-1">{children}</div>

      <footer id="lien-he" className="bg-tertiary px-5 py-10 text-tertiary-foreground/80">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-bold text-tertiary-foreground">Phòng Khám Đa Khoa Âu Cơ Phú Hà</p>
            <p className="mt-1 text-sm font-medium text-tertiary-foreground/90">
              Chăm sóc tận tâm - Nâng tầm sức khỏe
            </p>
            <p className="mt-2 text-sm text-tertiary-foreground/70">
              Thành lập từ năm 1998 — cơ sở y tế tư nhân đầu tiên tại Phú Thọ tổ chức khám chữa bệnh theo mô hình
              phòng khám đa khoa hiện đại.
            </p>
          </div>

          <div className="text-sm text-tertiary-foreground/70">
            <p className="mb-3 text-sm font-semibold text-tertiary-foreground">Liên kết nhanh</p>
            <ul className="space-y-2">
              <li>
                <Link className="hover:text-tertiary-foreground" href="/clinic/about">
                  Giới thiệu
                </Link>
              </li>
              <li>
                <Link className="hover:text-tertiary-foreground" href="/clinic/services">
                  Bảng giá dịch vụ
                </Link>
              </li>
              <li>
                <Link className="hover:text-tertiary-foreground" href="/guest-booking">
                  Đặt lịch khám
                </Link>
              </li>
              <li>
                <Link className="hover:text-tertiary-foreground" href="/results">
                  Tra cứu kết quả
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm text-tertiary-foreground/70">
            <p className="mb-3 text-sm font-semibold text-tertiary-foreground">Chuyên khoa</p>
            <ul className="space-y-2">
              {specialties.slice(0, 4).map((specialty) => (
                <li key={specialty.id}>
                  <Link className="hover:text-tertiary-foreground" href={`/clinic/departments/${specialty.id}`}>
                    {specialty.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link className="font-medium text-tertiary-foreground/90 hover:text-tertiary-foreground" href="/clinic/departments">
                  Xem tất cả chuyên khoa →
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm text-tertiary-foreground/70">
            <p className="mb-3 text-sm font-semibold text-tertiary-foreground">Thông tin liên hệ</p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              Số 38, Minh Lang, Việt Trì, Phú Thọ
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              Hotline: 0969.434.729 — CSKH: (0210) 3.845.618
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              07:30 - 18:30, tất cả các ngày trong tuần
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-2 border-t border-tertiary-foreground/10 pt-6 text-xs text-tertiary-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Phòng Khám Đa Khoa Âu Cơ Phú Hà. Đã đăng ký bản quyền.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="hover:text-tertiary-foreground/80" href="/clinic/privacy-policy">
              Chính sách bảo mật
            </Link>
            <Link className="hover:text-tertiary-foreground/80" href="/clinic/terms">
              Điều khoản sử dụng
            </Link>
          </div>
        </div>
      </footer>

      <FloatingActions />
      <AiChatWidget />
    </main>
  );
}
