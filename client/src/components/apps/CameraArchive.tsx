import React, { useState } from 'react';
import { Camera, Download, Trash2, Eye, X, AlertCircle, Film } from 'lucide-react';
import { formatAdminDateTime } from '../../utils/dateTime';
import { VideoFrameThumbnail } from '../common/MediaThumbnail';
import { AdminPagination } from './AdminPagination';

const ArchiveThumbnail: React.FC<{
    item: any;
}> = ({ item }) => {
    const url = `/api/admin/archives/${encodeURIComponent(item.id)}/preview`;

    return (
        <div className="relative grid h-40 place-items-center overflow-hidden border-b border-slate-700/60 bg-gradient-to-br from-slate-900 to-slate-800">
            {item.mediaType === 'video'
                ? <VideoFrameThumbnail src={url} name={item.fileName} className="h-full w-full" />
                : <img src={url} alt={`Preview of ${item.fileName}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />}
            {item.mediaType === 'video' && <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[9px] font-bold uppercase text-white"><Film className="inline h-3 w-3" /> Video</span>}
        </div>
    );
};

export const CameraArchive: React.FC<{
    archives: any[];
    onDelete: (id: string) => void;
    onDownload: (id: string) => void;
    listRef: React.RefObject<HTMLDivElement | null>;
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
}> = ({ archives, onDelete, onDownload, listRef, page, pageSize, totalItems, onPageChange }) => {
    const [preview, setPreview] = useState<any | null>(null);
    const [previewError, setPreviewError] = useState('');
    const previewUrl = preview ? `/api/admin/archives/${encodeURIComponent(preview.id)}/preview` : null;

    return (
        <div className="space-y-4">
            {archives.length === 0
                ? <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-700 bg-[#11141c] p-5 text-center text-sm text-slate-400">No camera captures have been archived yet.</div>
                : <div ref={listRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {archives.map(item => {
                            const timestamp = item.timestamp || item.createdAt;
                            const parsedTimestamp = timestamp ? new Date(timestamp) : null;
                            const dateLabel = parsedTimestamp && Number.isFinite(parsedTimestamp.getTime())
                                ? formatAdminDateTime(parsedTimestamp)
                                : 'Unknown date';
                            return (
                            <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-800/70 bg-[#11141c] shadow-sm transition hover:border-slate-700 hover:shadow-lg">
                                <ArchiveThumbnail item={item} />
                                <div className="space-y-3 p-4">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-xs font-semibold text-white" title={item.fileName}>{item.fileName}</h3>
                                            <p className="mt-1 truncate text-[10px] text-slate-400">{item.ownerName || 'Portfolio visitor'} · {dateLabel}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">{item.mediaType}</span>
                                    </div>
                                    <div className="flex items-center gap-2 border-t border-slate-800/70 pt-3">
                                        <button onClick={() => { setPreviewError(''); setPreview(item); }} title="View capture" aria-label={`View ${item.fileName}`} className="admin-capture-action inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold"><Eye className="h-3.5 w-3.5"/>View</button>
                                        <button onClick={() => onDownload(item.id)} title="Download capture" aria-label={`Download ${item.fileName}`} className="admin-capture-action grid h-9 w-9 place-items-center rounded-lg"><Download className="h-4 w-4"/></button>
                                        <button onClick={() => onDelete(item.id)} title="Delete archive permanently" aria-label={`Delete ${item.fileName}`} className="admin-capture-action admin-capture-action--delete grid h-9 w-9 place-items-center rounded-lg"><Trash2 className="h-4 w-4"/></button>
                                    </div>
                                </div>
                            </article>
                        );})}
                </div>}
            <AdminPagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} theme="dark" />
            {preview && (
                <div className="fixed inset-x-0 top-0 bottom-12 z-[3000] flex items-center justify-center overflow-hidden bg-black/80 p-2 sm:p-4" role="presentation" onClick={() => setPreview(null)}>
                    <section role="dialog" aria-modal="true" aria-label={`View ${preview.fileName}`} onClick={(event) => event.stopPropagation()} className="relative flex max-h-full min-h-0 w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-[#11141c] p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-4 py-3"><div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white"><Camera className="h-4 w-4 shrink-0 text-sky-400"/><span className="truncate">{preview.fileName}</span></div><button onClick={() => setPreview(null)} aria-label="Close preview" className="admin-capture-close grid h-9 w-9 place-items-center rounded-lg border border-slate-600 text-slate-200 transition-colors"><X className="h-4 w-4"/></button></div>
                        <div className="flex h-[65vh] max-h-[calc(100dvh-11rem)] min-h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/30">
                            {previewError ? <div role="alert" className="flex max-w-lg items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{previewError}</div>
                                : previewUrl && (preview.mediaType === 'video'
                                    ? <video src={previewUrl} controls autoPlay playsInline preload="metadata" onError={() => setPreviewError('This archived video could not be decoded by the browser.')} className="h-full w-full object-contain" />
                                    : <img src={previewUrl} alt={preview.fileName} onError={() => setPreviewError('The archived image could not be loaded.')} className="max-h-full max-w-full object-contain" />)}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};
