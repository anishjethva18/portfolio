import React, { useEffect, useRef, useState } from 'react';
import { Mail, Trash2, Reply, X, LoaderCircle, Eye, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/dateTime';
import { apiFetch } from '../../utils/apiClient';
import { AdminPagination } from './AdminPagination';
import { useResponsivePageSize } from '../../hooks/useResponsivePageSize';

interface Contact {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    timestamp: string;
    status: 'delivered' | 'failed' | 'queued' | 'simulated' | 'replied';
    replied?: boolean;
    repliedAt?: string;
    replyMessage?: string;
    replyHistory?: Array<{ message: string; repliedAt: string }>;
}

export const ContactManagement: React.FC<{
    contacts: Contact[];
    loading?: boolean;
    onRefresh?: () => Promise<void>;
    onReply: (id: string, message: string) => Promise<void>;
    onDelete: (id: string) => Promise<boolean>;
}> = ({ contacts, loading = false, onRefresh, onReply, onDelete }) => {
    const [viewingContact, setViewingContact] = useState<Contact | null>(null);
    const [replyingTo, setReplyingTo] = useState<Contact | null>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [replyError, setReplyError] = useState('');
    const [replyBusy, setReplyBusy] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [testingSmtp, setTestingSmtp] = useState(false);
    const [refreshingInbox, setRefreshingInbox] = useState(false);
    const [smtpResult, setSmtpResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [page, setPage] = useState(1);
    const tableBodyRef = useRef<HTMLTableSectionElement>(null);
    const pageSize = useResponsivePageSize(10, 72, tableBodyRef);
    const pageCount = Math.max(1, Math.ceil(contacts.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visibleContacts = contacts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const viewingContactReplies = viewingContact?.replyHistory?.length
        ? viewingContact.replyHistory
        : viewingContact?.replyMessage
            ? [{ message: viewingContact.replyMessage, repliedAt: viewingContact.repliedAt || viewingContact.timestamp }]
            : [];

    useEffect(() => {
        setPage((current) => Math.min(current, Math.max(1, Math.ceil(contacts.length / pageSize))));
    }, [contacts.length, pageSize]);

    const handleVerifySmtp = async () => {
        setTestingSmtp(true);
        setSmtpResult(null);
        try {
            const verifyRes = await apiFetch('/api/admin/email/verify', { method: 'POST' });
            const verifyData = await verifyRes.json();
            if (verifyData.connected) {
                const sendRes = await apiFetch('/api/admin/email/test-send', { method: 'POST' });
                const sendData = await sendRes.json();
                setSmtpResult({
                    type: 'success',
                    message: `${verifyData.message} ${sendData.result?.note || 'Live test email verified.'}`,
                });
            } else {
                setSmtpResult({
                    type: verifyData.configured ? 'error' : 'info',
                    message: verifyData.message,
                });
            }
        } catch (err: any) {
            setSmtpResult({
                type: 'error',
                message: err.message || 'SMTP test failed.',
            });
        } finally {
            setTestingSmtp(false);
        }
    };

    const submitReply = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!replyingTo || replyBusy || !replyMessage.trim()) return;
        setReplyBusy(true);
        setReplyError('');
        try {
            await onReply(replyingTo.id, replyMessage.trim());
            setReplyingTo(null);
            setReplyMessage('');
        } catch (cause) {
            setReplyError(cause instanceof Error ? cause.message : 'The reply could not be sent.');
        } finally {
            setReplyBusy(false);
        }
    };

    const openReply = (contact: Contact) => {
        setViewingContact(null);
        setReplyingTo(contact);
        setReplyMessage('');
        setReplyError('');
    };

    const deleteContact = async (id: string) => {
        if (deletingId) return;
        setDeletingId(id);
        try {
            await onDelete(id);
        } finally {
            setDeletingId(null);
        }
    };

    const refreshInbox = async () => {
        if (!onRefresh || refreshingInbox) return;
        setRefreshingInbox(true);
        const startedAt = Date.now();
        try { await onRefresh(); }
        finally {
            window.setTimeout(() => setRefreshingInbox(false), Math.max(0, 400 - (Date.now() - startedAt)));
        }
    };

    return (
        <div className="space-y-6">
            <div className="admin-page-heading flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.17em] text-sky-600">Manage your portfolio</p>
                    <h1 className="text-[clamp(25px,3vw,34px)] font-bold tracking-tight text-slate-900">Messages</h1>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">Review contact requests and reply to prospective clients.</p>
                </div>
                <div className="flex items-center gap-2">
                    {onRefresh && <button type="button" onClick={() => void refreshInbox()} disabled={loading || refreshingInbox} className="admin-action-button inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={14} className={loading || refreshingInbox ? 'animate-spin' : ''} />Refresh inbox</button>}
                    <button
                        type="button"
                        onClick={() => void handleVerifySmtp()}
                        disabled={testingSmtp}
                        className="admin-action-button inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                    >
                        {testingSmtp ? <LoaderCircle size={14} className="animate-spin" /> : <Mail size={14} />}
                        {testingSmtp ? 'Testing SMTP…' : 'Test Live SMTP Delivery'}
                    </button>
                </div>
            </div>

            {smtpResult && (
                <div className={`rounded-xl border p-3.5 text-xs flex items-start justify-between gap-3 ${
                    smtpResult.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                    smtpResult.type === 'info' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                    'border-rose-200 bg-rose-50 text-rose-800'
                }`}>
                    <div className="flex items-start gap-2.5">
                        {smtpResult.type === 'success' ? (
                            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                        ) : (
                            <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                        )}
                        <div>
                            <p className="font-semibold leading-relaxed">{smtpResult.message}</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setSmtpResult(null)} className="text-slate-400 hover:text-slate-900">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="admin-content-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="p-4 font-semibold text-slate-500">Date</th>
                                <th className="p-4 font-semibold text-slate-500">Sender</th>
                                <th className="p-4 font-semibold text-slate-500">Message</th>
                                <th className="p-4 font-semibold text-slate-500">Status</th>
                                <th className="p-4 text-right font-semibold text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody ref={tableBodyRef} className="contact-messages-table-body divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-500"><span role="status" className="inline-flex items-center gap-2"><LoaderCircle size={15} className="animate-spin" />Loading contact messages...</span></td></tr>
                            ) : contacts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center">
                                        <Mail className="mx-auto h-8 w-8 text-slate-300" />
                                        <p className="mt-2 text-sm font-semibold text-slate-700">Your inbox is empty</p>
                                        <p className="mt-1 text-xs text-slate-500">Messages submitted through the public Contact app will appear here.</p>
                                    </td>
                                </tr>
                            ) : (
                                visibleContacts.map((contact) => (
                                    <tr key={contact.id} className="group transition-colors hover:bg-sky-50/40">
                                        <td className="whitespace-nowrap p-4 text-slate-500">
                                            {formatDate(contact.timestamp)}
                                            <div className="text-[10px] text-slate-400">
                                                {formatTime(contact.timestamp)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{contact.name}</div>
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Mail size={10} />
                                                {contact.email}
                                            </div>
                                        </td>
                                        <td className="max-w-sm p-4">
                                            <div className="font-semibold text-slate-800">{contact.subject || '(No subject)'}</div>
                                            <p className="mt-1 line-clamp-2 break-words text-[10px] leading-relaxed text-slate-500">{contact.message}</p>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                contact.status === 'replied' || contact.replied 
                                                ? 'bg-emerald-50 text-emerald-700' 
                                                : contact.status === 'delivered'
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'bg-amber-50 text-amber-700'
                                            }`}>
                                                {contact.replied ? 'Replied' : contact.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingContact(contact)}
                                                    className="admin-action-button inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                    title={`View message from ${contact.name}`}
                                                    aria-label={`View message from ${contact.name}`}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void deleteContact(contact.id)}
                                                    disabled={Boolean(deletingId)}
                                                    className="admin-action-button inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                                    title="Delete"
                                                    aria-label={`Delete message from ${contact.name}`}
                                                >
                                                    {deletingId === contact.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <AdminPagination page={currentPage} pageSize={pageSize} totalItems={contacts.length} onPageChange={setPage} />
            {viewingContact && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 pb-20 sm:p-4 sm:pb-20" role="presentation">
                    <section role="dialog" aria-modal="true" aria-labelledby="contact-details-title" className="flex max-h-[calc(100dvh-6rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-6">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Contact message</p>
                                <h3 id="contact-details-title" className="mt-1 break-words text-lg font-bold text-slate-900">{viewingContact.subject || '(No subject)'}</h3>
                            </div>
                            <button type="button" onClick={() => setViewingContact(null)} aria-label="Close message details" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
                        <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
                            <div className="min-w-0"><dt className="text-slate-500">Sender</dt><dd className="mt-1 break-words font-semibold text-slate-800">{viewingContact.name}</dd></div>
                            <div className="min-w-0"><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-800">{viewingContact.email}</dd></div>
                            <div><dt className="text-slate-500">Received</dt><dd className="mt-1 text-slate-800">{formatDate(viewingContact.timestamp)} · {formatTime(viewingContact.timestamp)}</dd></div>
                            <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-semibold uppercase text-slate-800">{viewingContact.replied ? 'Replied' : viewingContact.status}</dd></div>
                        </dl>
                        <div>
                            <h4 className="mb-2 text-xs font-semibold text-slate-700">Full message</h4>
                            <p className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">{viewingContact.message}</p>
                        </div>
                        {viewingContactReplies.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-xs font-semibold text-slate-700">Your replies ({viewingContactReplies.length})</h4>
                                <div className="space-y-3">
                                    {viewingContactReplies.map((reply, index) => (
                                        <div key={`${reply.repliedAt}-${index}`}>
                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-[10px] font-semibold text-emerald-700">Reply {index + 1}</span>
                                                <span className="text-[10px] text-slate-500">{formatDate(reply.repliedAt)} · {formatTime(reply.repliedAt)}</span>
                                            </div>
                                            <p className="whitespace-pre-wrap break-words rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-relaxed text-slate-800">{reply.message}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white p-4 sm:px-6">
                            <button type="button" onClick={() => setViewingContact(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                            <button type="button" onClick={() => openReply(viewingContact)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"><Reply size={14} />Reply</button>
                        </div>
                    </section>
                </div>
            )}
            {replyingTo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
                    <form onSubmit={(event) => void submitReply(event)} role="dialog" aria-modal="true" aria-labelledby="contact-reply-title" className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-700 bg-[#11141c] p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 id="contact-reply-title" className="text-base font-bold text-white">Reply to {replyingTo.name}</h3>
                                <p className="mt-1 break-all text-xs text-slate-400">{replyingTo.email} · {replyingTo.subject}</p>
                            </div>
                            <button type="button" onClick={() => setReplyingTo(null)} disabled={replyBusy} aria-label="Close reply" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50">
                                <X size={16} />
                            </button>
                        </div>
                        <label htmlFor="contact-reply-message" className="block text-xs font-semibold text-slate-300">Message</label>
                        <textarea
                            id="contact-reply-message"
                            value={replyMessage}
                            onChange={(event) => setReplyMessage(event.target.value)}
                            required
                            maxLength={10000}
                            rows={7}
                            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-blue-500"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[10px] text-slate-500">{replyMessage.length}/10000 characters</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setReplyingTo(null)} disabled={replyBusy} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={replyBusy || !replyMessage.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                                    {replyBusy && <LoaderCircle size={14} className="animate-spin" />}
                                    {replyBusy ? 'Sending...' : 'Send reply'}
                                </button>
                            </div>
                        </div>
                        {replyError && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{replyError}</div>}
                    </form>
                </div>
            )}
        </div>
    );
};
