import { useState, useEffect, useRef } from 'react';
import { Link } from '@inertiajs/react';
import {
    ArrowLeft, AlertCircle, CheckCircle2, Mic, ImageIcon, Layers, Users2, MoreHorizontal,
    Plus, Trash2, FileText, Upload, X, Tag, Calendar, Clock, Hash,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';
import api from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function countWords(text) {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function deadlinePassed(deadline) {
    return deadline && new Date(deadline) < Date.now();
}

// ─── Presentation type config ─────────────────────────────────────────────────

const PRESENTATION_TYPES = [
    { value: 'oral',     label: 'Oral',     Icon: Mic,          desc: 'Spoken presentation (15–30 min)' },
    { value: 'poster',   label: 'Poster',   Icon: ImageIcon,    desc: 'Displayed poster & Q&A session' },
    { value: 'workshop', label: 'Workshop', Icon: Layers,       desc: 'Interactive workshop session' },
    { value: 'panel',    label: 'Panel',    Icon: Users2,       desc: 'Panel discussion & debate' },
    { value: 'other',    label: 'Other',    Icon: MoreHorizontal, desc: 'Any other format' },
];

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, required, error, hint, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                {hint && <span className="ml-1.5 text-gray-400 font-normal">{hint}</span>}
            </label>
            {children}
            {error && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                    <AlertCircle size={11} /> {Array.isArray(error) ? error[0] : error}
                </p>
            )}
        </div>
    );
}

function Input({ error, ...props }) {
    return (
        <input
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors
                        focus:outline-none focus:ring-2 focus:ring-indigo-500
                        ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
            {...props}
        />
    );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({ step, title, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                    {step}
                </span>
                <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AbstractSubmit() {
    // Derive slug: path = /conferences/{slug}/submit-abstract
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 2];

    // ?token=XXX means this is a resubmission for a revision_requested abstract
    const revisionToken = new URLSearchParams(window.location.search).get('token') ?? null;
    const isRevision = Boolean(revisionToken);

    const [conference, setConference] = useState(null);
    const [confLoading, setConfLoading] = useState(true);
    const [revisionLoading, setRevisionLoading] = useState(isRevision);

    const [form, setForm] = useState({
        name: '',
        email: '',
        affiliation: '',
        coAuthors: [{ name: '', affiliation: '' }],
        title: '',
        body: '',
        keywords: [],
        keywordInput: '',
        presentationType: '',
        file: null,
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [successToken, setSuccessToken] = useState(null);

    const fileRef = useRef(null);

    useEffect(() => {
        setConfLoading(true);
        get(`/conferences/${slug}`)
            .then(res => setConference(res.data?.data ?? res.data ?? res))
            .catch(() => {})
            .finally(() => setConfLoading(false));
    }, [slug]);

    // Pre-fill form from existing abstract when resubmitting
    useEffect(() => {
        if (!revisionToken) return;
        setRevisionLoading(true);
        get(`/abstracts/track/${revisionToken}`)
            .then(res => {
                const a = res.data?.data ?? res.data;
                if (!a) return;
                setForm({
                    name:             a.submitter_name        ?? '',
                    email:            a.submitter_email       ?? '',
                    affiliation:      a.submitter_affiliation ?? '',
                    coAuthors:        a.co_authors?.length ? a.co_authors : [{ name: '', affiliation: '' }],
                    title:            a.title                 ?? '',
                    body:             a.body                  ?? '',
                    keywords:         a.keywords              ?? [],
                    keywordInput:     '',
                    presentationType: a.presentation_type     ?? '',
                    file:             null,
                });
            })
            .catch(() => {})
            .finally(() => setRevisionLoading(false));
    }, [revisionToken]);

    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

    // ── Co-authors ──
    const addCoAuthor = () => {
        set('coAuthors', [...form.coAuthors, { name: '', affiliation: '' }]);
    };
    const removeCoAuthor = (idx) => {
        set('coAuthors', form.coAuthors.filter((_, i) => i !== idx));
    };
    const updateCoAuthor = (idx, field, value) => {
        const next = form.coAuthors.map((a, i) => i === idx ? { ...a, [field]: value } : a);
        set('coAuthors', next);
    };

    // ── Keywords ──
    const addKeyword = (raw) => {
        const kw = raw.trim().replace(/,+$/, '').trim();
        if (!kw || form.keywords.includes(kw) || form.keywords.length >= 10) return;
        set('keywords', [...form.keywords, kw]);
        set('keywordInput', '');
    };
    const removeKeyword = (kw) => set('keywords', form.keywords.filter(k => k !== kw));
    const onKeywordKey = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addKeyword(form.keywordInput);
        }
    };

    const wordCount = countWords(form.body);

    // ── Submit ──
    const handleSubmit = async (action) => {
        setErrors({});
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('action',                action);
            fd.append('submitter_name',        form.name);
            fd.append('submitter_email',       form.email);
            fd.append('submitter_affiliation', form.affiliation);
            if (revisionToken) fd.append('revision_token', revisionToken);
            fd.append('title',                 form.title);
            fd.append('body',                  form.body);
            fd.append('presentation_type',     form.presentationType);
            form.keywords.forEach(kw => fd.append('keywords[]', kw));
            form.coAuthors
                .filter(a => a.name.trim())
                .forEach((a, i) => {
                    fd.append(`co_authors[${i}][name]`,        a.name);
                    fd.append(`co_authors[${i}][affiliation]`, a.affiliation);
                });
            if (form.file) fd.append('file', form.file);

            const res = await api.post(`/conferences/${slug}/abstracts`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // token lives at data.data.submission_token
            const token = res.data?.data?.submission_token ?? res.data?.submission_token ?? null;
            setSuccessToken(token);
        } catch (err) {
            if (err.response?.status === 422) {
                const raw = err.response.data?.errors ?? {};
                // Remap server field names to the local form keys used in the template
                const mapped = {
                    ...raw,
                    name:        raw.submitter_name        ?? raw.name,
                    email:       raw.submitter_email       ?? raw.email,
                    affiliation: raw.submitter_affiliation ?? raw.affiliation,
                };
                setErrors(mapped);

                // Scroll to the first section that has an error
                const SECTION_FIELD_MAP = [
                    { sectionId: 'section-submitter',     fields: ['name', 'email', 'affiliation'] },
                    { sectionId: 'section-coauthors',     fields: ['co_authors'] },
                    { sectionId: 'section-content',       fields: ['title', 'body', 'keywords'] },
                    { sectionId: 'section-type',          fields: ['presentation_type'] },
                    { sectionId: 'section-file',          fields: ['file'] },
                ];
                const errorKeys = Object.keys(mapped);
                const firstSection = SECTION_FIELD_MAP.find(s =>
                    s.fields.some(f => errorKeys.some(k => k === f || k.startsWith(f)))
                );
                const el = firstSection
                    ? document.getElementById(firstSection.sectionId)
                    : null;
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else if (err.response?.data?.message) {
                setErrors({ general: err.response.data.message });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Success state ──
    if (successToken) {
        return (
            <PublicLayout>
                <div className="max-w-xl mx-auto px-6 py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-green-50 border-4 border-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={38} className="text-green-500" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Abstract Submitted!</h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        Your abstract has been received. Use the tracking token below to check your submission status at any time.
                    </p>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Your Tracking Token</p>
                        <p className="font-mono text-2xl font-black text-indigo-700 tracking-widest break-all">{successToken}</p>
                        <button
                            onClick={() => { navigator.clipboard.writeText(successToken); }}
                            className="mt-3 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                        >
                            Copy to clipboard
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href={`/conferences/${slug}`}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5
                                       border border-gray-200 rounded-xl text-sm font-semibold text-gray-700
                                       hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft size={14} /> Back to Conference
                        </Link>
                        <Link
                            href="/my-abstracts"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5
                                       bg-indigo-600 rounded-xl text-sm font-semibold text-white
                                       hover:bg-indigo-700 transition-colors"
                        >
                            View My Abstracts
                        </Link>
                    </div>
                </div>
            </PublicLayout>
        );
    }

    const isDeadlinePassed = deadlinePassed(conference?.abstract_deadline);

    return (
        <PublicLayout>
            {/* ── Header ── */}
            <div className="bg-linear-to-br from-indigo-950 via-indigo-900 to-violet-900 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-violet-600/20 blur-3xl" />
                <div className="relative max-w-4xl mx-auto px-6 py-10">
                    <Link
                        href={`/conferences/${slug}`}
                        className="inline-flex items-center gap-2 text-indigo-300 hover:text-white
                                   text-sm font-medium transition-colors mb-5"
                    >
                        <ArrowLeft size={14} />
                        {confLoading ? 'Back to Conference' : (conference?.title ?? 'Back to Conference')}
                    </Link>

                    {isRevision && (
                        <div className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/30
                                         text-amber-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
                            ⟳ Revision Resubmission
                        </div>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 leading-tight">
                        {isRevision ? 'Revise & Resubmit' : 'Submit Abstract'}
                    </h1>

                    {confLoading ? (
                        <div className="h-4 w-48 bg-white/10 rounded-lg animate-pulse mt-2" />
                    ) : conference ? (
                        <p className="text-indigo-200 text-sm font-medium">
                            {conference.title}
                        </p>
                    ) : null}

                    {conference?.abstract_deadline && (
                        <div className={`inline-flex items-center gap-2 mt-4 px-3.5 py-2 rounded-xl text-sm font-semibold ${
                            isDeadlinePassed
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                            <Clock size={13} />
                            {isDeadlinePassed ? 'Deadline passed · ' : 'Abstract deadline · '}
                            {fmtDate(conference.abstract_deadline)}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Form ── */}
            <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

                {/* Revision loading skeleton */}
                {revisionLoading && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-xl bg-amber-200 shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-3 bg-amber-200 rounded w-2/5" />
                            <div className="h-2.5 bg-amber-200 rounded w-1/3" />
                        </div>
                    </div>
                )}

                {/* Revision context banner */}
                {isRevision && !revisionLoading && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
                            <AlertCircle size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">Revising your abstract</p>
                            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                Your previous submission has been pre-loaded. Update the fields based on reviewer feedback, then click <strong>Submit Abstract</strong> to resubmit.
                            </p>
                        </div>
                    </div>
                )}

                {/* Global error banner — lists every broken field specifically */}
                {Object.keys(errors).length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                        <div className="flex items-start gap-3 mb-2">
                            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-red-700">
                                Please fix the following issues before submitting:
                            </p>
                        </div>
                        <ul className="space-y-1 pl-7">
                            {errors.general && (
                                <li className="text-xs text-red-600 leading-snug">— {errors.general}</li>
                            )}
                            {errors.name && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Full Name:</strong> {Array.isArray(errors.name) ? errors.name[0] : errors.name}</li>
                            )}
                            {errors.email && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Email:</strong> {Array.isArray(errors.email) ? errors.email[0] : errors.email}</li>
                            )}
                            {errors.affiliation && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Affiliation:</strong> {Array.isArray(errors.affiliation) ? errors.affiliation[0] : errors.affiliation}</li>
                            )}
                            {errors.title && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Abstract Title:</strong> {Array.isArray(errors.title) ? errors.title[0] : errors.title}</li>
                            )}
                            {errors.body && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Abstract Body:</strong> {Array.isArray(errors.body) ? errors.body[0] : errors.body}</li>
                            )}
                            {errors.presentation_type && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Presentation Type:</strong> {Array.isArray(errors.presentation_type) ? errors.presentation_type[0] : errors.presentation_type}</li>
                            )}
                            {errors.keywords && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Keywords:</strong> {Array.isArray(errors.keywords) ? errors.keywords[0] : errors.keywords}</li>
                            )}
                            {errors.co_authors && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>Co-Authors:</strong> {Array.isArray(errors.co_authors) ? errors.co_authors[0] : errors.co_authors}</li>
                            )}
                            {errors.file && (
                                <li className="text-xs text-red-600 leading-snug">— <strong>File:</strong> {Array.isArray(errors.file) ? errors.file[0] : errors.file}</li>
                            )}
                        </ul>
                    </div>
                )}

                {/* ── Section 1: Submitter Info ── */}
                <div id="section-submitter">
                <Section step="1" title="Submitter Information">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Full Name" required error={errors.name}>
                            <Input
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder="Your full name"
                                error={errors.name}
                            />
                        </Field>
                        <Field label="Email Address" required error={errors.email}>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={e => set('email', e.target.value)}
                                placeholder="you@institution.edu"
                                error={errors.email}
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Affiliation / Institution" required error={errors.affiliation}>
                                <Input
                                    value={form.affiliation}
                                    onChange={e => set('affiliation', e.target.value)}
                                    placeholder="University / Organization"
                                    error={errors.affiliation}
                                />
                            </Field>
                        </div>
                    </div>
                </Section>
                </div>

                {/* ── Section 2: Co-Authors ── */}
                <div id="section-coauthors">
                <Section step="2" title="Co-Authors">
                    <div className="space-y-3">
                        {form.coAuthors.map((author, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input
                                        value={author.name}
                                        onChange={e => updateCoAuthor(idx, 'name', e.target.value)}
                                        placeholder="Co-author name"
                                    />
                                    <Input
                                        value={author.affiliation}
                                        onChange={e => updateCoAuthor(idx, 'affiliation', e.target.value)}
                                        placeholder="Affiliation / Institution"
                                    />
                                </div>
                                {form.coAuthors.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeCoAuthor(idx)}
                                        className="mt-0.5 p-2.5 rounded-xl border border-gray-200 text-gray-400
                                                   hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shrink-0"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addCoAuthor}
                        className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-600
                                   hover:text-indigo-700 transition-colors"
                    >
                        <Plus size={15} /> Add Co-Author
                    </button>
                    {errors.co_authors && (
                        <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                            <AlertCircle size={11} /> {Array.isArray(errors.co_authors) ? errors.co_authors[0] : errors.co_authors}
                        </p>
                    )}
                </Section>
                </div>

                {/* ── Section 3: Abstract Content ── */}
                <div id="section-content">
                <Section step="3" title="Abstract Content">
                    <div className="space-y-5">
                        <Field label="Abstract Title" required error={errors.title}>
                            <Input
                                value={form.title}
                                onChange={e => set('title', e.target.value)}
                                placeholder="Enter a clear, descriptive title"
                                error={errors.title}
                            />
                        </Field>

                        <Field label="Abstract Body" required hint="(min 50 / max 800 words)" error={errors.body}>
                            <div className="relative">
                                <textarea
                                    value={form.body}
                                    onChange={e => set('body', e.target.value)}
                                    rows={10}
                                    placeholder="Write your abstract here…"
                                    className={`w-full px-3.5 py-3 rounded-xl border text-sm transition-colors resize-none
                                                focus:outline-none focus:ring-2 focus:ring-indigo-500
                                                ${errors.body ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
                                />
                                <div className={`flex items-center justify-end mt-1.5 text-xs font-medium ${
                                    wordCount < 50 || wordCount > 800 ? 'text-red-500' : 'text-green-600'
                                }`}>
                                    <span className={`px-2.5 py-1 rounded-full ${
                                        wordCount < 50 || wordCount > 800 ? 'bg-red-50' : 'bg-green-50'
                                    }`}>
                                        {wordCount} / 800 words
                                        {wordCount < 50 && wordCount > 0 && ` · ${50 - wordCount} more needed`}
                                        {wordCount === 0 && ' · minimum 50'}
                                    </span>
                                </div>
                            </div>
                        </Field>

                        {/* Keywords */}
                        <Field label="Keywords" hint="(up to 10 — press Enter or comma to add)" error={errors.keywords}>
                            <div className={`w-full min-h-12 px-3 py-2 rounded-xl border transition-colors
                                            focus-within:ring-2 focus-within:ring-indigo-500 flex flex-wrap gap-1.5
                                            ${errors.keywords ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus-within:bg-white'}`}>
                                {form.keywords.map(kw => (
                                    <span key={kw}
                                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1
                                                   bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                                        <Hash size={9} />
                                        {kw}
                                        <button type="button" onClick={() => removeKeyword(kw)}
                                            className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5">
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                                {form.keywords.length < 10 && (
                                    <input
                                        value={form.keywordInput}
                                        onChange={e => set('keywordInput', e.target.value)}
                                        onKeyDown={onKeywordKey}
                                        onBlur={() => form.keywordInput && addKeyword(form.keywordInput)}
                                        placeholder={form.keywords.length === 0 ? 'e.g. machine learning, NLP…' : ''}
                                        className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder-gray-400 py-0.5"
                                    />
                                )}
                            </div>
                        </Field>
                    </div>
                </Section>
                </div>

                {/* ── Section 4: Presentation Type ── */}
                <div id="section-type">
                <Section step="4" title="Presentation Type">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {PRESENTATION_TYPES.map(({ value, label, Icon, desc }) => {
                            const active = form.presentationType === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => set('presentationType', value)}
                                    className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2
                                                text-center transition-all duration-200
                                                ${active
                                                    ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-500/10'
                                                    : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                                                }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                        active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                    }`}>
                                        <Icon size={18} />
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${active ? 'text-indigo-700' : 'text-gray-700'}`}>
                                        {label}
                                    </span>
                                    <span className="text-[10px] text-gray-400 leading-tight hidden sm:block">{desc}</span>
                                    {active && (
                                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                                            <CheckCircle2 size={10} className="text-white" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {errors.presentation_type && (
                        <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                            <AlertCircle size={11} /> {Array.isArray(errors.presentation_type) ? errors.presentation_type[0] : errors.presentation_type}
                        </p>
                    )}
                </Section>
                </div>

                {/* ── Section 5: File Upload ── */}
                <div id="section-file">
                <Section step="5" title="Supporting File">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => set('file', e.target.files[0] ?? null)}
                    />

                    {form.file ? (
                        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                                <FileText size={18} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{form.file.name}</p>
                                <p className="text-xs text-gray-500">{(form.file.size / 1024).toFixed(0)} KB</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { set('file', null); fileRef.current.value = ''; }}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileRef.current.click()}
                            className="w-full flex flex-col items-center gap-3 py-8 px-6 rounded-2xl border-2 border-dashed
                                       border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                                <Upload size={22} className="text-gray-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-gray-700">Upload supporting file</p>
                                <p className="text-xs text-gray-400 mt-0.5">PDF or Word document · Optional · Max 10 MB</p>
                            </div>
                        </button>
                    )}

                    {errors.file && (
                        <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                            <AlertCircle size={11} /> {Array.isArray(errors.file) ? errors.file[0] : errors.file}
                        </p>
                    )}
                </Section>
                </div>

                {/* ── Footer actions ── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3
                                bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                        <strong className="text-gray-600">Draft</strong> saves your progress without formal submission.
                        <strong className="text-gray-600 ml-1">Submit</strong> sends it to the review committee.
                    </p>
                    <div className="flex gap-3 shrink-0">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit('draft')}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700
                                       hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Saving…' : 'Save as Draft'}
                        </button>
                        <button
                            type="button"
                            disabled={submitting || isDeadlinePassed}
                            onClick={() => handleSubmit('submit')}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold
                                       hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20
                                       disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            {submitting ? 'Submitting…' : 'Submit Abstract'}
                        </button>
                    </div>
                </div>

                {isDeadlinePassed && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        <AlertCircle size={15} className="shrink-0" />
                        The abstract submission deadline has passed. New submissions are no longer accepted, but you may still save a draft.
                    </div>
                )}
            </div>
        </PublicLayout>
    );
}
