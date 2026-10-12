import React from 'react';

/**
 * HemeleyLogo — Brand mark with the orange "H" badge and "Heme/ley" wordmark.
 * Variants: 'default' (dark text, light bg) | 'dark' (light text, dark bg)
 */
const HemeleyLogo = ({ size = 36, variant = 'default', showText = true, className = '' }) => {
  const textColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const accent = 'text-orange-500';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`} data-testid="hemeley-logo">
      {/* H badge */}
      <div
        style={{ width: size, height: size }}
        className="relative rounded-xl bg-slate-900 flex items-center justify-center shadow-sm"
      >
        <span
          style={{ fontSize: size * 0.55, lineHeight: 1 }}
          className="font-extrabold text-orange-500 tracking-tighter"
        >
          H
        </span>
        <span
          style={{ width: size * 0.18, height: size * 0.18, top: -size * 0.06, right: -size * 0.06 }}
          className="absolute rounded-full bg-orange-500 ring-2 ring-white"
        />
      </div>
      {showText && (
        <span
          style={{ fontSize: size * 0.6 }}
          className={`font-extrabold tracking-tight ${textColor}`}
        >
          Heme<span className={accent}>ley</span>
        </span>
      )}
    </div>
  );
};

export default HemeleyLogo;
