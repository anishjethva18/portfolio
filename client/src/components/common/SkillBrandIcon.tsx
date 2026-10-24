import React, { useEffect, useState } from 'react';
import { faAws, faJava, faLinux, faOpenai } from '@fortawesome/free-brands-svg-icons';
import {
  BrainCircuit,
  ChartNoAxesCombined,
  Code2,
  Database,
  Lightbulb,
  MessagesSquare,
  Network,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSkillIconIdentifier } from '../../utils/skillIcons';

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  'lucide:BrainCircuit': BrainCircuit,
  'lucide:ChartNoAxesCombined': ChartNoAxesCombined,
  'lucide:Code2': Code2,
  'lucide:Database': Database,
  'lucide:Lightbulb': Lightbulb,
  'lucide:MessagesSquare': MessagesSquare,
  'lucide:Network': Network,
  'lucide:ShieldCheck': ShieldCheck,
};

const CUSTOM_BRAND_ICONS: Record<string, typeof faJava> = {
  'custom:aws': faAws,
  'custom:java': faJava,
  'custom:linux': faLinux,
  'custom:openai': faOpenai,
};

const getSafeManualIconUrl = (identifier: string): string => {
  if (!identifier.startsWith('image:')) return '';
  const value = identifier.slice('image:'.length).trim();
  if (/^\/api\/portfolio-media\/[A-Za-z0-9._~-]+$/.test(value)) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
};

export const SkillBrandIcon: React.FC<{
  name: string;
  iconIdentifier?: string;
  className?: string;
}> = ({ name, iconIdentifier, className = 'h-8 w-8' }) => {
  const detectedIdentifier = getSkillIconIdentifier(name);
  const storedIdentifier = iconIdentifier;
  const identifier = !storedIdentifier || (storedIdentifier.startsWith('lucide:') && (detectedIdentifier.startsWith('simple:') || detectedIdentifier.startsWith('custom:')))
    ? detectedIdentifier
    : storedIdentifier;
  const brandSlug = identifier.startsWith('simple:') ? identifier.slice('simple:'.length) : '';
  const isVsCode = identifier === 'custom:vscode';
  const manualIconUrl = getSafeManualIconUrl(identifier);
  const customBrandIcon = CUSTOM_BRAND_ICONS[identifier];
  const isCSharp = identifier === 'custom:csharp';
  const customBrandPaths = customBrandIcon
    ? Array.isArray(customBrandIcon.icon[4]) ? customBrandIcon.icon[4] : [customBrandIcon.icon[4]]
    : [];
  const [brandIconFailed, setBrandIconFailed] = useState(false);
  const FallbackIcon = FALLBACK_ICONS[identifier] || Code2;

  useEffect(() => setBrandIconFailed(false), [identifier, manualIconUrl]);

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden ${brandSlug || isCSharp || manualIconUrl ? 'skill-brand-icon-tile rounded-md p-1' : ''} ${className}`} aria-hidden="true">
      {isVsCode
        ? <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true"><path fill="#007ACC" d="M17.2 1.2 9.4 8.3 4.3 4.4 1 5.7v12.6l3.3 1.3 5.1-3.9 7.9 7.1 5.8-2.2V3.4l-5.9-2.2ZM4.3 8.1l3.8 3.9-3.8 3.9V8.1Zm4.8 3.9 7-6.1v12.2l-7-6.1Zm10.9 7.3-7.2-6.3 7.2-6.3v12.6Z" /></svg>
        : isCSharp
        ? <svg viewBox="0 0 128 128" className="h-full w-full" aria-hidden="true"><path fill="#9B4F96" d="M115.4 30.7 67.1 2.9c-.8-.5-1.9-.7-3.1-.7-1.2 0-2.3.3-3.1.7l-48 27.9c-1.7 1-2.9 3.5-2.9 5.4v55.7c0 1.1.2 2.4 1 3.5l106.8-62c-.6-1.2-1.5-2.1-2.4-2.7z" /><path fill="#68217A" d="M10.7 95.3c.5.8 1.2 1.5 1.9 1.9l48.2 27.9c.8.5 1.9.7 3.1.7 1.2 0 2.3-.3 3.1-.7l48-27.9c1.7-1 2.9-3.5 2.9-5.4V36.1c0-.9-.1-1.9-.6-2.8l-106.6 62z" /><path fill="#fff" d="M85.3 76.1C81.1 83.5 73.1 88.5 64 88.5c-13.5 0-24.5-11-24.5-24.5s11-24.5 24.5-24.5c9.1 0 17.1 5 21.3 12.5l13-7.5c-6.8-11.9-19.6-20-34.3-20-21.8 0-39.5 17.7-39.5 39.5s17.7 39.5 39.5 39.5c14.6 0 27.4-8 34.2-19.8l-12.9-7.6zM97 66.2l.9-4.3h-4.2v-4.7h5.1L100 51h4.9l-1.2 6.1h3.8l1.2-6.1h4.8l-1.2 6.1h2.4v4.7h-3.3l-.9 4.3h4.2v4.7h-5.1l-1.2 6h-4.9l1.2-6h-3.8l-1.2 6h-4.8l1.2-6h-2.4v-4.7H97zm4.8 0h3.8l.9-4.3h-3.8l-.9 4.3z" /></svg>
        : manualIconUrl && !brandIconFailed
        ? <img src={manualIconUrl} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setBrandIconFailed(true)} />
        : customBrandIcon
        ? <svg viewBox={`0 0 ${customBrandIcon.icon[0]} ${customBrandIcon.icon[1]}`} className="h-full w-full text-current" aria-hidden="true">{customBrandPaths.map((path, index) => <path key={index} fill="currentColor" d={path} />)}</svg>
        : brandSlug && !brandIconFailed
        ? <img src={`/api/profile/skill-icons/${encodeURIComponent(brandSlug)}.svg`} alt="" loading="lazy" className="h-full w-full" onError={() => setBrandIconFailed(true)} />
        : <FallbackIcon className="h-3/4 w-3/4 text-slate-500 dark:text-slate-300" />}
    </span>
  );
};
