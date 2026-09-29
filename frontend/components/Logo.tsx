import React from 'react';

/** R-NLAM mark: a surveyed parcel (saffron) on a navy tile, with a green boundary stone. */
export function LogoMark({ size = 40, className, onDark = false }: { size?: number; className?: string; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="R-NLAM">
      <rect width="48" height="48" rx="11" fill={onDark ? '#1b3a66' : '#0b1f3a'} stroke={onDark ? 'rgba(255,255,255,0.35)' : 'none'} strokeWidth="1.5" />
      <path d="M10 33 L17 13 L33 11 L39 27 L27 37 Z" fill="#e87722" opacity="0.95" />
      <path d="M10 33 L17 13 L33 11 L39 27 L27 37 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 13 L27 37 M33 11 L21 24.5" stroke="#fff" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.7" />
      <circle cx="39" cy="27" r="4" fill="#138808" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={compact ? 32 : 44} onDark={light} />
      <span className="leading-tight">
        <span className={`block font-extrabold tracking-tight ${compact ? 'text-lg' : 'text-2xl'} ${light ? 'text-white' : 'text-ink'}`}>R-NLAM</span>
        {!compact && <span className={`block text-xs ${light ? 'text-white/70' : 'text-ink-muted'}`}>Real-Time National Land Acquisition &amp; Management</span>}
      </span>
    </span>
  );
}
