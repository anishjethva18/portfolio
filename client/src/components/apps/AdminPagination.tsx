import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const AdminPagination: React.FC<{
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  theme?: 'light' | 'dark';
  showItemProgress?: boolean;
}> = ({ page, pageSize, totalItems, onPageChange, theme = 'light', showItemProgress = false }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const currentPage = Math.max(1, Math.min(page, totalPages));
  const isLight = theme === 'light';
  const border = isLight ? 'border-slate-200' : 'border-slate-700';
  const text = isLight ? 'text-slate-500' : 'text-slate-400';
  const button = isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800';

  return (
    <nav aria-label="Pagination" className={`admin-pagination mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs ${border}`}>
      <span className={text}>
        Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border ${border} px-2.5 font-semibold ${text} ${button} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <span aria-current="page" className={`min-w-12 text-center font-semibold ${text}`}>
          {showItemProgress
            ? `${Math.min(currentPage * pageSize, totalItems)} / ${totalItems}`
            : `${currentPage} / ${totalPages}`}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border ${border} px-2.5 font-semibold ${text} ${button} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
};
