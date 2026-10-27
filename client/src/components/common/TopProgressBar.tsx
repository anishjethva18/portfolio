import React from 'react';

interface TopProgressBarProps {
  isLoading: boolean;
  progress?: number; // 0 to 100
  color?: string;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({
  isLoading,
  progress,
  color = '#0078d4',
}) => {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[10000] overflow-hidden pointer-events-none bg-black/10">
      <div
        className={`h-full transition-all duration-300 ${
          progress !== undefined ? '' : 'animate-pulse'
        }`}
        style={{
          width: progress !== undefined ? `${progress}%` : '100%',
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}, 0 0 5px ${color}`,
        }}
      />
    </div>
  );
};
