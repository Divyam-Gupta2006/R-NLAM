import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const getBadgeStyle = (str: string) => {
    switch (str.toUpperCase()) {
      // SLA & Risk
      case 'ON_TRACK':
      case 'LOW':
      case 'PAID':
      case 'DISBURSED':
      case 'VERIFIED':
      case 'POSSESSION_HANDOVER':
      case 'POSSESSION_TAKEN':
      case 'REHABILITATED':
      case 'SUCCESS':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      
      case 'AT_RISK':
      case 'MEDIUM':
      case 'CALCULATED':
      case 'NOTIFIED':
      case 'SECTION_11':
      case 'PENDING':
      case 'QUEUED':
        return 'bg-amber-100 text-amber-800 border-amber-300';

      case 'BREACHED':
      case 'HIGH':
      case 'CRITICAL':
      case 'DISPUTED':
      case 'PAYMENT_FAILED':
      case 'REJECTED':
      case 'ERROR':
        return 'bg-rose-100 text-rose-800 border-rose-300';

      case 'SECTION_4':
      case 'SECTION_19':
      case 'SECTION_23_AWARD':
      case 'STATE_APPROVED':
      case 'DISTRICT_APPROVED':
      case 'OFFLINE_CAPTURED':
      case 'PLAN_APPROVED':
      case 'ENTITLEMENT_SANCTIONED':
        return 'bg-blue-100 text-blue-800 border-blue-300';

      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  const formattedText = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border shadow-sm transition-colors',
        sizeClasses[size],
        getBadgeStyle(status),
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {formattedText}
    </span>
  );
}
