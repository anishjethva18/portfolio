import React, { useEffect, useRef, useState } from 'react';

interface BatteryIndicatorProps {
  level: number | null;
  isCharging?: boolean;
  className?: string;
  showPercentText?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({
  level,
  isCharging = false,
  className = '',
  showPercentText = false,
  size = 'sm',
}) => {
  const isAvailable = level !== null && !isNaN(level);
  const safeLevel = isAvailable ? Math.max(0, Math.min(100, Math.round(level))) : 100;
  const prevLevelRef = useRef(safeLevel);
  const [trend, setTrend] = useState<'increasing' | 'decreasing' | null>(null);

  useEffect(() => {
    if (!isAvailable) return;
    if (safeLevel > prevLevelRef.current) {
      setTrend('increasing');
      const timer = setTimeout(() => setTrend(null), 1500);
      prevLevelRef.current = safeLevel;
      return () => clearTimeout(timer);
    } else if (safeLevel < prevLevelRef.current) {
      setTrend('decreasing');
      const timer = setTimeout(() => setTrend(null), 1500);
      prevLevelRef.current = safeLevel;
      return () => clearTimeout(timer);
    }
  }, [safeLevel, isAvailable]);

  // Determine battery fill color gradient based on level
  let fillColor = '#10b981'; // emerald-500
  let pulseClass = '';

  if (!isAvailable) {
    fillColor = '#64748b'; // slate-500
  } else if (safeLevel <= 15) {
    fillColor = '#ef4444'; // red-500
    pulseClass = 'animate-pulse';
  } else if (safeLevel <= 30) {
    fillColor = '#f97316'; // orange-500
  } else if (safeLevel <= 50) {
    fillColor = '#eab308'; // yellow-500
  } else if (safeLevel <= 75) {
    fillColor = '#84cc16'; // lime-500
  } else {
    fillColor = '#10b981'; // emerald-500
  }

  // Dimensions based on size
  const width = size === 'xs' ? 18 : size === 'md' ? 24 : 20;
  const height = size === 'xs' ? 10 : size === 'md' ? 13 : 11;

  // Inner fill bar width calculation (viewBox 0 0 22 13)
  const fillWidth = isAvailable ? Math.max(1.5, Math.min(13, (safeLevel / 100) * 13)) : 13;

  return (
    <div className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
      <div className="relative flex items-center shrink-0">
        <svg
          width={width}
          height={height}
          viewBox="0 0 22 13"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 overflow-visible"
        >
          <defs>
            <linearGradient id={`batt-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={fillColor} />
              <stop offset="50%" stopColor={trend === 'increasing' || isCharging ? '#38bdf8' : fillColor} />
              <stop offset="100%" stopColor={fillColor} />
            </linearGradient>
          </defs>

          {/* Battery Outer Frame */}
          <rect
            x="1"
            y="1.5"
            width="16"
            height="10"
            rx="2.5"
            className="stroke-current stroke-[1.4] text-slate-800 dark:text-white"
            fill="none"
          />

          {/* Battery Positive Terminal Pin */}
          <path
            d="M18.5 4.5C19.3 4.5 19.8 5 19.8 5.7V7.3C19.8 8 19.3 8.5 18.5 8.5V4.5Z"
            className="fill-current text-slate-800 dark:text-white"
          />

          {/* Inner Battery Fill Level Bar */}
          <rect
            x="2.5"
            y="3"
            width={fillWidth}
            height="7"
            rx="1.2"
            fill={isAvailable ? `url(#batt-grad-${size})` : 'rgba(100, 116, 139, 0.4)'}
            className={`${pulseClass} transition-all duration-700 ease-out`}
            style={{
              filter: trend === 'increasing' ? 'drop-shadow(0 0 2px #38bdf8)' : trend === 'decreasing' ? 'drop-shadow(0 0 2px #ef4444)' : undefined,
            }}
          />

          {/* Charging Bolt Symbol inside battery */}
          {isCharging && (
            <path
              d="M9.5 1.5L6.5 6.5H9L8 11.5L12.5 6H10L11 1.5H9.5Z"
              className="fill-amber-400 stroke-black/50 dark:stroke-black/80 stroke-[0.4] filter drop-shadow-xs animate-pulse"
            />
          )}
        </svg>
      </div>

      {showPercentText && (
        <span
          className={`text-[10px] sm:text-xs tabular-nums font-mono font-bold leading-none transition-colors duration-500 ${
            !isAvailable
              ? 'text-slate-400'
              : trend === 'increasing'
              ? 'text-cyan-400 scale-105'
              : trend === 'decreasing'
              ? 'text-amber-400'
              : safeLevel <= 15
              ? 'text-red-500 animate-pulse'
              : ''
          }`}
        >
          {isAvailable ? `${safeLevel}%` : 'N/A'}
        </span>
      )}
    </div>
  );
};
