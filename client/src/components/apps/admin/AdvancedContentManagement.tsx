import React, { useEffect, useRef, useState } from 'react';
import { Braces, CloudUpload, LoaderCircle } from 'lucide-react';

interface AdvancedContentManagementProps {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onDraftChange?: (dirty: boolean) => void;
  onSaved?: () => void | Promise<void>;
}

export const AdvancedContentManagement: React.FC<AdvancedContentManagementProps> = ({ apiFetch, onDraftChange, onSaved }) => {
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const saveRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    onDraftChange?.(text !== savedText);
  }, [text, savedText, onDraftChange]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/admin/content-studio');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load the portfolio draft.');
      const formatted = JSON.stringify(data.draft, null, 2);
      setText(formatted);
      setSavedText(formatted);
      setError('');
    } catch (cause: any) {
      setError(cause.message || 'Could not load the portfolio draft.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const content = JSON.parse(text);
      const response = await apiFetch('/api/admin/content-studio/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Draft could not be saved.');
      const formatted = JSON.stringify(data.draft, null, 2);
      setText(formatted);
      setSavedText(formatted);
      setMessage('Validated draft saved. Publishing remains a separate action.');
      onDraftChange?.(false);
      await onSaved?.();
    } catch (cause: any) {
      setError(cause instanceof SyntaxError ? `Invalid JSON: ${cause.message}` : cause.message || 'Draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = save;

  useEffect(() => {
    const handleSaveDraft = () => { void saveRef.current(); };
    window.addEventListener('admin-save-content-draft', handleSaveDraft);
    return () => {
      window.removeEventListener('admin-save-content-draft', handleSaveDraft);
      onDraftChange?.(false);
    };
  }, [onDraftChange]);

  useEffect(() => {
    const handleDiscardUnsavedEdits = () => {
      setText(savedText);
      setError('');
      setMessage('');
    };
    window.addEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
    return () => window.removeEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
  }, [savedText]);

  return (
    <div className="admin-advanced-json w-full min-w-0 max-w-6xl space-y-4 pb-8">
      <section className="admin-content-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Portfolio data</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">Advanced JSON is for editing the complete portfolio record in one structured document. Use it only when a normal content editor cannot change a field; invalid JSON or content validation errors prevent saving.</p>
        </div>
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
          <Braces className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <p className="m-0">Most edits should be made from Site Content, Projects, and Appearance. JSON changes stay in draft until saved and published.</p>
        </div>
        {error && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</div>}
        {message && <div role="status" aria-live="polite" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">{message}</div>}
        {loading ? (
          <div role="status" className="flex min-h-[55vh] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading portfolio draft…</div>
        ) : (
          <textarea aria-label="Advanced portfolio JSON draft" spellCheck={false} value={text} onChange={(event) => { setText(event.target.value); setMessage(''); }} className="admin-json-editor min-h-[55vh] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-[11px] leading-5 text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        )}
        <button type="button" onClick={() => void save()} disabled={loading || saving || text === savedText} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
          {saving ? 'Saving JSON draft…' : 'Save JSON draft'}
        </button>
      </section>
    </div>
  );
};
