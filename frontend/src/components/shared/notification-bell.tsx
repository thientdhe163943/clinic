'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationEvents } from '@/hooks/use-notification-events';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationList } from '@/hooks/use-notifications';
import type { AppNotification } from '@/types/notifications';

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// Hộp thông báo trong app — bổ sung 2026-07-09 (ban đầu chỉ cho bệnh nhân)
// vì kênh email/SMS không đảm bảo người dùng xem kịp lúc; nay dùng chung cho
// cả nhân viên (DashboardShell) lẫn bệnh nhân (PatientSiteShell). Realtime
// push via `notification:created` (see
// useNotificationEvents) now drives live updates; useNotificationList()
// keeps a slow safety-net poll in case the socket silently drops.
export function NotificationBell() {
  useNotificationEvents();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotificationList();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleItemClick = (item: AppNotification) => {
    if (!item.isRead) markRead.mutate(item.id);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Thông báo"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-lg border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Thông báo</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && <p className="p-4 text-center text-sm text-muted-foreground">Đang tải...</p>}
            {!isLoading && items.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`block w-full border-b border-border px-3 py-3 text-left text-sm last:border-0 hover:bg-secondary ${
                  item.isRead ? 'bg-white' : 'bg-primary/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!item.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                  <div className={item.isRead ? 'flex-1' : 'flex-1 pl-0'}>
                    {item.subject && <p className="font-medium text-foreground">{item.subject}</p>}
                    <p className="text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
