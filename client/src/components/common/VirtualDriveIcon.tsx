import React, { useId } from 'react';

export const VirtualDriveIcon: React.FC<{
  driveLetter: 'C:' | 'D:';
  className?: string;
}> = ({ driveLetter, className }) => {
  const idPrefix = useId().replace(/:/g, '');
  return (
    <svg
      aria-hidden="true"
      viewBox={driveLetter === 'C:' ? '0 0 276 215' : '0 0 236 124'}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {driveLetter === 'C:' ? (
        <>
          <defs>
            <linearGradient id={`${idPrefix}-locked-drive-face`} x1="140" y1="115" x2="140" y2="194" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B3B3B" />
              <stop offset="1" stopColor="#151515" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-locked-drive-top`} x1="36" y1="82" x2="251" y2="121" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F2F2F2" />
              <stop offset="1" stopColor="#C9CDD2" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-locked-padlock-body`} x1="204" y1="73" x2="204" y2="163" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D4D9DF" />
              <stop offset="1" stopColor="#AAB2BB" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-locked-padlock-accent`} x1="204" y1="72" x2="204" y2="163" gradientUnits="userSpaceOnUse">
              <stop stopColor="#39B9F3" />
              <stop offset="1" stopColor="#087FD1" />
            </linearGradient>
            <filter id={`${idPrefix}-locked-drive-shadow`} x="21" y="76" width="244" height="133" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path d="M35 120 65 82h186v111H35v-73Z" fill="#000" opacity=".18" filter={`url(#${idPrefix}-locked-drive-shadow)`} />
          <path d="M64 82h187v111H35v-72l29-39Z" fill={`url(#${idPrefix}-locked-drive-top)`} />
          <path d="M35 121h216v72H35v-72Z" fill={`url(#${idPrefix}-locked-drive-face)`} stroke="#777" strokeWidth="5" />
          <circle cx="69" cy="164" r="9" fill="#00D62B" stroke="#72FF77" strokeWidth="4" />
          <path d="M19 20h41v40H19zM64 20h41v40H64zM19 65h41v41H19zM64 65h41v41H64z" fill="#1499DE" />
          <path d="M176 75V52c0-18 12-32 29-32s29 14 29 32" stroke="#B8C0C9" strokeWidth="14" strokeLinecap="round" />
          <rect x="154" y="72" width="105" height="91" rx="11" fill={`url(#${idPrefix}-locked-padlock-body)`} stroke={`url(#${idPrefix}-locked-padlock-accent)`} strokeWidth="6" />
          <path d="M154 86h105" stroke="#78D5FF" strokeWidth="5" />
          <circle cx="207" cy="194" r="27" fill="#AAB2BB" stroke="#8C959F" strokeWidth="2" />
          <path d="M202 194a5 5 0 1 1 10 0v3h-10v-3Z" fill="#737A82" />
          <path d="M202 197h10v2h-10z" fill="#D6D9DD" />
        </>
      ) : (
        <>
          <defs>
            <linearGradient id={`${idPrefix}-data-drive-top`} x1="118" y1="13" x2="118" y2="63" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F3F4F5" />
              <stop offset="1" stopColor="#C9CDD1" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-data-drive-face`} x1="118" y1="57" x2="118" y2="116" gradientUnits="userSpaceOnUse">
              <stop stopColor="#343434" />
              <stop offset="1" stopColor="#171717" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-data-drive-edge`} x1="118" y1="52" x2="118" y2="119" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D9DADD" />
              <stop offset="1" stopColor="#8C8E91" />
            </linearGradient>
          </defs>
          <path d="M63 13h119l46 45v48c0 7-5 12-12 12H20c-7 0-12-5-12-12V58l55-45Z" fill={`url(#${idPrefix}-data-drive-edge)`} />
          <path d="M65 17h115l42 42H22l43-42Z" fill={`url(#${idPrefix}-data-drive-top)`} />
          <path d="M18 60h200v46H18V60Z" fill={`url(#${idPrefix}-data-drive-face)`} stroke="#5E6062" strokeWidth="4" />
          <circle cx="57" cy="84" r="8" fill="#00D62B" stroke="#75FF76" strokeWidth="4" />
          <path d="M10 107h216" stroke="#F2F2F2" strokeWidth="4" />
        </>
      )}
    </svg>
  );
};
