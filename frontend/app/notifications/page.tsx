'use client';

import React, { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api/client';
import { Bell, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.getAll();
      if (res.error) {
        setError(`Notifications API Error: ${res.error}`);
        setLoading(false);
        return;
      }
      setNotifications(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    fetchNotifications();
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span className="font-medium text-sm">Loading SLA Notifications from NestJS Backend...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2 max-w-4xl mx-auto">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Notifications API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">National SLA Notification Center</h1>
          <p className="text-xs text-slate-500">Real-time alerts, statutory deadline notifications & workflow breach warnings</p>
        </div>
        <span className="text-xs font-semibold text-slate-500">{notifications.length} Active Alerts</span>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 divide-y divide-slate-100">
        {notifications.map((notif) => (
          <div key={notif.id} className={`p-4 flex items-start space-x-4 transition-colors ${notif.isRead ? 'bg-slate-50 opacity-75' : 'bg-white hover:bg-slate-50'}`}>
            <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
              {notif.type === 'SLA_BREACH' ? (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              ) : notif.type === 'APPROVAL_REQ' ? (
                <Clock className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">{notif.title}</span>
                <span className="text-slate-400 font-mono text-[11px]">{new Date(notif.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-700">{notif.message}</p>
              <div className="pt-2 flex items-center justify-between">
                <StatusBadge status={notif.type} size="sm" />
                {!notif.isRead && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    className="text-xs font-semibold text-sky-600 hover:underline"
                  >
                    Mark as Read &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            No active SLA notifications or breach warnings.
          </div>
        )}
      </div>
    </div>
  );
}
