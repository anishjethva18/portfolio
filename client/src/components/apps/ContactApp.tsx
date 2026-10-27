import React, { useEffect, useRef, useState } from 'react';
import { useOS } from '../../context/OSContext';
import { ContactSubmissionResponse } from '../../types';
import { usePublishedProfile } from '../../hooks/usePublishedProfile';
import { AlertCircle, ArrowUpRight, CheckCircle2, ExternalLink, File, Github, Instagram, Linkedin, Mail, MapPin, Paperclip, Phone, Send, ShieldCheck, Sparkles, Twitter, X, type LucideIcon } from 'lucide-react';

export interface ContactAttachment {
  name: string;
  path?: string;
  size?: string;
  type?: string;
  content?: string;
}

interface ContactAppProps {
  initialMessage?: string;
  initialSubject?: string;
  initialAttachments?: ContactAttachment[];
}

export const ContactApp: React.FC<ContactAppProps> = ({ initialMessage = '', initialSubject = '', initialAttachments = [] }) => {
  const { addNotification, sendContactMessage } = useOS();
  const { profile: portfolioUser } = usePublishedProfile();
  const [formData, setFormData] = useState({ name: '', email: '', subject: initialSubject, message: initialMessage, _honeypot: '' });
  const [attachments, setAttachments] = useState<ContactAttachment[]>(initialAttachments);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [lastSubmission, setLastSubmission] = useState<ContactSubmissionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, ...(initialSubject ? { subject: initialSubject } : {}), ...(initialMessage ? { message: initialMessage } : {}) }));
    if (initialAttachments.length) setAttachments(initialAttachments);
  }, [initialSubject, initialMessage, initialAttachments]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (formData.name.trim().length < 2) nextErrors.name = 'Enter your name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (formData.subject.trim().length < 3) nextErrors.subject = 'Add a subject (at least 3 characters).';
    if (formData.message.trim().length < 10) nextErrors.message = 'Write at least 10 characters.';
    if (formData.message.trim().length > 5000) nextErrors.message = 'Message must be 5,000 characters or fewer.';
    setErrors(nextErrors);
    setGlobalError('');
    if (Object.keys(nextErrors).length) return;

    setIsSending(true);
    try {
      const result = await sendContactMessage({ ...formData, name: formData.name.trim(), email: formData.email.trim(), subject: formData.subject.trim(), message: formData.message.trim(), attachments });
      setLastSubmission(result);
      if (result.status === 'failed' || !result.emailSent) {
        addNotification({ title: 'Message received', message: 'Your message was saved, but email delivery needs attention.', type: 'warning' });
      } else {
        addNotification({ title: 'Message sent', message: `Your message was delivered to ${portfolioUser.email}.`, type: 'success' });
      }
    } catch (error: any) {
      setGlobalError(error.message || 'Could not send your message. Please try again.');
      addNotification({ title: 'Message not sent', message: error.message || 'Could not connect to the contact service.', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const socialLinks: Array<{ url: string; label: string; Icon: LucideIcon }> = [
    { url: portfolioUser.linkedin, label: 'LinkedIn', Icon: Linkedin },
    { url: portfolioUser.github, label: 'GitHub', Icon: Github },
    { url: portfolioUser.instagram, label: 'Instagram', Icon: Instagram },
    { url: portfolioUser.twitter, label: 'X / Twitter', Icon: Twitter },
    ...portfolioUser.socialLinks.map((link) => ({ url: link.url, label: link.label, Icon: ExternalLink })),
  ].filter((link) => /^https?:\/\//i.test(link.url || ''));

  const submissionStatus = lastSubmission?.status ?? (lastSubmission?.emailSent ? 'delivered' : 'simulated');
  const submissionMessage = submissionStatus === 'delivered'
    ? "Your message was delivered successfully. I'll be in touch soon."
    : submissionStatus === 'failed'
      ? 'Your message was saved, but email delivery failed. Please try again later or contact me directly.'
      : "Your message was saved, but email delivery isn't configured right now.";
  const submissionTitle = submissionStatus === 'delivered'
    ? 'Message delivered'
    : submissionStatus === 'failed'
      ? 'Message saved, but not delivered'
      : 'Message saved';

  const fieldClass = (field: string) => `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950/70 dark:text-white ${errors[field] ? 'border-rose-500' : 'border-slate-200 dark:border-white/10'}`;

  return (
    <main className="h-full w-full select-text overflow-y-auto bg-slate-100/80 p-3 sm:p-5 dark:bg-[#0b1120]">
      <div className="mx-auto max-w-6xl space-y-4 pb-8">
        <section className="relative isolate overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-br from-slate-900 via-blue-900 to-sky-800 p-5 text-white shadow-lg shadow-slate-900/10 sm:rounded-3xl sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-24 -z-10 h-64 w-64 rounded-full border-[32px] border-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-24 right-[28%] -z-10 h-48 w-48 rounded-full bg-cyan-300/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Contact
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Let&apos;s build something meaningful.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">
                Have a project, opportunity, or question? Send a note and I&apos;ll get back to you as soon as I can.
              </p>
            </div>
            {portfolioUser.hiringStatus !== 'hidden' && (
              <div className="inline-flex w-fit items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white/10 ${portfolioUser.hiringStatus === 'unavailable' ? 'bg-slate-400' : 'motion-safe:animate-pulse'} ${portfolioUser.hiringStatus === 'open' ? 'bg-amber-400' : portfolioUser.hiringStatus === 'unavailable' ? '' : 'bg-emerald-400'}`} />
                <span className="text-xs font-semibold">
                  {portfolioUser.hiringStatus === 'open' ? 'Open to opportunities' : portfolioUser.hiringStatus === 'unavailable' ? 'Currently unavailable' : 'Available for work'}
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:rounded-3xl sm:p-6 dark:border-white/10 dark:bg-slate-900/80">
            {lastSubmission ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center px-4 py-10 text-center">
                <div className={`grid h-14 w-14 place-items-center rounded-2xl ${submissionStatus === 'delivered' ? 'animate-status-pop bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                  {submissionStatus === 'delivered' ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
                </div>
                <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-white">{submissionTitle}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {submissionMessage}
                </p>
                {submissionStatus === 'failed' && lastSubmission.error && (
                  <p role="alert" className="mt-3 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-5 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="font-semibold">Delivery details:</span> {lastSubmission.error}
                  </p>
                )}
                <button type="button" onClick={() => { setLastSubmission(null); setFormData({ name: '', email: '', subject: '', message: '', _honeypot: '' }); setAttachments([]); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40">
                  <Send className="h-3.5 w-3.5" /> Compose another message
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Start a conversation</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Share a few details, and I’ll follow up personally.</p>
                  </div>
                  <span className="hidden rounded-lg bg-sky-50 px-2.5 py-1.5 text-[10px] font-semibold text-sky-700 sm:inline-flex dark:bg-sky-500/10 dark:text-sky-300">All fields required</span>
                </div>
                {globalError && <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{globalError}</div>}
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={formData._honeypot} onChange={(e) => setFormData({ ...formData, _honeypot: e.target.value })} className="hidden" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Your name <span className="text-rose-500">*</span>
                      <input autoComplete="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isSending} placeholder="Jane Smith" aria-invalid={Boolean(errors.name)} className={fieldClass('name')} />
                      {errors.name && <span className="block text-[11px] font-medium text-rose-500">{errors.name}</span>}
                    </label>
                    <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email address <span className="text-rose-500">*</span>
                      <input type="email" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={isSending} placeholder="jane@company.com" aria-invalid={Boolean(errors.email)} className={fieldClass('email')} />
                      {errors.email && <span className="block text-[11px] font-medium text-rose-500">{errors.email}</span>}
                    </label>
                  </div>
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Subject <span className="text-rose-500">*</span>
                    <input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} disabled={isSending} placeholder="What would you like to discuss?" aria-invalid={Boolean(errors.subject)} className={fieldClass('subject')} />
                    {errors.subject && <span className="block text-[11px] font-medium text-rose-500">{errors.subject}</span>}
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Message <span className="text-rose-500">*</span>
                    <textarea rows={5} maxLength={5000} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} disabled={isSending} placeholder="Tell me a little about your idea, goals, or timeline." aria-invalid={Boolean(errors.message)} className={`${fieldClass('message')} resize-y leading-6`} />
                    <span className="flex flex-wrap justify-between gap-x-3 text-[11px] font-normal text-slate-400">
                      {errors.message ? <span className="text-rose-500">{errors.message}</span> : <span>Include any details that will help me respond.</span>}
                      <span>{formData.message.length}/5000</span>
                    </span>
                  </label>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-950/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <Paperclip className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Attachments
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{attachments.length}</span>
                      </div>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                        <Paperclip className="h-3 w-3" /> Add file
                      </button>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setAttachments((prev) => [...prev, { name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, type: file.type, content: typeof reader.result === 'string' ? reader.result : undefined }]);
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }} />
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {attachments.map((attachment, index) => (
                          <span key={`${attachment.name}-${index}`} title={`${attachment.name}${attachment.size ? ` · ${attachment.size}` : ''}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                            <File className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                            <span className="max-w-[180px] truncate">{attachment.name}</span>
                            <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((items) => items.filter((_, i) => i !== index))} className="ml-1 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                    <p className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      Your details are only used to respond to your message.
                    </p>
                    <button type="submit" disabled={isSending} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-sky-900/15 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto dark:focus:ring-offset-slate-900">
                      {isSending ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Sending…</> : <><Send className="h-3.5 w-3.5" /> Send message</>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>

          <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:rounded-3xl sm:p-5 dark:border-white/10 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <img src={portfolioUser.avatar || '/avatar.png'} alt="" onError={(event) => { event.currentTarget.src = '/avatar.png'; }} className="h-11 w-11 rounded-xl border border-slate-200 object-cover dark:border-white/10" />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">{portfolioUser.name}</h2>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-sky-700 dark:text-sky-300">{portfolioUser.title}</p>
                  {portfolioUser.location && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"><MapPin className="h-3 w-3" />{portfolioUser.location}</p>}
                </div>
              </div>
              {portfolioUser.bio && <p className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-300">{portfolioUser.bio}</p>}
              {(portfolioUser.email || portfolioUser.phone) && <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/10">
                {portfolioUser.email && <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email</p>
                <a href={`mailto:${portfolioUser.email}`} className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-xs font-semibold text-sky-700 hover:text-sky-600 hover:underline dark:text-sky-300">
                  {portfolioUser.email}<ArrowUpRight className="h-3 w-3 shrink-0" />
                </a>
                </>}
                {portfolioUser.phone && <a href={`tel:${portfolioUser.phone.replace(/[^\d+]/g, '')}`} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-700 hover:underline dark:text-slate-300 dark:hover:text-sky-300"><Phone className="h-3 w-3 shrink-0" />{portfolioUser.phone}</a>}
              </div>}
            </section>

            {socialLinks.length > 0 && (
              <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:rounded-3xl sm:p-5 dark:border-white/10 dark:bg-slate-900/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Find me online</h2>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Connect on your preferred platform.</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {socialLinks.map(({ url, label, Icon }, index) => (
                    <a key={`${label}-${index}`} href={url} target="_blank" rel="noreferrer" className="group flex min-h-10 items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 dark:border-white/5 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-sky-500/30 dark:hover:bg-sky-500/10 dark:hover:text-sky-200">
                      <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-sky-600 dark:group-hover:text-sky-300" />{label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};
