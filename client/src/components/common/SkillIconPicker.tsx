import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Upload } from 'lucide-react';
import { SkillBrandIcon } from './SkillBrandIcon';
import { GENERIC_SKILL_ICON_OPTIONS } from '../../utils/skillIcons';
import { uploadPortfolioMedia } from '../../utils/uploadPortfolioMedia';

interface SkillIconPickerProps {
  name?: string;
  value: string;
  onChange: (value: string) => void;
}

interface BrandIconOption {
  slug: string;
  title: string;
}

const PAGE_SIZE = 60;
const REQUIRED_TECHNOLOGY_ICONS = [
  ['simple:c', 'C'] as const,
  ['custom:csharp', 'C#'] as const,
  ['simple:anaconda', 'Anaconda'] as const,
];

export const SkillIconPicker: React.FC<SkillIconPickerProps> = ({ name, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [brandIcons, setBrandIcons] = useState<BrandIconOption[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [manualUploadError, setManualUploadError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState(value.startsWith('image:') ? value.slice('image:'.length) : '');
  const [uploadingManualIcon, setUploadingManualIcon] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value.startsWith('image:')) {
      setManualUrl(value.slice('image:'.length));
      setManualOpen(true);
    }
  }, [value]);
  const genericOptions = GENERIC_SKILL_ICON_OPTIONS;
  const options = useMemo(() => {
    const uniqueOptions = new Map<string, readonly [string, string]>();
    [
      ['manual:', 'Manual icon (URL or upload)'] as const,
      ...brandIcons.map(({ slug, title }) => [`simple:${slug}`, title] as const),
      ...REQUIRED_TECHNOLOGY_ICONS,
      ...genericOptions,
    ].forEach(([identifier, title]) => {
      if (!uniqueOptions.has(identifier)) uniqueOptions.set(identifier, [identifier, title]);
    });
    return [...uniqueOptions.values()].sort((left, right) =>
      left[0] === 'manual:' ? -1 : right[0] === 'manual:' ? 1 :
        left[1].localeCompare(right[1], undefined, { sensitivity: 'base' })
    );
  }, [brandIcons, genericOptions]);
  const selected = options.find(([identifier]) => identifier === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? options.filter(([, label]) => label.toLocaleLowerCase().includes(normalizedQuery))
      : options;
  }, [options, query]);
  const visibleOptions = filteredOptions.slice(0, visibleCount);
  const selectedLabel = value.startsWith('image:') ? 'Manual icon' : selected?.[1] || (value.startsWith('simple:') ? value.slice('simple:'.length) : 'Choose an icon');
  const isManualUrlValid = (candidate: string) => {
    const trimmed = candidate.trim();
    if (/^\/api\/portfolio-media\/[A-Za-z0-9._~-]+$/.test(trimmed)) return true;
    try {
      const parsed = new URL(trimmed);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  };

  const loadIconCatalog = async () => {
    setLoadingIcons(true);
    setLoadError('');
    try {
      const response = await fetch('/api/profile/skill-icons?catalog=it-v2', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Icon catalog unavailable (HTTP ${response.status}). Restart the portfolio server, then retry.`);
      }
      const data = await response.json();
      if (!data.success || !Array.isArray(data.icons)) {
        throw new Error(data.error || 'The icon catalog returned invalid data.');
      }
      if (data.icons.length > 200 || data.icons.some((icon: unknown) =>
        !icon || typeof icon !== 'object' || !('slug' in icon) || !('title' in icon) ||
        typeof icon.slug !== 'string' || typeof icon.title !== 'string'
      )) {
        throw new Error('The technology icon catalog is invalid or contains too many entries.');
      }
      setBrandIcons(data.icons);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Technology icons could not be loaded.');
    } finally {
      setLoadingIcons(false);
    }
  };

  const openPicker = () => {
    if (open) {
      if (manualOpen) {
        setManualOpen(false);
        setManualUrl('');
        setQuery('');
        if (value.startsWith('image:')) onChange('');
        return;
      }
      setOpen(false);
      return;
    }
    setOpen(true);
    if (manualOpen) {
      setManualOpen(false);
      setManualUrl('');
      if (value.startsWith('image:')) onChange('');
    }
    setQuery('');
    setVisibleCount(PAGE_SIZE);
    setLoadError('');
    if (brandIcons.length) return;
    void loadIconCatalog();
  };

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={openPicker}
        className="skill-icon-picker-trigger flex min-h-10 w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs text-white transition-colors hover:border-sky-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        {value && <SkillBrandIcon name={selectedLabel} iconIdentifier={value} className="h-5 w-5 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="skill-icon-picker-menu mt-1 min-w-0 overflow-hidden rounded-xl border border-slate-600 bg-[#11141c] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
            <button
              type="button"
              aria-label={manualOpen ? 'Return to technology icon list' : 'Focus technology icon search'}
              title={manualOpen ? 'Return to icon list' : 'Search icons'}
              onClick={() => {
                if (manualOpen) {
                  setManualOpen(false);
                  setManualUrl('');
                  setQuery('');
                  if (value.startsWith('image:')) onChange('');
                  return;
                }
                searchInputRef.current?.focus();
              }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <Search className="h-4 w-4" />
            </button>
            <input
              ref={searchInputRef}
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder={`Search ${(brandIcons.length + genericOptions.length).toLocaleString()} icons`}
              aria-label="Search technology icons"
              className="skill-icon-picker-search min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </div>
          {manualOpen && (
            <div className="space-y-2 border-b border-slate-700 p-2.5">
              <label className="block text-[10px] font-semibold text-slate-300" htmlFor="manual-skill-icon-url">Manual icon URL</label>
              <input
                id="manual-skill-icon-url"
                type="text"
                inputMode="url"
                value={manualUrl}
                onChange={(event) => {
                  const next = event.target.value;
                  setManualUrl(next);
                  if (isManualUrlValid(next)) onChange(`image:${next.trim()}`);
                }}
                placeholder="https://… or /api/portfolio-media/…"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none focus:border-sky-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 text-[10px] font-semibold text-slate-200 transition hover:border-sky-400 hover:bg-slate-800">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingManualIcon ? 'Uploading…' : 'Upload icon'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
                    disabled={uploadingManualIcon}
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = '';
                      if (!file) return;
                      setUploadingManualIcon(true);
                      setManualUploadError('');
                      try {
                        const url = await uploadPortfolioMedia(file, 'profile');
                        setManualUrl(url);
                        onChange(`image:${url}`);
                      } catch (error) {
                        setManualUploadError(error instanceof Error ? error.message : 'Manual icon upload failed.');
                      } finally {
                        setUploadingManualIcon(false);
                      }
                    }}
                    className="sr-only"
                  />
                </label>
                {value.startsWith('image:') && <span className="text-[10px] text-emerald-300">Manual icon selected</span>}
              </div>
              {manualUrl && !isManualUrlValid(manualUrl) && <p role="alert" className="text-[10px] text-rose-300">Enter an http(s) URL or a portfolio media URL.</p>}
              {manualUploadError && <p role="alert" className="text-[10px] text-rose-300">{manualUploadError}</p>}
              {value.startsWith('image:') && <div className="flex items-center gap-2 text-[10px] text-slate-400"><SkillBrandIcon name={name || 'Manual icon'} iconIdentifier={value} className="h-7 w-7" />Preview</div>}
            </div>
          )}
          {!manualOpen && <div
            role="listbox"
            aria-label="Technology icons, alphabetically sorted"
            className="max-h-[min(12rem,35dvh)] overflow-y-auto overscroll-contain p-1 sm:max-h-48"
            onScroll={(event) => {
              const element = event.currentTarget;
              if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24) {
                setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredOptions.length));
              }
            }}
          >
            {loadingIcons && <p role="status" className="px-3 py-5 text-center text-xs text-slate-400">Loading local brand icons...</p>}
            {loadError && (
              <div role="alert" className="space-y-2 px-3 py-3 text-center text-xs text-rose-300">
                <p>{loadError}</p>
                <button type="button" onClick={() => void loadIconCatalog()} className="rounded-md border border-current px-2.5 py-1.5 font-semibold text-current transition-colors hover:bg-slate-700 hover:text-white">
                  Retry loading icons
                </button>
              </div>
            )}
            {!loadingIcons && visibleOptions.map(([identifier, label]) => (
              <button
                key={`${identifier}:${label}`}
                type="button"
                role="option"
                aria-selected={identifier === value}
                onClick={() => {
                  if (identifier === 'manual:') {
                    setManualOpen(true);
                    setQuery('');
                    if (isManualUrlValid(manualUrl)) onChange(`image:${manualUrl.trim()}`);
                    return;
                  }
                  onChange(identifier);
                  setManualOpen(false);
                  setOpen(false);
                }}
                className="skill-icon-picker-option flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:bg-slate-800 focus-visible:outline-none"
              >
                {identifier !== 'manual:' && <SkillBrandIcon name={label} iconIdentifier={identifier} className="h-5 w-5 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {identifier === value && <Check className="h-4 w-4 shrink-0 text-sky-400" />}
              </button>
            ))}
            {!loadingIcons && visibleOptions.length === 0 && <p className="px-3 py-5 text-center text-xs text-slate-400">No icons match that search.</p>}
            {!loadingIcons && !loadError && visibleOptions.length < filteredOptions.length && (
              <p className="px-3 py-2 text-center text-[10px] text-slate-500">
                Scroll to browse more ({filteredOptions.length.toLocaleString()} matches)
              </p>
            )}
          </div>}
        </div>
      )}
    </div>
  );
};
