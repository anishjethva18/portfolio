import React from 'react';
import { useOS } from '../../context/OSContext';

export const NightLightFilter: React.FC = () => {
  const { settings } = useOS();

  const isNightLight = settings.nightLightEnabled;
  const intensity = settings.nightLightIntensity ?? 45;
  const colorFilter = settings.colorFilter || 'none';

  return (
    <>
      {/* Night Light Amber Overlay */}
      {isNightLight && (
        <div
          className="pointer-events-none fixed inset-0 z-[99998] transition-opacity duration-300 mix-blend-multiply"
          style={{
            backgroundColor: `rgba(255, 170, 70, ${Math.min(0.7, (intensity / 100) * 0.45)})`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Accessibility Color Filter Overlay */}
      {colorFilter !== 'none' && (
        <div
          className="pointer-events-none fixed inset-0 z-[99997] transition-all duration-200"
          style={{
            filter:
              colorFilter === 'grayscale'
                ? 'grayscale(100%)'
                : colorFilter === 'inverted'
                ? 'invert(100%)'
                : colorFilter === 'deuteranopia'
                ? 'hue-rotate(180deg) saturate(80%)'
                : colorFilter === 'protanopia'
                ? 'hue-rotate(140deg) saturate(90%)'
                : colorFilter === 'tritanopia'
                ? 'hue-rotate(240deg) saturate(80%)'
                : 'none',
            backdropFilter:
              colorFilter === 'grayscale'
                ? 'grayscale(100%)'
                : colorFilter === 'inverted'
                ? 'invert(100%)'
                : colorFilter === 'deuteranopia'
                ? 'hue-rotate(180deg) saturate(80%)'
                : colorFilter === 'protanopia'
                ? 'hue-rotate(140deg) saturate(90%)'
                : colorFilter === 'tritanopia'
                ? 'hue-rotate(240deg) saturate(80%)'
                : 'none',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
};
