'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications';

/* ── NotificationBell ───────────────────────────────────────────────── */

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, isLoading } = useNotifications({
    limit: 10,
    pollingInterval: 30_000,
  });
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  /* Close dropdown on outside click */
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  /* Handle clicking a single notification */
  const handleNotificationClick = (notification: {
    id: string;
    isRead: boolean;
    link: string | null;
  }) => {
    if (!notification.isRead) {
      markRead.mutate({ ids: [notification.id] });
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  /* Handle mark all as read */
  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="focus-ring relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="animate-fade-in absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-white shadow-lg"
          role="menu"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-blue hover:text-blue-hover disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'flex w-full gap-3 border-b border-border/50 px-4 py-3 text-left last:border-0 hover:bg-muted/50',
                    !notif.isRead && 'bg-blue-light/30'
                  )}
                  role="menuitem"
                >
                  {/* Unread indicator */}
                  <div
                    className={cn(
                      'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                      notif.isRead ? 'bg-transparent' : 'bg-blue'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {notif.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {notif.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatRelativeTime(notif.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border p-2">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/notifications');
                }}
                className="block w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-blue hover:bg-blue-light"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

export default NotificationBell;
