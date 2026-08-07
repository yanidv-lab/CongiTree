import React from 'react';

// Extracted unchanged from the old DashboardView so SavedTreesSidebar (out of scope for the
// Organic redesign) keeps its exact existing look - the redesigned DashboardView builds its own
// ring locally with the new design system's colors instead of reusing this one.
export const ProgressRing: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  className?: string;
}> = ({ percentage, size = 52, strokeWidth = 5, showText = true, className = '' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  const getColors = (pct: number) => {
    if (pct === 100) return { stroke: 'stroke-emerald-500', text: 'text-emerald-700', bgTrack: 'stroke-emerald-100' };
    if (pct >= 50) return { stroke: 'stroke-indigo-600', text: 'text-indigo-700', bgTrack: 'stroke-indigo-100' };
    if (pct > 0) return { stroke: 'stroke-amber-500', text: 'text-amber-700', bgTrack: 'stroke-amber-100' };
    return { stroke: 'stroke-slate-300', text: 'text-slate-400', bgTrack: 'stroke-slate-100' };
  };

  const colors = getColors(percentage);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 overflow-visible" width={size} height={size}>
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colors.bgTrack} transition-colors duration-300`}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colors.stroke} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tracking-tighter">
          <span className={colors.text}>{percentage}%</span>
        </div>
      )}
    </div>
  );
};
