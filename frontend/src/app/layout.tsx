import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AppProviders } from './providers';

// "Brighter blue" token pass (2026-08-20, 3rd revision same day) calls for
// Plus Jakarta Sans sitewide — supersedes the prior Be Vietnam Pro spec.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description: 'Hệ thống quản lý phòng khám Đa Khoa Âu Cơ Phú Hà',
  icons: {
    icon: '/logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={plusJakartaSans.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
