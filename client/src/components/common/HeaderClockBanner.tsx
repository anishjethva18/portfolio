import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { formatDate, formatTime } from '../../utils/dateTime';

export const HeaderClockBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { settings } = useOS();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => {
      setNow(new Date());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [settings.timeZone]);

  const timeStr = formatTime(now, {
    hour: 'numeric',
    minute: '2-digit',
    second: settings.showSecondsInClock ? '2-digit' : undefined,
    hour12: settings.clockFormat !== '24h',
  }, settings.timeZone);
  const dateStr = formatDate(now, { weekday: 'short', day: 'numeric', month: 'short' }, settings.timeZone);

  return (
    <div className={`flex items-baseline gap-2.5 px-1 pt-1 pb-3 select-none ${className}`}>
      <span className="text-3xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans tabular-nums drop-shadow-xs">
        {timeStr}
      </span>
      <span className="text-base sm:text-lg font-semibold text-slate-700 dark:text-slate-200 tracking-normal">
        {dateStr}
      </span>
    </div>
  );
};
