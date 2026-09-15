'use client';

import React, { useState } from 'react';
import { Bell, AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { MOCK_NOTIFICATIONS, NotificationItem } from '@/lib/mockData';
import Link from 'next/link';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      {/* Bell Button Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        title="Notifications & SLA Alerts"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {unreadCount} New
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-slate-300 hover:text-white underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 transition-colors ${
                      item.read ? 'bg-white' : 'bg-slate-50/80 font-medium'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {item.type === 'SLA_ALERT' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                        ) : item.type === 'APPROVAL_REQ' ? (
                          <Clock className="w-4 h-4 text-amber-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{item.title}</span>
                          <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{item.message}</p>

                        {item.link && (
                          <Link
                            href={item.link}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center space-x-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 pt-1"
                          >
                            <span>View Action</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No notifications available.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-2.5 text-center border-t border-slate-200">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                See all alerts & SLA notifications →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
