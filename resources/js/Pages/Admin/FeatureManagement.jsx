import { useState, useEffect } from 'react';
import { Puzzle, ToggleLeft, ToggleRight, ShieldCheck, Save } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, put } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const ALL_FEATURES = [
    {
        slug: 'proposals',
        label: 'Proposal Management',
        description: 'Submit, track, and manage research proposals through the full lifecycle.',
        icon: '📋',
    },
    {
        slug: 'evaluation',
        label: 'Peer Review & Evaluation',
        description: 'Blind peer review, central evaluation, open defence sessions, and evaluation criteria.',
        icon: '🔍',
    },
    {
        slug: 'finance',
        label: 'Budget & Finance',
        description: 'Budget requests, disbursements, allocations, and financial settlements.',
        icon: '💰',
    },
    {
        slug: 'monitoring',
        label: 'Research Monitoring',
        description: 'Midterm evaluations, completion workshops, and research output tracking.',
        icon: '📊',
    },
    {
        slug: 'reports',
        label: 'Analytics & Reports',
        description: 'Generate, filter, and export analytical reports across the platform.',
        icon: '📈',
    },
    {
        slug: 'repository',
        label: 'Research Repository',
        description: 'Public-facing research output repository and knowledge base.',
        icon: '🗄️',
    },
    {
        slug: 'similarity',
        label: 'Plagiarism Detection',
        description: 'AI-powered similarity scoring and plagiarism flag management.',
        icon: '🤖',
    },
    {
        slug: 'complaints',
        label: 'Complaint Handling',
        description: 'Complaint submission, escalation, and resolution tracking.',
        icon: '⚠️',
    },
];

export default function FeatureManagement() {
    const { hasRole }         = useAuth();
    const [features, setFeatures]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [saved, setSaved]         = useState(false);

    const isSuperAdmin = hasRole('super_admin');

    useEffect(() => {
        get('/features')
            .then((r) => setFeatures(r.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const toggle = (slug) => {
        if (!isSuperAdmin) return;
        setFeatures((prev) =>
            prev.map((f) => (f.slug === slug ? { ...f, enabled: !f.enabled } : f)),
        );
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const enabled = features.filter((f) => f.enabled).map((f) => f.slug);
            await put('/features', { features: enabled });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {}
        finally { setSaving(false); }
    };

    const enabledCount  = features.filter((f) => f.enabled).length;
    const disabledCount = features.length - enabledCount;

    return (
        <AppLayout breadcrumb="Feature Management">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Puzzle size={24} className="text-indigo-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Feature Management</h1>
                        {!loading && (
                            <p className="text-sm text-gray-500 mt-0.5">
                                {enabledCount} of {features.length} modules enabled
                                {disabledCount > 0 && (
                                    <span className="ml-1 text-amber-600">· {disabledCount} hidden from all users</span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {isSuperAdmin && !loading && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saved ? <ShieldCheck size={15} /> : <Save size={15} />}
                        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                    </button>
                )}
            </div>

            {!isSuperAdmin && (
                <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                    <ShieldCheck size={15} className="shrink-0" />
                    You can view but not change the feature configuration. Only super admins can toggle modules.
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ALL_FEATURES.map((meta) => {
                        const feature = features.find((f) => f.slug === meta.slug);
                        const enabled = feature?.enabled ?? true;

                        return (
                            <div
                                key={meta.slug}
                                onClick={() => toggle(meta.slug)}
                                className={`
                                    relative flex items-start gap-4 rounded-xl border p-5 transition-all
                                    ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}
                                    ${enabled
                                        ? 'border-indigo-200 bg-indigo-50/50 shadow-sm'
                                        : 'border-gray-200 bg-white opacity-60'}
                                `}
                            >
                                <span className="text-2xl shrink-0 mt-0.5">{meta.icon}</span>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                            enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {enabled ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">{meta.description}</p>
                                </div>

                                {isSuperAdmin && (
                                    <div className="shrink-0 mt-0.5">
                                        {enabled
                                            ? <ToggleRight size={24} className="text-indigo-600" />
                                            : <ToggleLeft size={24} className="text-gray-300" />
                                        }
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="mt-5 text-xs text-gray-400 text-center">
                Disabled modules are hidden from all users' navigation menus and their API routes return 403.
                Changes take effect on next page load (cached for 5 minutes).
            </p>
        </AppLayout>
    );
}
