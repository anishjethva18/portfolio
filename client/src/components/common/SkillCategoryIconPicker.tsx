import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CATEGORY_ICON_OPTIONS } from '../../utils/skillIcons';
import { SkillCategoryIcon } from './SkillCategoryIcon';

interface SkillCategoryIconPickerProps {
  category: string;
  value: string;
  onChange: (value: string) => void;
}

export const SkillCategoryIconPicker: React.FC<SkillCategoryIconPickerProps> = ({ category, value, onChange }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="skill-category-icon-trigger flex min-h-10 w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs text-white transition-colors hover:border-sky-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        <SkillCategoryIcon name={value} category={category} className="h-5 w-5 shrink-0 text-sky-500" />
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="skill-category-icon-menu mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-slate-600 bg-[#11141c] p-1 shadow-xl" role="listbox" aria-label="Category icons">
          {CATEGORY_ICON_OPTIONS.map((iconName) => (
            <button
              key={iconName}
              type="button"
              role="option"
              aria-selected={iconName === value}
              onClick={() => {
                onChange(iconName);
                setOpen(false);
              }}
              className="skill-category-icon-option flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:bg-slate-800 focus-visible:outline-none"
            >
              <SkillCategoryIcon name={iconName} category={category} className="h-4 w-4 shrink-0 text-sky-500" />
              <span className="min-w-0 flex-1 truncate">{iconName}</span>
              {iconName === value && <Check className="h-4 w-4 shrink-0 text-sky-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
