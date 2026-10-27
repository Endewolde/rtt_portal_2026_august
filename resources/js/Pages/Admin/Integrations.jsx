import { useCallback, useEffect, useState } from 'react';
import { Webhook, KeyRound, Plus, Copy, Check, Trash2, Send, Loader2, X, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, BookOpen, Power } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState } from '../../Components/Insights/Kit';
import { get, post, put, del } from '../../lib/api';
import { useToast } from '../../Components/Toast';

const SCOPE_LABELS = { proposals: 'Proposals', awards: 'Awards', outputs: 'Research outputs', reports: 'Reports' };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never');

function CopyField({ label, value }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the field can still be selected */ }
    };
    return (
        <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">{label}</p>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-900">{value}</code>
                <button onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
        </div>
    );
}

function Dialog({ title, icon: Icon, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon size={17} /></span>
                        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">{children}</div>
                {footer && <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
}

function NewKeyDialog({ scopes, onClose, onDone }) {
    const { error } = useToast();
    const [name, setName] = useState('');
    const [chosen, setChosen] = useState(['proposals']);
    const [created, setCreated] = useState(null);
    const [saving, setSaving] = useState(false);

    const create = async () => {
        setSaving(true);
        try {
            const r = await post('/integrations/keys', { name, scopes: chosen });
            setCreated(r.data);
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not create the key.');
        }
        setSaving(false);
    };

    return (
        <Dialog title={created ? 'Your new API key' : 'New API key'} icon={KeyRound} onClose={onClose}
            footer={created
                ? <button onClick={onClose} className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">I have copied it</button>
                : <>
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={create} disabled={saving || !name.trim() || chosen.length === 0}
                        className="inline-flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Create key
                    </button>
                </>}>
            {created ? (
                <>
                    <CopyField label={created.name} value={created.key} />
                    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> This is the only time the key is shown. Store it in the other system's settings now; if it is lost, revoke it and create a new one.</p>
                </>
            ) : (
                <>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-gray-700">Name *</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance ERP" maxLength={120}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-300 sm:text-sm" />
                    </label>
                    <div>
                        <p className="mb-2 text-xs font-semibold text-gray-700">May read</p>
                        <div className="grid grid-cols-2 gap-2">
                            {scopes.map((s) => (
                                <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${chosen.includes(s) ? 'border-slate-900 bg-slate-50' : 'border-gray-200'}`}>
                                    <input type="checkbox" checked={chosen.includes(s)} onChange={() => setChosen((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]))} />
                                    {SCOPE_LABELS[s] ?? s}
                                </label>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">Keys are read-only. They never expose reviewer identities, review scores or comments.</p>
                </>
            )}
        </Dialog>
    );
}

function NewWebhookDialog({ events, onClose, onDone }) {
    const { error } = useToast();
    const [form, setForm] = useState({ name: '', url: '', events: Object.keys(events) });
    const [created, setCreated] = useState(null);
    const [saving, setSaving] = useState(false);

    const create = async () => {
        setSaving(true);
        try {
            const r = await post('/integrations/webhooks', form);
            setCreated(r.data);
            onDone();
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'Could not add the webhook.'));
        }
        setSaving(false);
    };

    return (
        <Dialog title={created ? 'Webhook added' : 'New webhook'} icon={Webhook} onClose={onClose}
            footer={created
                ? <button onClick={onClose} className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">I have copied it</button>
                : <>
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={create} disabled={saving || !form.name.trim() || !form.url.trim() || form.events.length === 0}
                        className="inline-flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add webhook
                    </button>
                </>}>
            {created ? (
                <>
                    <CopyField label="Signing secret" value={created.secret} />
                    <p className="text-xs text-gray-500">Each call carries <code className="rounded bg-gray-100 px-1">X-RTT-Signature: sha256=…</code> — an HMAC-SHA256 of the request body with this secret. Check it on the receiving side to be sure the call came from here.</p>
                </>
            ) : (
                <>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-gray-700">Name *</span>
                        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. University website"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-300 sm:text-sm" />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-gray-700">Address (URL) *</span>
                        <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://example.org/hooks/rtt"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-mono text-base focus:outline-none focus:ring-2 focus:ring-slate-300 sm:text-sm" />
                    </label>
                    <div>
                        <p className="mb-2 text-xs font-semibold text-gray-700">Call it when</p>
                        <div className="space-y-2">
                            {Object.entries(events).map(([key, label]) => (
                                <label key={key} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 ${form.events.includes(key) ? 'border-slate-900 bg-slate-50' : 'border-gray-200'}`}>
                                    <input type="checkbox" className="mt-1" checked={form.events.includes(key)}
                                        onChange={() => setForm((f) => ({ ...f, events: f.events.includes(key) ? f.events.filter((x) => x !== key) : [...f.events, key] }))} />
                                    <span><span className="block font-mono text-xs font-semibold text-gray-900">{key}</span><span className="block text-xs text-gray-500">{label}</span></span>
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </Dialog>
    );
}

export default function Integrations() {
    const { success, error } = useToast();
    const [data, setData] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [busy, setBusy] = useState(null);

    const load = useCallback(() => get('/integrations').then((r) => setData(r.data)).catch((e) => error(e.response?.data?.message ?? 'Could not load integrations.')), []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load]);

    const act = async (id, request) => {
        setBusy(id);
        try {
            const r = await request();
            success(r.message);
        } catch (e) {
            error(e.response?.data?.message ?? 'That did not work.');
        }
        setBusy(null);
        load();
    };

    const base = data?.base_url ?? '';

    return (
        <AppLayout breadcrumb="API & Webhooks">
            <div className="mx-auto max-w-6xl space-y-6">
                <PageHeader icon={Webhook} color="slate" title="API & Webhooks" description="Connect finance, HR, ERP or a website: let them read data with a key, and tell them when things change." />

                <div className="grid gap-6 lg:grid-cols-2">
                    <Panel title="API keys" subtitle="Read-only access for other systems" icon={KeyRound} bodyClassName=""
                        actions={<button onClick={() => setDialog('key')} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"><Plus size={13} /> New key</button>}>
                        {!data ? <div className="h-32 animate-pulse bg-gray-50" /> : data.keys.length === 0 ? <EmptyState icon={KeyRound} title="No keys yet" text="Create one for each system that needs to read data." /> : (
                            <ul className="divide-y divide-gray-100">
                                {data.keys.map((k) => (
                                    <li key={k.id} className={`flex items-center gap-3 px-5 py-3 ${k.revoked_at ? 'opacity-50' : ''}`}>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900">{k.name} <span className="font-mono text-xs text-gray-400">{k.prefix}…</span></p>
                                            <p className="mt-0.5 text-xs text-gray-500">{k.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(' · ')} · last used {when(k.last_used_at)}</p>
                                        </div>
                                        {k.revoked_at ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Revoked</span> : (
                                            <button onClick={() => act(k.id, () => post(`/integrations/keys/${k.id}/revoke`, {}))} disabled={busy === k.id}
                                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Revoke</button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel title="Quick reference" subtitle="Send the key as: Authorization: Bearer rtt_…" icon={BookOpen}>
                        <ul className="space-y-2 font-mono text-xs">
                            {[
                                ['proposals', 'GET', '/proposals?status=funded&academic_year=2026-2027&updated_since=2026-10-01'],
                                ['proposals', 'GET', '/proposals/{tracker_number}'],
                                ['awards', 'GET', '/awards?since=2026-01-01'],
                                ['outputs', 'GET', '/research-outputs?type=journal_article'],
                                ['reports', 'GET', '/reports/{report}?academic_year=2026-2027'],
                            ].map(([scope, method, path]) => (
                                <li key={path} className="rounded-lg bg-slate-50 px-3 py-2">
                                    <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">{method}</span>
                                    <span className="break-all text-slate-700">{base}{path}</span>
                                    <span className="ml-2 text-[10px] text-slate-400">needs “{SCOPE_LABELS[scope]}”</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-xs text-gray-500">Lists are paged (<code>page</code>, <code>per_page</code> up to 200) and limited to 120 calls a minute per key.</p>
                    </Panel>
                </div>

                <Panel title="Webhooks" subtitle="We call these addresses when something changes" icon={Webhook} bodyClassName=""
                    actions={<button onClick={() => setDialog('webhook')} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"><Plus size={13} /> New webhook</button>}>
                    {!data ? <div className="h-32 animate-pulse bg-gray-50" /> : data.webhooks.length === 0 ? <EmptyState icon={Webhook} title="No webhooks yet" text="Add one to have another system told about new stages, awards and outputs as they happen." /> : (
                        <ul className="divide-y divide-gray-100">
                            {data.webhooks.map((w) => (
                                <li key={w.id} className="px-5 py-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-gray-900">{w.name}</p>
                                                {w.active
                                                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"><ShieldCheck size={11} /> Active</span>
                                                    : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{w.consecutive_failures >= 20 ? 'Stopped after repeated failures' : 'Paused'}</span>}
                                            </div>
                                            <p className="mt-0.5 break-all font-mono text-xs text-gray-500">{w.url}</p>
                                            <p className="mt-1 flex flex-wrap gap-1">{w.events.map((e) => <span key={e} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{e}</span>)}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <button onClick={() => act(w.id, () => post(`/integrations/webhooks/${w.id}/test`, {}))} disabled={busy === w.id}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                                                {busy === w.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Test
                                            </button>
                                            <button onClick={() => act(w.id, () => put(`/integrations/webhooks/${w.id}`, { active: !w.active }))} disabled={busy === w.id} title={w.active ? 'Pause' : 'Resume'}
                                                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"><Power size={13} /></button>
                                            <button onClick={() => act(w.id, () => del(`/integrations/webhooks/${w.id}`))} disabled={busy === w.id} title="Remove"
                                                className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                    {w.deliveries.length > 0 && (
                                        <ul className="mt-3 space-y-1 rounded-xl bg-gray-50 p-2">
                                            {w.deliveries.slice(0, 5).map((d) => (
                                                <li key={d.id} className="flex items-center gap-2 text-[11px] text-gray-600">
                                                    {d.succeeded ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-red-500" />}
                                                    <span className="font-mono">{d.event}</span>
                                                    <span className="tabular-nums">{d.status_code ?? '—'}</span>
                                                    <span className="text-gray-400">{d.duration_ms} ms</span>
                                                    <span className="ml-auto text-gray-400">{when(d.created_at)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            {dialog === 'key' && data && <NewKeyDialog scopes={data.scopes} onClose={() => setDialog(null)} onDone={load} />}
            {dialog === 'webhook' && data && <NewWebhookDialog events={data.events} onClose={() => setDialog(null)} onDone={load} />}
        </AppLayout>
    );
}
