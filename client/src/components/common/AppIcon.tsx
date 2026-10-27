import React from 'react';
import * as Icons from 'lucide-react';
import { useOS } from '../../context/OSContext';

// ----------------------------------------------------
// ORIGINAL WINDOWS 11 & SYSTEM ICON VARIATION DATA
// ----------------------------------------------------

export interface AppIconOption {
  id: string;
  name: string;
  category: 'Fluent 3D' | 'Modern' | 'Classic' | 'Minimalist' | 'Special';
}

export const APP_ICON_OPTIONS: Record<string, AppIconOption[]> = {
  explorer: [
    { id: 'fluent-pc', name: 'Windows 11 This PC (Default)', category: 'Fluent 3D' },
    { id: 'fluent-folder', name: 'Fluent Yellow Folder', category: 'Fluent 3D' },
    { id: 'classic-pc', name: 'Classic Windows PC', category: 'Classic' },
    { id: 'minimal-pc', name: 'Minimalist Desktop', category: 'Minimalist' },
  ],
  browser: [
    { id: 'planetary-blue', name: 'Planetary Web Browser (Default)', category: 'Fluent 3D' },
    { id: 'chrome-original', name: 'Google Chrome Original', category: 'Modern' },
    { id: 'edge-wave', name: 'Microsoft Edge Wave', category: 'Modern' },
    { id: 'globe-glass', name: 'Modern Glass Globe', category: 'Minimalist' },
  ],
  terminal: [
    { id: 'terminal-fluent', name: 'Windows 11 Terminal (Default)', category: 'Fluent 3D' },
    { id: 'powershell-blue', name: 'PowerShell Acrylic', category: 'Modern' },
    { id: 'cmd-classic', name: 'Command Prompt Classic', category: 'Classic' },
    { id: 'matrix-terminal', name: 'Matrix Green Terminal', category: 'Special' },
  ],
  notepad: [
    { id: 'notepad-fluent', name: 'Windows 11 Notepad (Default)', category: 'Fluent 3D' },
    { id: 'notepad-classic', name: 'Classic Windows Notepad', category: 'Classic' },
    { id: 'notepad-code', name: 'Developer Code Editor', category: 'Modern' },
  ],
  photos: [
    { id: 'photos-fluent', name: 'Windows 11 Photos (Default)', category: 'Fluent 3D' },
    { id: 'media-player', name: 'Windows Media Player', category: 'Modern' },
    { id: 'polaroid-gallery', name: 'Polaroid Art Frame', category: 'Special' },
  ],
  camera: [
    { id: 'camera-fluent', name: 'Windows 11 Camera (Default)', category: 'Fluent 3D' },
    { id: 'camera-studio', name: 'Studio DSLR Lens', category: 'Modern' },
    { id: 'camera-vintage', name: 'Retro Leather Camera', category: 'Classic' },
  ],
  settings: [
    { id: 'settings-fluent', name: 'Windows 11 Acrylic Gear (Default)', category: 'Fluent 3D' },
    { id: 'settings-classic', name: 'Control Panel Cog', category: 'Classic' },
    { id: 'settings-neon', name: 'Cyber Neon Controls', category: 'Special' },
  ],
  calculator: [
    { id: 'calculator-fluent', name: 'Windows 11 Calculator (Default)', category: 'Fluent 3D' },
    { id: 'calculator-classic', name: 'Desktop Adding Machine', category: 'Classic' },
    { id: 'calculator-math', name: 'Scientific Formula Matrix', category: 'Special' },
  ],
  resume: [
    { id: 'resume-cv-badge', name: 'CV Document with Verified Badge (Default)', category: 'Fluent 3D' },
    { id: 'resume-pdf', name: 'Adobe Acrobat PDF', category: 'Modern' },
    { id: 'resume-diploma', name: 'Official CV Certificate', category: 'Modern' },
    { id: 'resume-blue', name: 'Word Document (DOCX)', category: 'Modern' },
  ],
  projects: [
    { id: 'projects-briefcase', name: 'Portfolio Briefcase (Default)', category: 'Fluent 3D' },
    { id: 'projects-rocket', name: 'Launchpad Rocket', category: 'Special' },
    { id: 'projects-code', name: 'Developer Git Repo', category: 'Modern' },
  ],
  skills: [
    { id: 'skills-medal', name: 'Golden Award Medal (Default)', category: 'Fluent 3D' },
    { id: 'skills-diamond', name: 'Crystal Tech Diamond', category: 'Special' },
    { id: 'skills-cpu', name: 'Quantum AI Processor', category: 'Modern' },
  ],
  about: [
    { id: 'about-fluent', name: 'Windows 11 User Profile (Default)', category: 'Fluent 3D' },
    { id: 'about-cyber', name: 'Cyber Developer Avatar', category: 'Special' },
    { id: 'about-id', name: 'Biometric ID Badge', category: 'Modern' },
  ],
  contact: [
    { id: 'contact-fluent', name: 'Windows 11 Mail Flyout (Default)', category: 'Fluent 3D' },
    { id: 'contact-paperplane', name: 'Telegram Paper Plane', category: 'Modern' },
    { id: 'contact-chat', name: 'Live Chat Bubble', category: 'Special' },
  ],
  minesweeper: [
    { id: 'minesweeper-classic', name: 'Classic Naval Mine (Default)', category: 'Fluent 3D' },
    { id: 'minesweeper-flag', name: 'Arcade Danger Flag', category: 'Modern' },
    { id: 'minesweeper-trophy', name: 'Winner Golden Trophy', category: 'Special' },
  ],
  snake: [
    { id: 'snake-retro', name: 'Retro Arcade Snake (Default)', category: 'Fluent 3D' },
    { id: 'snake-pixel', name: '8-Bit Cyber Snake', category: 'Special' },
    { id: 'snake-neon', name: 'Cyber Neon Glow Snake', category: 'Modern' },
  ],
  recycle: [
    { id: 'recycle-fluent', name: 'Windows 11 Glass Bin (Default)', category: 'Fluent 3D' },
    { id: 'recycle-full', name: 'Recycle Bin (Active/Full)', category: 'Modern' },
    { id: 'recycle-classic', name: 'Classic Wastebasket', category: 'Classic' },
  ],
  taskmanager: [
    { id: 'taskmanager-fluent', name: 'Windows 11 CPU Pulse (Default)', category: 'Fluent 3D' },
    { id: 'taskmanager-gauge', name: 'Hardware Telemetry Gauge', category: 'Modern' },
    { id: 'taskmanager-chip', name: 'Microchip System Monitor', category: 'Special' },
  ],
};

// ----------------------------------------------------
// DEDICATED SVG ICON COMPONENTS MATCHING THE 12 SOFTWARE ICONS
// ----------------------------------------------------

/** 1. Start Menu: 3D Angled Windows 11 Blue Tiles */
export const WindowsStartLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="win_tl" x1="6" y1="7" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00D2FF" />
          <stop offset="1" stopColor="#0078D4" />
        </linearGradient>
        <linearGradient id="win_tr" x1="23" y1="5" x2="42" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00C0FF" />
          <stop offset="1" stopColor="#0066CC" />
        </linearGradient>
        <linearGradient id="win_bl" x1="6" y1="23" x2="21" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A2ED" />
          <stop offset="1" stopColor="#005A9E" />
        </linearGradient>
        <linearGradient id="win_br" x1="23" y1="22" x2="42" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0090E0" />
          <stop offset="1" stopColor="#004C87" />
        </linearGradient>
      </defs>
      {/* 4 Perspective Windows 11 Tiles */}
      <path d="M7 8.5L21 6.5V21.5H7V8.5Z" fill="url(#win_tl)" />
      <path d="M23.5 6.1L41 3.5V21.5H23.5V6.1Z" fill="url(#win_tr)" />
      <path d="M7 23.5H21V38.5L7 36.5V23.5Z" fill="url(#win_bl)" />
      <path d="M23.5 23.5H41V41.5L23.5 39V23.5Z" fill="url(#win_br)" />
    </svg>
  );
};

/** 2. This PC: Desktop monitor with stand and cyan/blue display */
export const ThisPCLogo: React.FC<{ size?: number; className?: string; color?: string; variant?: string }> = ({
  size = 34,
  className = '',
  color,
  variant = 'fluent-pc',
}) => {
  const accent = color || '#0078D4';

  if (variant === 'fluent-folder') {
    return <WindowsFolderIcon size={size} className={className} />;
  }

  if (variant === 'classic-pc') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow select-none ${className}`}>
        <rect x="5" y="7" width="38" height="26" rx="2" fill="#CBD5E1" stroke="#475569" strokeWidth="2" />
        <rect x="8" y="10" width="32" height="20" fill="#0284C7" />
        <path d="M19 33H29V38H19V33Z" fill="#94A3B8" />
        <rect x="14" y="38" width="20" height="4" rx="1" fill="#64748B" />
      </svg>
    );
  }

  if (variant === 'minimal-pc') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow select-none ${className}`}>
        <rect x="6" y="8" width="36" height="24" rx="3" fill="#1E293B" stroke={accent} strokeWidth="2" />
        <rect x="10" y="12" width="28" height="16" rx="1" fill={accent} fillOpacity="0.4" />
        <path d="M18 32H30L34 40H14L18 32Z" fill="#64748B" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="thispc_screen_grad" x1="6" y1="6" x2="42" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0078D4" />
          <stop offset="0.6" stopColor="#00A2ED" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="thispc_bezel" x1="4" y1="4" x2="44" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3F3F46" />
          <stop offset="1" stopColor="#18181B" />
        </linearGradient>
        <linearGradient id="thispc_stand" x1="20" y1="34" x2="28" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CBD5E1" />
          <stop offset="1" stopColor="#64748B" />
        </linearGradient>
      </defs>
      {/* Stand Neck */}
      <path d="M21 34H27V41H21V34Z" fill="url(#thispc_stand)" />
      {/* Stand Oval Base */}
      <ellipse cx="24" cy="42" rx="11" ry="3" fill="#94A3B8" stroke="#475569" strokeWidth="0.8" />
      {/* Outer Monitor Frame */}
      <rect x="4" y="5" width="40" height="29" rx="4" fill="url(#thispc_bezel)" stroke="#71717A" strokeWidth="1" />
      {/* Screen Glass */}
      <rect x="6.5" y="7.5" width="35" height="24" rx="2" fill="url(#thispc_screen_grad)" />
      {/* Inner Screen Accent Glass Reflection */}
      <path d="M7 8L28 8L10 31H7V8Z" fill="white" fillOpacity="0.22" />
      {/* Power Indicator Light */}
      <circle cx="24" cy="32" r="0.75" fill="#38BDF8" />
    </svg>
  );
};

/** 3. Settings: Metallic gray gear with royal blue center */
export const WindowsSettingsIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'settings-neon') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <circle cx="24" cy="24" r="18" fill="#0F172A" stroke="#06B6D4" strokeWidth="2" />
        <circle cx="24" cy="24" r="12" stroke="#EC4899" strokeWidth="2" strokeDasharray="4 2" />
        <circle cx="24" cy="24" r="5" fill="#06B6D4" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="gear_outer_grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#71717A" />
          <stop offset="1" stopColor="#3F3F46" />
        </linearGradient>
      </defs>
      {/* 8 Gear Teeth */}
      <path
        d="M21 4H27V9H21V4ZM21 39H27V44H21V39ZM4 21H9V27H4V21ZM39 21H44V27H39V21ZM9.8 11.2L14.0 15.4L10.5 18.9L6.3 14.7L9.8 11.2ZM37.5 33.3L41.7 37.5L38.2 41.0L34.0 36.8L37.5 33.3ZM6.3 33.3L10.5 29.8L14.0 33.3L9.8 37.5L6.3 33.3ZM38.2 7.0L41.7 10.5L37.5 14.7L34.0 11.2L38.2 7.0Z"
        fill="url(#gear_outer_grad)"
      />
      {/* Main Beveled Gear Circle */}
      <circle cx="24" cy="24" r="16.5" fill="url(#gear_outer_grad)" stroke="#A1A1AA" strokeWidth="1.2" />
      {/* Inner White Contrast Ring */}
      <circle cx="24" cy="24" r="10.5" fill="#F8FAFC" />
      {/* Vivid Royal Blue Center Core */}
      <circle cx="24" cy="24" r="7" fill="#0078D4" />
    </svg>
  );
};

/** 4. Folder: Smooth 3D yellow/amber folder */
export const WindowsFolderIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = '',
}) => {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="folder_back" x1="4" y1="9" x2="44" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="folder_front" x1="4" y1="18" x2="44" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.3" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Back Flap with tab */}
      <path d="M5 12C5 10.3431 6.34315 9 8 9H18.5C20.2 9 21.6 9.8 22.5 11.2L24.5 14H40C41.6569 14 43 15.3431 43 17V36C43 37.6569 41.6569 39 40 39H8C6.34315 39 5 37.6569 5 36V12Z" fill="url(#folder_back)" />
      {/* Subtle white document peek */}
      <rect x="8" y="13" width="32" height="12" rx="1.5" fill="#FFFFFF" fillOpacity="0.9" />
      {/* Front Folder Body */}
      <path d="M4 19C4 17.3431 5.34315 16 7 16H41C42.6569 16 44 17.3431 44 19V36C44 38.2091 42.2091 40 40 40H8C5.79086 40 4 38.2091 4 36V19Z" fill="url(#folder_front)" stroke="#F59E0B" strokeWidth="0.5" />
    </svg>
  );
};

/** 5. File Explorer: Yellow folder with blue document tab */
export const WindowsFileExplorerIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = '',
}) => {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="fe_back" x1="4" y1="9" x2="44" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="fe_blue_tab" x1="10" y1="12" x2="38" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00D2FF" />
          <stop offset="0.6" stopColor="#0078D4" />
          <stop offset="1" stopColor="#005A9E" />
        </linearGradient>
        <linearGradient id="fe_front" x1="4" y1="18" x2="44" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.3" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Back Folder */}
      <path d="M5 12C5 10.3431 6.34315 9 8 9H18.5C20.2 9 21.6 9.8 22.5 11.2L24.5 14H40C41.6569 14 43 15.3431 43 17V36C43 37.6569 41.6569 39 40 39H8C6.34315 39 5 37.6569 5 36V12Z" fill="url(#fe_back)" />
      {/* Blue Card / Document Insert Inside Pocket */}
      <rect x="10" y="13" width="28" height="15" rx="2" fill="url(#fe_blue_tab)" stroke="#38BDF8" strokeWidth="0.5" />
      <line x1="14" y1="17" x2="28" y2="17" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="21" x2="22" y2="21" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
      {/* Front Folder Pocket */}
      <path d="M4 19C4 17.3431 5.34315 16 7 16H41C42.6569 16 44 17.3431 44 19V36C44 38.2091 42.2091 40 40 40H8C5.79086 40 4 38.2091 4 36V19Z" fill="url(#fe_front)" stroke="#F59E0B" strokeWidth="0.5" />
    </svg>
  );
};

/** 6. Notepad: Sky-blue notebook with top spirals and 3 stripes */
export const WindowsNotepadIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'notepad-code') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <rect x="8" y="5" width="32" height="38" rx="4" fill="#0F172A" stroke="#0078D4" strokeWidth="1.5" />
        <rect x="11" y="9" width="26" height="30" rx="2" fill="#1E293B" />
        <path d="M17 19L13 24L17 29" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M31 19L35 24L31 29" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="notepad_cover" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0078D4" />
        </linearGradient>
      </defs>
      {/* Amber Page Bottom Back Cover */}
      <rect x="10" y="38" width="28" height="5" rx="1.5" fill="#D97706" />
      {/* Blue Binder Cover */}
      <rect x="8" y="7" width="32" height="33" rx="4" fill="url(#notepad_cover)" stroke="#0284C7" strokeWidth="0.8" />
      {/* 3 Horizontal Dark Accent Bands */}
      <rect x="13" y="15" width="22" height="3.5" rx="1.75" fill="#0C4A6E" fillOpacity="0.75" />
      <rect x="13" y="22" width="22" height="3.5" rx="1.75" fill="#0C4A6E" fillOpacity="0.75" />
      <rect x="13" y="29" width="16" height="3.5" rx="1.75" fill="#0C4A6E" fillOpacity="0.75" />
      {/* 4 Silver Spiral Binder Rings at Top */}
      <rect x="12" y="4" width="3" height="6" rx="1.5" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.6" />
      <rect x="19" y="4" width="3" height="6" rx="1.5" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.6" />
      <rect x="26" y="4" width="3" height="6" rx="1.5" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.6" />
      <rect x="33" y="4" width="3" height="6" rx="1.5" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.6" />
    </svg>
  );
};

/** 7. Calculator: Slate gray with cyan LCD display and blue action key */
export const WindowsCalculatorIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'calculator-math') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <rect x="7" y="5" width="34" height="38" rx="6" fill="#581C87" stroke="#A855F7" strokeWidth="1.5" />
        <rect x="11" y="9" width="26" height="8" rx="2" fill="#1E1B4B" />
        <text x="33" y="15" fill="#E9D5FF" fontSize="7" fontWeight="bold" textAnchor="end" fontFamily="monospace">f(x)=π</text>
        <circle cx="16" cy="23" r="3" fill="#A855F7" />
        <circle cx="24" cy="23" r="3" fill="#A855F7" />
        <circle cx="32" cy="23" r="3" fill="#F43F5E" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="calc_body" x1="7" y1="5" x2="41" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#334155" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
        <linearGradient id="calc_screen" x1="11" y1="9" x2="37" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0078D4" />
          <stop offset="1" stopColor="#00B4D8" />
        </linearGradient>
      </defs>
      {/* Calculator Body */}
      <rect x="7" y="5" width="34" height="38" rx="6" fill="url(#calc_body)" stroke="#475569" strokeWidth="1" />
      {/* Top LCD Display Screen */}
      <rect x="11" y="9" width="26" height="9" rx="2" fill="url(#calc_screen)" />
      <text x="33" y="16" fill="#FFFFFF" fontSize="7.5" fontWeight="bold" textAnchor="end" fontFamily="monospace">0</text>
      {/* Row 1 Keys */}
      <rect x="11" y="21" width="6" height="5" rx="1.5" fill="#E2E8F0" />
      <rect x="19" y="21" width="6" height="5" rx="1.5" fill="#E2E8F0" />
      <rect x="27" y="21" width="6" height="5" rx="1.5" fill="#E2E8F0" />
      {/* Row 2 Keys */}
      <rect x="11" y="28" width="6" height="5" rx="1.5" fill="#E2E8F0" />
      <rect x="19" y="28" width="6" height="5" rx="1.5" fill="#E2E8F0" />
      <rect x="27" y="28" width="6" height="5" rx="1.5" fill="#E2E8F0" />
      {/* Row 3 Keys */}
      <rect x="11" y="35" width="14" height="5" rx="1.5" fill="#E2E8F0" />
      <rect x="27" y="35" width="6" height="5" rx="1.5" fill="#0078D4" />
    </svg>
  );
};

/** 8. Recycle Bin: Translucent open wastebasket with vivid blue recycling arrows */
export const WindowsRecycleBinIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  const isFull = variant === 'recycle-full';
  const isClassic = variant === 'recycle-classic';

  if (isClassic) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <path d="M12 12H36L33 40H15L12 12Z" fill="#94A3B8" stroke="#475569" strokeWidth="2" />
        <line x1="8" y1="12" x2="40" y2="12" stroke="#334155" strokeWidth="3" />
        <line x1="20" y1="18" x2="20" y2="34" stroke="#475569" strokeWidth="2" />
        <line x1="28" y1="18" x2="28" y2="34" stroke="#475569" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="bin_body_grad" x1="12" y1="12" x2="36" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#CBD5E1" stopOpacity="0.65" />
          <stop offset="1" stopColor="#94A3B8" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="bin_rim_grad" x1="10" y1="10" x2="38" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      {/* Bin Body Outer Trapezoid */}
      <path
        d="M13 14H35L32.5 41C32.5 42.1046 31.6046 43 30.5 43H17.5C16.3954 43 15.5 42.1046 15.5 41L13 14Z"
        fill="url(#bin_body_grad)"
        stroke="#94A3B8"
        strokeWidth="1.2"
      />
      {/* Top Oval Rim */}
      <ellipse cx="24" cy="14" rx="11" ry="3.5" fill="url(#bin_rim_grad)" stroke="#64748B" strokeWidth="1" />
      {/* Inner Depth Hole */}
      <ellipse cx="24" cy="14" rx="9" ry="2.2" fill="#475569" fillOpacity="0.4" />

      {/* Recyle 3-Arrow Emblem in Vivid Windows Blue */}
      <g transform="translate(14, 21) scale(0.85)">
        <path d="M12 2L15 6H9L12 2Z" fill="#0078D4" />
        <path d="M12 5C15.866 5 19 8.13401 19 12L17 12C17 9.23858 14.7614 7 12 7V5Z" fill="#0078D4" />
        <path d="M20 18L17 14L23 14L20 18Z" fill="#0078D4" />
        <path d="M17 14C19 17 16 20 12 20V18C15 18 16.5 16 15.5 14H17Z" fill="#0078D4" />
        <path d="M4 18L7 14L1 14L4 18Z" fill="#0078D4" />
        <path d="M6 14C4.5 11 7 8 10 7L10.5 8.8C8.5 9.5 6.5 11.5 7.5 14H6Z" fill="#0078D4" />
      </g>

      {/* Full Trash Indicator Particles */}
      {isFull && (
        <>
          <rect x="18" y="11" width="5" height="4" rx="0.5" fill="#F8FAFC" transform="rotate(-12 18 11)" />
          <rect x="25" y="10" width="6" height="5" rx="0.5" fill="#E2E8F0" transform="rotate(18 25 10)" />
        </>
      )}
    </svg>
  );
};

/** 9. Media App (Photos / Media): Mountain silhouette with sun */
export const WindowsPhotosIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'media-player') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <circle cx="24" cy="24" r="20" fill="#EA580C" stroke="#F97316" strokeWidth="2" />
        <circle cx="24" cy="24" r="14" fill="#1E293B" />
        <circle cx="24" cy="24" r="6" fill="#EA580C" />
        <polygon points="22,20 28,24 22,28" fill="#FFFFFF" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="photos_bg" x1="5" y1="5" x2="43" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D4ED8" />
          <stop offset="0.6" stopColor="#4338CA" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id="photos_mountain" x1="6" y1="26" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      {/* Rounded App Square */}
      <rect x="5" y="5" width="38" height="38" rx="8" fill="url(#photos_bg)" stroke="#818CF8" strokeWidth="0.8" />
      {/* Sun / Moon Orb */}
      <circle cx="31" cy="16" r="4.5" fill="#FDE047" />
      {/* Mountain Slope 1 (Foreground) */}
      <path
        d="M5 36L16 23L27 34L35 25L43 33V35C43 39.4183 39.4183 43 35 43H13C8.58172 43 5 39.4183 5 35V36Z"
        fill="url(#photos_mountain)"
      />
      {/* Mountain Slope 2 (Depth) */}
      <path d="M16 23L27 34L22 34L16 23Z" fill="#0369A1" fillOpacity="0.4" />
    </svg>
  );
};

/** 10. Contact Me: Rounded blue squircle with white folded envelope */
export const WindowsContactIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'contact-paperplane') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <circle cx="24" cy="24" r="20" fill="#0284C7" />
        <polygon points="12,24 36,12 28,36 22,28" fill="#FFFFFF" />
        <polygon points="22,28 28,36 25,30" fill="#BAE6FD" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="mail_bg" x1="5" y1="5" x2="43" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284C7" />
          <stop offset="0.6" stopColor="#0078D4" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {/* Rounded Blue Tile */}
      <rect x="5" y="5" width="38" height="38" rx="9" fill="url(#mail_bg)" stroke="#38BDF8" strokeWidth="0.8" />
      {/* White Folded Envelope */}
      <rect x="9" y="13" width="30" height="22" rx="3" fill="#FFFFFF" />
      {/* Top Envelope Flap Fold Chevron */}
      <path d="M9 15L24 25L39 15" stroke="#0078D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** 11. Project App: Blue blueprint roll with rising trend chart & arrow */
export const WindowsProjectsIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
}) => {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="proj_blueprint_grad" x1="4" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284C7" />
          <stop offset="0.7" stopColor="#0369A1" />
          <stop offset="1" stopColor="#075985" />
        </linearGradient>
        <linearGradient id="proj_roll_curl" x1="4" y1="8" x2="12" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      {/* Main Blueprint Sheet */}
      <rect x="10" y="8" width="34" height="32" rx="3" fill="url(#proj_blueprint_grad)" stroke="#38BDF8" strokeWidth="0.75" />
      {/* Left Rolled Edge of Blueprint Scroll */}
      <path d="M12 8C8 8 5 11 5 16V32C5 37 8 40 12 40H14V8H12Z" fill="url(#proj_roll_curl)" stroke="#7DD3FC" strokeWidth="0.75" />
      {/* Rolled inner curl circle */}
      <ellipse cx="12" cy="24" rx="2.5" ry="12" fill="#0C4A6E" fillOpacity="0.6" />
      {/* Architectural Grid lines */}
      <line x1="16" y1="16" x2="40" y2="16" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="2 2" />
      <line x1="16" y1="24" x2="40" y2="24" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="2 2" />
      <line x1="16" y1="32" x2="40" y2="32" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="2 2" />
      <line x1="24" y1="12" x2="24" y2="36" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="2 2" />
      <line x1="32" y1="12" x2="32" y2="36" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="2 2" />
      {/* Rising Zigzag Project Trend Line with Upward Arrow */}
      <path d="M16 33L23 25L29 29L37 17" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Arrowhead pointing up-right */}
      <polygon points="33,14 41,16 38,24" fill="#22D3EE" />
      {/* Data Node Points */}
      <circle cx="16" cy="33" r="2" fill="#FFFFFF" />
      <circle cx="23" cy="25" r="2" fill="#FFFFFF" />
      <circle cx="29" cy="29" r="2" fill="#FFFFFF" />
      <circle cx="37" cy="17" r="2.2" fill="#FFFFFF" stroke="#0891B2" strokeWidth="0.75" />
    </svg>
  );
};

/** 12. Skill & Tech: Golden 1st place award medal with Roman numeral 'I' & red ribbon */
export const WindowsSkillsIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
}) => {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="medal_ribbon_left" x1="14" y1="4" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DC2626" />
          <stop offset="1" stopColor="#991B1B" />
        </linearGradient>
        <linearGradient id="medal_ribbon_right" x1="34" y1="4" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444" />
          <stop offset="1" stopColor="#B91C1C" />
        </linearGradient>
        <linearGradient id="medal_gold_outer" x1="12" y1="16" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.4" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="medal_gold_inner" x1="16" y1="20" x2="32" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF08A" />
          <stop offset="0.6" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Red Ribbons */}
      {/* Left Ribbon Strip */}
      <polygon points="16,4 24,20 18,22 10,6" fill="url(#medal_ribbon_left)" />
      {/* Right Ribbon Strip */}
      <polygon points="32,4 24,20 30,22 38,6" fill="url(#medal_ribbon_right)" />
      {/* Ribbon Tail V-cut details */}
      <polygon points="10,6 16,4 12,2" fill="#7F1D1D" fillOpacity="0.4" />
      <polygon points="38,6 32,4 36,2" fill="#7F1D1D" fillOpacity="0.4" />

      {/* Outer Beveled Golden Medal */}
      <circle cx="24" cy="29" r="14" fill="url(#medal_gold_outer)" stroke="#B45309" strokeWidth="1" />
      {/* Inner Recessed Gold Circle */}
      <circle cx="24" cy="29" r="11" fill="url(#medal_gold_inner)" stroke="#FDE047" strokeWidth="0.8" />
      {/* Subtle Rim Dots */}
      <circle cx="24" cy="29" r="10" stroke="#D97706" strokeWidth="0.5" strokeDasharray="1.5 1.5" />

      {/* Roman Numeral "I" in center */}
      <g fill="#78350F">
        {/* Top Serif Bar */}
        <rect x="20.5" y="22" width="7" height="2" rx="0.5" />
        {/* Center Vertical Stem */}
        <rect x="22.5" y="24" width="3" height="10" rx="0.5" />
        {/* Bottom Serif Bar */}
        <rect x="20.5" y="34" width="7" height="2" rx="0.5" />
      </g>
      {/* Medal Highlight Glint */}
      <path d="M16 23C18 20 22 19 25 19" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
};

/** Image 6: Windows 11 Terminal / PowerShell (Dark Window + Command Prompt Cursor) */
export const WindowsTerminalIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  const isPowerShell = variant === 'powershell-blue';
  const isMatrix = variant === 'matrix-terminal';
  const isCmd = variant === 'cmd-classic';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      {/* Terminal Main Window Frame */}
      <rect
        x="4"
        y="6"
        width="40"
        height="36"
        rx="6"
        fill={isPowerShell ? '#002456' : isMatrix ? '#041808' : isCmd ? '#0C0C0C' : '#1E1E1E'}
        stroke={isMatrix ? '#22C55E' : isPowerShell ? '#0284C7' : '#3F3F46'}
        strokeWidth="1.2"
      />
      {/* Top Titlebar Tab Strip */}
      <rect x="4" y="6" width="40" height="9" rx="6" fill={isPowerShell ? '#003380' : isMatrix ? '#064E3B' : '#2D2D2D'} />
      {/* Active Tab */}
      <rect x="8" y="8" width="12" height="6" rx="2" fill="#4B5563" fillOpacity="0.8" />
      <rect x="22" y="9" width="8" height="4" rx="1.5" fill="#374151" fillOpacity="0.6" />
      {/* Command Prompt Chevron '> ' and Underscore '_' */}
      <path
        d="M11 23L17 28L11 33"
        stroke={isMatrix ? '#22C55E' : isPowerShell ? '#38BDF8' : '#F3F4F6'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="20"
        y1="33"
        x2="31"
        y2="33"
        stroke={isMatrix ? '#22C55E' : '#F3F4F6'}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Image 3: Planetary Web Browser Icon */
export const WebBrowserIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'chrome-original') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <circle cx="24" cy="24" r="21" fill="#FFFFFF" />
        <path d="M24 3C15.8 3 8.7 7.7 5.2 14.5L14.6 30.8L24 14.5H44.8C40.8 7.6 33 3 24 3Z" fill="#EA4335" />
        <path d="M44.8 14.5H24L14.6 30.8L5.2 14.5C3.8 17.3 3 20.6 3 24C3 35.6 12.4 45 24 45C33.6 45 41.7 38.6 44.3 29.8L34.9 13.5L44.8 14.5Z" fill="#4285F4" />
        <path d="M45 24C45 20.6 44.2 17.3 42.8 14.5H24L33.4 30.8L24 45C35.6 45 45 35.6 45 24Z" fill="#FBBC05" />
        <path d="M24 45C12.4 45 3 35.6 3 24C3 20.6 3.8 17.3 5.2 14.5L14.6 30.8L24 45Z" fill="#34A853" />
        <circle cx="24" cy="24" r="9" fill="#FFFFFF" />
        <circle cx="24" cy="24" r="7" fill="#1A73E8" />
      </svg>
    );
  }

  if (variant === 'edge-wave') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <circle cx="24" cy="24" r="21" fill="#0078D4" />
        <path d="M12 24C12 17.3726 17.3726 12 24 12C30.6274 12 36 17.3726 36 24C36 30.6274 30.6274 36 24 36C18 36 14 31 16 26C18 21 24 21 24 21" stroke="#00F0FF" strokeWidth="4" strokeLinecap="round" />
        <circle cx="24" cy="24" r="5" fill="#10B981" />
      </svg>
    );
  }

  // Exact Image 3: Vibrant Sky-Blue Squircle with White/Blue Planetary Sphere & Orbit Ring
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="browser_bg_grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B4FF" />
          <stop offset="1" stopColor="#0088FF" />
        </linearGradient>
        <clipPath id="planet_clip">
          <circle cx="23.5" cy="24" r="13" />
        </clipPath>
      </defs>

      {/* Sky Blue Squircle Background */}
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#browser_bg_grad)" />

      {/* Back Half of Planetary Ring */}
      <g transform="rotate(-32 23.5 24)">
        <path
          d="M4 24C4 18.5 12.5 16 23.5 16C34.5 16 43 18.5 43 24"
          stroke="#E0F2FE"
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>

      {/* Planet Sphere Body */}
      <circle cx="23.5" cy="24" r="13" fill="#FFFFFF" />

      {/* Diagonal Shaded Half (Clipped to Planet) */}
      <g clipPath="url(#planet_clip)">
        {/* Soft Blue Tint on bottom-right half */}
        <path d="M10 37.5L37 10.5L37 38L10 38Z" fill="#BAE6FD" />
      </g>

      {/* Front Half of Planetary Ring */}
      <g transform="rotate(-32 23.5 24)">
        <path
          d="M43 24C43 29.5 34.5 32 23.5 32C12.5 32 4 29.5 4 24"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export const ChromeOriginalIcon = WebBrowserIcon;

/** Image 4: Resume / CV App Icon (Royal Blue Circle + White CV Document + Gold Checkmark Badge) */
export const WindowsResumeIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({
  size = 34,
  className = '',
  variant,
}) => {
  if (variant === 'resume-pdf') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
        <rect x="8" y="5" width="32" height="38" rx="4" fill="#DC2626" />
        <path d="M8 9C8 6.79086 9.79086 5 12 5H30L40 15V39C40 41.2091 38.2091 43 36 43H12C9.79086 43 8 41.2091 8 39V9Z" fill="#EF4444" />
        <polygon points="30,5 40,15 30,15" fill="#B91C1C" />
        <text x="24" y="30" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">PDF</text>
        <line x1="14" y1="35" x2="34" y2="35" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Exact Image 4: Royal Blue Circle with White Document, Bold "CV" Text and Yellow Verified Badge
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <defs>
        <linearGradient id="cv_badge_grad" x1="20" y1="20" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="0.6" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>

      {/* Royal Blue Circle Base */}
      <circle cx="24" cy="24" r="22" fill="#2563EB" />

      {/* Long Shadow 45-degree Angle */}
      <path
        d="M34 8L44 18L44 38L32 46L24 46L34 36Z"
        fill="#1D4ED8"
        fillOpacity="0.5"
      />
      <path
        d="M30 20L46 36L38 46L22 30Z"
        fill="#1E40AF"
        fillOpacity="0.4"
      />

      {/* White Document Base */}
      <path
        d="M16 8H34C35.1046 8 36 8.89543 36 10V38C36 39.1046 35.1046 40 34 40H13C11.8954 40 11 39.1046 11 38V13L16 8Z"
        fill="#FFFFFF"
      />

      {/* Document Folded Dog-Ear Top Left */}
      <polygon points="11,13 16,8 16,13" fill="#93C5FD" />

      {/* Bold "CV" Header Text */}
      <text
        x="26.5"
        y="17.5"
        fill="#3B82F6"
        fontSize="7.5"
        fontWeight="900"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="-0.2px"
      >
        CV
      </text>

      {/* Document Text Placeholder Lines */}
      <rect x="14" y="20.5" width="18" height="2.5" rx="0.5" fill="#BFDBFE" />
      <rect x="14" y="25" width="18" height="2.5" rx="0.5" fill="#BFDBFE" />
      <rect x="14" y="29.5" width="12" height="2.5" rx="0.5" fill="#BFDBFE" />
      <rect x="14" y="34" width="8" height="2.5" rx="0.5" fill="#BFDBFE" />

      {/* Golden Yellow Circle Badge at Bottom Right */}
      <circle cx="29" cy="29" r="9" fill="url(#cv_badge_grad)" />

      {/* Shadow overlay on right half of badge */}
      <path
        d="M29 20C33.9706 20 38 24.0294 38 29C38 33.9706 33.9706 38 29 38V20Z"
        fill="#D97706"
        fillOpacity="0.25"
      />

      {/* Bold Royal Blue Checkmark */}
      <path
        d="M24.5 29.5L27.5 33L34 25.5"
        stroke="#2563EB"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const WindowsCameraIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({ size = 34, className = '', variant }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
    <defs>
      <linearGradient id="win11_cam_lens_grad" x1="16" y1="18" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#C084FC" />
        <stop offset="0.35" stopColor="#818CF8" />
        <stop offset="0.7" stopColor="#38BDF8" />
        <stop offset="1" stopColor="#0284C7" />
      </linearGradient>
      <linearGradient id="win11_cam_body_grad" x1="4" y1="10" x2="44" y2="42" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3E4756" />
        <stop offset="0.5" stopColor="#333B47" />
        <stop offset="1" stopColor="#252C36" />
      </linearGradient>
    </defs>
    {/* Blue Shutter Button Top Left */}
    <rect x="9" y="7.5" width="10" height="4.5" rx="2" fill="#0078D4" />
    
    {/* Main Camera Body with Rounded Corners */}
    <rect x="4" y="11" width="40" height="30" rx="7.5" fill="url(#win11_cam_body_grad)" stroke="#475569" strokeWidth="0.8" />
    
    {/* Top-Right White Flash/Sensor Dot */}
    <circle cx="36.5" cy="18" r="2.2" fill="#FFFFFF" />
    
    {/* Central Large Lens with Thick White Outer Ring */}
    <circle cx="24" cy="26" r="10.5" fill="url(#win11_cam_lens_grad)" stroke="#FFFFFF" strokeWidth="3" />
    
    {/* Inner Lens Reflection Glint */}
    <path d="M19 21C20.5 19.5 22.5 19 24.5 19" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    <circle cx="28" cy="30" r="1.2" fill="#FFFFFF" opacity="0.6" />
  </svg>
);

export const WindowsAboutIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({ size = 34, className = '', variant }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
    <circle cx="24" cy="24" r="20" fill="#4F46E5" />
    <circle cx="24" cy="18" r="7" fill="#FFFFFF" />
    <path d="M10 38C10 30 16 28 24 28C32 28 38 30 38 38" fill="#E0E7FF" />
  </svg>
);

export const WindowsMinesweeperIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({ size = 34, className = '', variant }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
    <circle cx="24" cy="24" r="14" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
    <line x1="24" y1="4" x2="24" y2="44" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    <line x1="4" y1="24" x2="44" y2="24" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    <line x1="10" y1="10" x2="38" y2="38" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    <line x1="10" y1="38" x2="38" y2="10" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    <circle cx="20" cy="20" r="3" fill="#FFFFFF" fillOpacity="0.8" />
  </svg>
);

export const WindowsSnakeIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({ size = 34, className = '', variant }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
    <rect x="6" y="6" width="36" height="36" rx="8" fill="#065F46" />
    <path d="M12 32C12 24 20 24 20 16C20 12 24 8 30 8C36 8 36 16 30 16C26 16 26 24 34 24" stroke="#10B981" strokeWidth="5" strokeLinecap="round" />
    <circle cx="34" cy="24" r="3.5" fill="#34D399" />
    <circle cx="16" cy="36" r="4" fill="#EF4444" />
  </svg>
);

export const WindowsTaskManagerIcon: React.FC<{ size?: number; className?: string; variant?: string }> = ({ size = 34, className = '', variant }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
    <rect x="5" y="6" width="38" height="36" rx="6" fill="#042F2E" stroke="#0D9488" strokeWidth="1.5" />
    <path d="M8 24H16L20 14L26 34L30 20L34 26H40" stroke="#2DD4BF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WindowsZipFolderIcon: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
    <path d="M4 11C4 9.34315 5.34315 8 7 8H19L23 12H41C42.6569 12 44 13.3431 44 15V37C44 38.6569 42.6569 40 41 40H7C5.34315 40 4 38.6569 4 37V11Z" fill="#F59E0B" />
    <rect x="4" y="15" width="40" height="25" rx="3.5" fill="#FBBF24" stroke="#D97706" strokeWidth="0.75" />
    <rect x="4" y="23" width="40" height="6" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.5" />
  </svg>
);

export const ExtensionBadgeIcon: React.FC<{ ext: string; size?: number; className?: string }> = ({ ext, size = 34, className = '' }) => {
  const clean = (ext || '').replace('.', '').toUpperCase();
  let bg = '#3B82F6';
  if (['PDF'].includes(clean)) bg = '#DC2626';
  else if (['DOC', 'DOCX'].includes(clean)) bg = '#1D4ED8';
  else if (['XLS', 'XLSX', 'CSV'].includes(clean)) bg = '#15803D';
  else if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(clean)) bg = '#8B5CF6';
  else if (['JS', 'TS', 'TSX', 'JSX', 'PY', 'HTML', 'CSS', 'JSON'].includes(clean)) bg = '#0284C7';
  else if (['ZIP', 'RAR', '7Z', 'TAR'].includes(clean)) bg = '#D97706';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md select-none ${className}`}>
      <rect x="8" y="5" width="32" height="38" rx="4" fill={bg} />
      <polygon points="28,5 40,17 28,17" fill="white" fillOpacity="0.3" />
      <text x="24" y="32" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
        {clean.slice(0, 4)}
      </text>
    </svg>
  );
};

// ----------------------------------------------------
// NORMALIZED APP ID RESOLUTION HELPER
// ----------------------------------------------------

export const getNormalizedAppId = (appId?: string, name?: string): string => {
  const combined = `${appId || ''} ${name || ''}`.toLowerCase().trim();
  
  if (combined.includes('thispc') || combined.includes('this pc') || combined.includes('this-pc') || combined.includes('monitor') || combined.includes('computer')) {
    return 'thispc';
  }
  if (combined.includes('recycle') || combined.includes('trash') || combined.includes('wastebasket')) {
    return 'recycle';
  }
  if (combined.includes('camera')) {
    return 'camera';
  }
  if (combined.includes('setting') || combined.includes('slider')) {
    return 'settings';
  }
  if (combined.includes('calc')) {
    return 'calculator';
  }
  if (combined.includes('note') || combined.includes('text') || combined.includes('editor')) {
    return 'notepad';
  }
  if (combined.includes('photo') || combined.includes('media') || combined.includes('image') || combined.includes('gallery')) {
    return 'photos';
  }
  if (combined.includes('terminal') || combined.includes('powershell') || combined.includes('cmd') || combined.includes('console')) {
    return 'terminal';
  }
  if (combined.includes('browser') || combined.includes('globe') || combined.includes('chrome') || combined.includes('web')) {
    return 'browser';
  }
  if (combined.includes('resume') || combined.includes('cv')) {
    return 'resume';
  }
  if (combined.includes('project') || combined.includes('briefcase')) {
    return 'projects';
  }
  if (combined.includes('skill') || combined.includes('award') || combined.includes('tech')) {
    return 'skills';
  }
  if (combined.includes('about') || combined.includes('user') || combined.includes('profile')) {
    return 'about';
  }
  if (combined.includes('contact') || combined.includes('send') || combined.includes('mail') || combined.includes('message')) {
    return 'contact';
  }
  if (combined.includes('minesweep') || combined.includes('gamepad')) {
    return 'minesweeper';
  }
  if (combined.includes('snake')) {
    return 'snake';
  }
  if (combined.includes('taskmanager') || combined.includes('task manager') || combined.includes('cpu')) {
    return 'taskmanager';
  }
  if (combined.includes('explorer') || combined.includes('fileexplorer') || combined.includes('file explorer') || combined.includes('folderopen')) {
    return 'fileexplorer';
  }
  if (combined.includes('folder') || combined.includes('directory')) {
    return 'folder';
  }
  if (combined.includes('start') || combined.includes('windows')) {
    return 'start';
  }

  if (appId) return appId.toLowerCase().trim();
  if (name) return name.toLowerCase().trim();
  return '';
};

// ----------------------------------------------------
// MAIN APP ICON DISPATCHER
// ----------------------------------------------------

export interface AppIconProps {
  name?: string;
  className?: string;
  size?: number;
  color?: string;
  appId?: string;
  customVariant?: string;
  overrideStyle?: string;
}

const AdminControlCenterFluentIcon: React.FC<{ size: number; className: string }> = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`drop-shadow-md ${className}`} aria-hidden="true">
    <defs>
      <linearGradient id="admin_control_center_icon_bg" x1="5" y1="3" x2="43" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#08B6F2" />
        <stop offset="0.55" stopColor="#0875F5" />
        <stop offset="1" stopColor="#5739F4" />
      </linearGradient>
      <linearGradient id="admin_control_center_shield" x1="15" y1="11" x2="34" y2="37" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" />
        <stop offset="1" stopColor="#DBEAFE" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#admin_control_center_icon_bg)" />
    <path d="M24 9L35 13V21C35 28.2 30.4 34.7 24 37C17.6 34.7 13 28.2 13 21V13L24 9Z" fill="url(#admin_control_center_shield)" fillOpacity="0.2" stroke="url(#admin_control_center_shield)" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M19.5 23.5L22.5 26.5L29 19.5" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  className = 'w-5 h-5',
  size,
  color,
  appId,
  customVariant,
  overrideStyle,
}) => {
  const { settings } = useOS();
  const targetAppId = getNormalizedAppId(appId, name);
  const overrideVariant =
    overrideStyle ||
    customVariant ||
    (targetAppId && settings.customAppIcons ? settings.customAppIcons[targetAppId] : undefined);
  const iconName = name || appId || 'AppWindow';

  const isOutlineTint =
    overrideStyle === 'outline' ||
    customVariant === 'outline' ||
    (overrideStyle !== 'fluent_3d' && settings.iconStyleMode === 'outline_tint' && !customVariant);

  const activeColor =
    color ||
    (settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor || '#0078D4');

  if (targetAppId === 'admin') {
    if (isOutlineTint) return <Icons.ShieldCheck className={className} size={size || 34} color={activeColor} strokeWidth={1.8} />;
    return <AdminControlCenterFluentIcon size={size || 34} className={className} />;
  }

  // 1. File Extension Badges
  if (iconName.startsWith('ext:') || iconName.includes('.')) {
    const ext = iconName.replace('ext:', '');
    return <ExtensionBadgeIcon ext={ext} size={size || 34} className={className} />;
  }

  // Outline Mode for All Apps (Matching Option 1 with Color Tinting)
  if (isOutlineTint) {
    const iconProps = { className, size: size || 34, color: activeColor };
    if (targetAppId === 'start') return <Icons.LayoutGrid {...iconProps} />;
    if (targetAppId === 'thispc' || iconName === 'Monitor' || iconName === 'ThisPC' || iconName === 'This PC') {
      return <Icons.Monitor {...iconProps} />;
    }
    if (targetAppId === 'folder' || iconName === 'Folder') {
      return <Icons.Folder {...iconProps} />;
    }
    if (targetAppId === 'fileexplorer' || iconName === 'FileExplorer') {
      return <Icons.FolderOpen {...iconProps} />;
    }
    if (targetAppId === 'resume' || iconName === 'Resume' || iconName === 'CV' || iconName === 'ResumeCV') {
      return <Icons.FileCheck {...iconProps} />;
    }
    if (targetAppId === 'browser' || iconName === 'Globe' || iconName === 'Chrome' || iconName === 'Browser') {
      return <Icons.Globe {...iconProps} />;
    }
    if (targetAppId === 'terminal' || iconName === 'Terminal') {
      return <Icons.Terminal {...iconProps} />;
    }
    if (targetAppId === 'notepad' || iconName === 'Notepad' || iconName === 'FileText' || iconName === 'FileEdit') {
      return <Icons.FileText {...iconProps} />;
    }
    if (targetAppId === 'photos' || iconName === 'Image' || iconName === 'ImageIcon' || iconName === 'Photos' || iconName === 'Media') {
      return <Icons.Image {...iconProps} />;
    }
    if (targetAppId === 'camera' || iconName === 'Camera') {
      return <Icons.Camera {...iconProps} />;
    }
    if (targetAppId === 'settings' || iconName === 'Settings' || iconName === 'Sliders') {
      return <Icons.Settings {...iconProps} />;
    }
    if (targetAppId === 'calculator' || iconName === 'Calculator') {
      return <Icons.Calculator {...iconProps} />;
    }
    if (targetAppId === 'projects' || iconName === 'Projects' || iconName === 'Briefcase' || iconName === 'Project') {
      return <Icons.Briefcase {...iconProps} />;
    }
    if (targetAppId === 'skills' || iconName === 'Skills' || iconName === 'Award' || iconName === 'Skill') {
      return <Icons.Award {...iconProps} />;
    }
    if (targetAppId === 'about' || iconName === 'About' || iconName === 'User') {
      return <Icons.User {...iconProps} />;
    }
    if (targetAppId === 'contact' || iconName === 'Contact' || iconName === 'Send' || iconName === 'Mail') {
      return <Icons.Send {...iconProps} />;
    }
    if (targetAppId === 'minesweeper' || iconName === 'Minesweeper' || iconName === 'Gamepad2') {
      return <Icons.Gamepad2 {...iconProps} />;
    }
    if (targetAppId === 'snake' || iconName === 'Snake' || iconName === 'Sparkles') {
      return <Icons.Sparkles {...iconProps} />;
    }
    if (targetAppId === 'recycle' || targetAppId === 'recycle_bin' || targetAppId === 'trash' || iconName === 'Recycle' || iconName === 'RecycleBin' || iconName === 'Trash2') {
      return <Icons.Trash2 {...iconProps} />;
    }
    if (targetAppId === 'taskmanager' || iconName === 'TaskManager' || iconName === 'Cpu') {
      return <Icons.Cpu {...iconProps} />;
    }
    if (iconName === 'Download' || iconName === 'Downloads' || targetAppId === 'downloads') {
      return <Icons.Download {...iconProps} />;
    }
  }

  // 1. Start Menu Logo
  if (targetAppId === 'start' || iconName === 'Start' || iconName === 'StartMenu' || iconName === 'Windows') {
    return <WindowsStartLogo size={size || 24} className={className} />;
  }

  // 2. This PC (Desktop Computer / Monitor)
  if (
    targetAppId === 'thispc' ||
    targetAppId === 'this_pc' ||
    iconName === 'ThisPC' ||
    iconName === 'This PC' ||
    iconName === 'This-PC' ||
    iconName === 'Monitor' ||
    iconName === 'Computer'
  ) {
    return <ThisPCLogo size={size || 34} className={className} color={color} variant={overrideVariant} />;
  }

  // 3. Settings (Mechanical Gear with Blue Center)
  if (targetAppId === 'settings' || iconName === 'Settings' || iconName === 'Sliders') {
    return <WindowsSettingsIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 4. Folder (Smooth Yellow 3D Folder)
  if (
    targetAppId === 'folder' ||
    iconName === 'Folder' ||
    iconName === 'folder' ||
    iconName === 'FolderOpen' ||
    iconName === 'Directory'
  ) {
    return <WindowsFolderIcon size={size || 34} className={className} />;
  }

  // 5. File Explorer (Yellow Folder with Blue Tab)
  if (
    targetAppId === 'fileexplorer' ||
    targetAppId === 'explorer' ||
    iconName === 'FileExplorer' ||
    iconName === 'File Explorer' ||
    iconName === 'Explorer'
  ) {
    return <WindowsFileExplorerIcon size={size || 34} className={className} />;
  }

  // 6. Notepad (Sky-Blue Spiral Notebook with Stripes)
  if (targetAppId === 'notepad' || iconName === 'Notepad' || iconName === 'FileText' || iconName === 'FileEdit') {
    return <WindowsNotepadIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 7. Calculator (Slate Gray with Cyan LCD & Blue Action Button)
  if (targetAppId === 'calculator' || iconName === 'Calculator') {
    return <WindowsCalculatorIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 8. Recycle Bin (Frosted Glass Wastebasket with Blue Arrows)
  if (
    targetAppId === 'recycle' ||
    targetAppId === 'recycle_bin' ||
    targetAppId === 'trash' ||
    iconName === 'Recycle' ||
    iconName === 'RecycleBin' ||
    iconName === 'Recycle Bin' ||
    iconName === 'Trash2'
  ) {
    return <WindowsRecycleBinIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 9. Media App (Photos & Media: Mountain Silhouette with Sun)
  if (
    targetAppId === 'photos' ||
    targetAppId === 'media' ||
    iconName === 'Photos' ||
    iconName === 'Photo' ||
    iconName === 'Image' ||
    iconName === 'ImageIcon' ||
    iconName === 'Media' ||
    iconName === 'MediaApp' ||
    iconName === 'Media App'
  ) {
    return <WindowsPhotosIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 10. Contact Me (Blue Rounded Tile with Folded White Envelope)
  if (
    targetAppId === 'contact' ||
    iconName === 'Contact' ||
    iconName === 'ContactMe' ||
    iconName === 'Contact Me' ||
    iconName === 'Send' ||
    iconName === 'Mail'
  ) {
    return <WindowsContactIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 11. Project App (Blueprint Scroll with Rising Cyan Trend Chart)
  if (
    targetAppId === 'projects' ||
    iconName === 'Projects' ||
    iconName === 'Project' ||
    iconName === 'ProjectApp' ||
    iconName === 'Project App' ||
    iconName === 'Briefcase'
  ) {
    return <WindowsProjectsIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // 12. Skill & Tech (Golden 1st Place Award Medal with Roman Numeral I)
  if (
    targetAppId === 'skills' ||
    iconName === 'Skills' ||
    iconName === 'Skill' ||
    iconName === 'SkillTech' ||
    iconName === 'Skill & Tech' ||
    iconName === 'Skills & Tech' ||
    iconName === 'Award'
  ) {
    return <WindowsSkillsIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Resume / CV
  if (targetAppId === 'resume' || iconName === 'Resume' || iconName === 'CV' || iconName === 'ResumeCV') {
    return <WindowsResumeIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Web Browser
  if (targetAppId === 'browser' || iconName === 'Globe' || iconName === 'Chrome' || iconName === 'Browser') {
    return <ChromeOriginalIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Terminal
  if (targetAppId === 'terminal' || iconName === 'Terminal') {
    return <WindowsTerminalIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Camera
  if (targetAppId === 'camera' || iconName === 'Camera') {
    return <WindowsCameraIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // About Me
  if (targetAppId === 'about' || iconName === 'About' || iconName === 'User') {
    return <WindowsAboutIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Minesweeper
  if (targetAppId === 'minesweeper' || iconName === 'Minesweeper' || iconName === 'Gamepad2') {
    return <WindowsMinesweeperIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Snake
  if (targetAppId === 'snake' || iconName === 'Snake' || iconName === 'Sparkles') {
    return <WindowsSnakeIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Task Manager
  if (targetAppId === 'taskmanager' || iconName === 'TaskManager' || iconName === 'Cpu') {
    return <WindowsTaskManagerIcon size={size || 34} className={className} variant={overrideVariant} />;
  }

  // Zip Archive
  if (
    iconName === 'FileArchive' ||
    iconName === 'FolderArchive' ||
    iconName === 'Archive' ||
    iconName === 'zip' ||
    iconName === 'Zip' ||
    iconName === 'ZIP'
  ) {
    return <WindowsZipFolderIcon size={size || 34} className={className} />;
  }

  // Fallback / Lucide Icons
  const IconMap = Icons as unknown as Record<string, React.FC<any>>;
  const IconComponent =
    IconMap[iconName] ||
    IconMap[iconName.charAt(0).toUpperCase() + iconName.slice(1)] ||
    Icons.AppWindow;

  return <IconComponent className={className} size={size} color={color} />;
};
