import React, { useEffect, useState } from 'react';
import { Bot, Check, LoaderCircle, Search, ShieldCheck, Wifi } from 'lucide-react';

interface AssistantManagementProps {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export const AssistantManagement: React.FC<AssistantManagementProps> = ({ apiFetch }) => {
  const [status, setStatus] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [enabled, setEnabled] = useState(true);
  const [savedEnabled, setSavedEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statusResponse, draftResponse] = await Promise.all([
        apiFetch('/api/admin/content-studio/status'),
        apiFetch('/api/admin/content-studio'),
      ]);
      const [statusData, draftData] = await Promise.all([statusResponse.json(), draftResponse.json()]);
      if (!statusResponse.ok || !statusData.success) throw new Error(statusData.error || 'Could not read assistant status.');
      if (!draftResponse.ok || !draftData.success) throw new Error(draftData.error || 'Could not load portfolio draft.');
      setStatus(statusData.services);
      setDraft(draftData.draft);
      const draftEnabled = draftData.draft?.siteSettings?.assistantEnabled !== false;
      setEnabled(draftEnabled);
      setSavedEnabled(draftEnabled);
    } catch (cause: any) {
      setError(cause.message || 'Assistant status is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const nextDraft = {
        ...draft,
        siteSettings: { ...draft.siteSettings, assistantEnabled: enabled },
      };
      const response = await apiFetch('/api/admin/content-studio/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: nextDraft }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Assistant preference could not be saved.');
      setDraft(data.draft);
      setSavedEnabled(enabled);
      setNotice('Assistant search preference saved to draft. Publish it to apply to visitors.');
    } catch (cause: any) {
      setError(cause.message || 'Assistant preference could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-52 items-center justify-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Checking services...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="border-b border-slate-800 pb-5"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400">Administration / Services</p><h2 className="text-xl font-bold text-white sm:text-2xl">AI &amp; Web Search</h2><p className="mt-1 text-xs text-slate-400">Manage the web-search integration used by the Windows Browser app. Provider credentials are never shown.</p></header>
      {error && <div role="alert" className="border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">{error}</div>}
      {notice && <div role="status" className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">{notice}</div>}
      <section className="grid gap-3 sm:grid-cols-2">
        <article className="border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-200"><Search className="h-4 w-4 text-sky-400" />Public web search</div><p className="mt-3 text-lg font-bold capitalize text-white">{status?.webSearch || 'unknown'}</p><p className="mt-1 text-[10px] text-slate-500">Gemini configured: {status?.webSearchConfigured ? 'Yes' : 'No, local search fallback'}</p></article>
        <article className="border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-200"><Wifi className="h-4 w-4 text-emerald-400" />Connected services</div><p className="mt-3 text-xs text-slate-300">MongoDB: <strong className="capitalize">{status?.database || 'unknown'}</strong></p><p className="mt-1 text-xs text-slate-300">Email delivery: <strong className="capitalize">{status?.email || 'unknown'}</strong></p></article>
      </section>
      <section className="border-y border-slate-800 py-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="flex items-start gap-3"><Bot className="mt-0.5 h-5 w-5 text-sky-400" /><span><strong className="block text-xs text-white">Enable external AI web search</strong><small className="mt-1 block text-[10px] text-slate-500">When disabled, the public browser falls back to local search results. This setting is staged in the content draft.</small></span></span>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-sky-500" />
        </label>
        <button onClick={() => void save()} disabled={saving || enabled === savedEnabled} className="mt-4 inline-flex h-9 items-center gap-2 bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save to draft</button>
      </section>
      <div className="flex items-start gap-3 border border-slate-800 bg-slate-900/40 p-4 text-[10px] text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" /><p className="m-0">This portfolio build has no visitor chat-conversation service or transcript store. Search requests are not presented as chat history.</p></div>
    </div>
  );
};
