import { useState, useEffect } from 'react';
import {
    Puzzle, ShieldCheck, Save, CheckSquare, Square, MinusSquare,
    ChevronDown, ChevronRight, FileText, Search, DollarSign,
    Activity, BarChart, Database, AlertTriangle, AlertCircle,
    Banknote, CalendarDays, EyeOff,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, put } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';

// ── Module + sub-feature registry ────────────────────────────────────────────

const MODULES = [
    {
        slug: 'proposals', label: 'Proposal Management', icon: FileText,
        description: 'Submit, track, and manage research proposals through the full lifecycle',
        color: 'indigo',
        subFeatures: [
            { slug: 'proposals.all',             label: 'All Proposals',       description: 'View the full proposals list' },
            { slug: 'proposals.calls',            label: 'Proposal Calls',      description: 'Manage and publish research proposal calls' },
            { slug: 'proposals.new_application',  label: 'New Application',     description: 'Allow researchers to submit new proposals' },
            { slug: 'proposals.track',            label: 'Proposal Tracker',    description: 'Public proposal status tracker' },
            { slug: 'proposals.my_proposals',     label: 'My Proposals',        description: 'PI view of their own proposals' },
            { slug: 'proposals.awarded',          label: 'Awarded Proposals',   description: 'View funded and post-award proposals' },
            { slug: 'proposals.archive',          label: 'Completed Archive',   description: 'Browse completed and archived projects by year' },
        ],
    },
    {
        slug: 'evaluation', label: 'Peer Review & Evaluation', icon: EyeOff,
        description: 'Blind peer review, central evaluation, and open defence sessions',
        color: 'blue',
        subFeatures: [
            { slug: 'evaluation.validation',        label: 'Validation Queue',    description: 'Review and approve submitted proposals' },
            { slug: 'evaluation.blind_review',      label: 'Blind Review',        description: 'Blind peer review queue and reviewer assignment' },
            { slug: 'evaluation.open_defence',      label: 'Open Defence',        description: 'Schedule and manage open defence sessions' },
            { slug: 'evaluation.central',           label: 'Central Evaluation',  description: 'Final funding decision by central office' },
            { slug: 'evaluation.assigned_reviews',  label: 'Assigned Reviews',    description: 'Reviewer view of their assigned reviews' },
            { slug: 'evaluation.criteria',          label: 'Evaluation Criteria', description: 'Manage scoring rubrics and evaluation types' },
            { slug: 'evaluation.reviewer_workload', label: 'Reviewer Workload',   description: 'Monitor and balance reviewer assignment load' },
        ],
    },
    {
        slug: 'finance', label: 'Budget & Finance', icon: DollarSign,
        description: 'Budget requests, disbursements, allocations, and financial settlements',
        color: 'emerald',
        subFeatures: [
            { slug: 'finance.allocations',   label: 'Budget Allocations', description: 'Allocate budgets to colleges and departments' },
            { slug: 'finance.requests',      label: 'Budget Requests',    description: 'Submit and approve funding round requests' },
            { slug: 'finance.funding',       label: 'Proposal Funding',   description: 'Track and manage funded proposal budgets' },
            { slug: 'finance.disbursements', label: 'Disbursements',      description: 'Manage fund disbursement to researchers' },
            { slug: 'finance.settlements',   label: 'Settlements',        description: 'Verify and close financial settlements' },
        ],
    },
    {
        slug: 'monitoring', label: 'Research Monitoring', icon: Activity,
        description: 'Midterm evaluations, completion workshops, and research output tracking',
        color: 'purple',
        subFeatures: [
            { slug: 'monitoring.midterm',    label: 'Midterm Evaluations',   description: 'Track midterm evaluation submissions and scoring' },
            { slug: 'monitoring.completion', label: 'Completion Workshops',  description: 'Manage project completion and final reporting' },
            { slug: 'monitoring.outputs',    label: 'Research Outputs',      description: 'Track publications, patents, and other outputs' },
        ],
    },
    {
        slug: 'reports', label: 'Analytics & Reports', icon: BarChart,
        description: 'Generate, filter, and export analytical reports',
        color: 'amber',
        subFeatures: [
            { slug: 'reports.generate',   label: 'Generate Report',      description: 'Create and export analytical reports' },
            { slug: 'reports.statistics', label: 'Proposal Statistics',  description: 'Proposal counts by category and academic year' },
            { slug: 'reports.college',    label: 'College Performance',  description: 'Per-college submission and funding metrics' },
            { slug: 'reports.budget',     label: 'Budget Utilization',   description: 'Budget allocation and spending analytics' },
        ],
    },
    {
        slug: 'repository', label: 'Research Repository', icon: Database,
        description: 'Research output repository and public knowledge base',
        color: 'teal',
        subFeatures: [
            { slug: 'repository.view',   label: 'Repository Browser', description: 'Public-facing research output repository' },
            { slug: 'repository.manage', label: 'Manage Repository',  description: 'Admin tools for curating repository records' },
        ],
    },
    {
        slug: 'similarity', label: 'Plagiarism Detection', icon: AlertTriangle,
        description: 'AI-powered similarity scoring and plagiarism detection',
        color: 'orange',
        subFeatures: [
            { slug: 'similarity.flags', label: 'Similarity Flags', description: 'Review and resolve plagiarism flag alerts' },
        ],
    },
    {
        slug: 'complaints', label: 'Complaint Handling', icon: AlertCircle,
        description: 'Complaint submission, escalation, and resolution tracking',
        color: 'red',
        subFeatures: [
            { slug: 'complaints.manage', label: 'Complaints', description: 'Submit, escalate, track, and resolve complaints' },
        ],
    },
    {
        slug: 'external_funds', label: 'External Funds', icon: Banknote,
        description: 'External grants, funding agencies, applications, and awards',
        color: 'cyan',
        subFeatures: [
            { slug: 'external_funds.manage', label: 'External Funds', description: 'Manage agencies, opportunities, applications, and awards' },
        ],
    },
    {
        slug: 'events', label: 'Conferences & Events', icon: CalendarDays,
        description: 'Conferences, abstract submissions, and event management',
        color: 'violet',
        subFeatures: [
            { slug: 'events.conferences', label: 'Conferences', description: 'Create and manage academic conferences' },
            { slug: 'events.abstracts',   label: 'Abstracts',   description: 'Abstract submissions and peer review' },
        ],
    },
];

const COLOR_MAP = {
    indigo: { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', ring: 'ring-indigo-300', header: 'bg-indigo-50 border-indigo-100' },
    blue:   { badge: 'bg-blue-100   text-blue-700   border-blue-200',   dot: 'bg-blue-500',   ring: 'ring-blue-300',   header: 'bg-blue-50   border-blue-100'   },
    emerald:{ badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-300', header: 'bg-emerald-50 border-emerald-100' },
    purple: { badge: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500', ring: 'ring-purple-300', header: 'bg-purple-50 border-purple-100' },
    amber:  { badge: 'bg-amber-100  text-amber-700  border-amber-200',  dot: 'bg-amber-500',  ring: 'ring-amber-300',  header: 'bg-amber-50  border-amber-100'  },
    teal:   { badge: 'bg-teal-100   text-teal-700   border-teal-200',   dot: 'bg-teal-500',   ring: 'ring-teal-300',   header: 'bg-teal-50   border-teal-100'   },
    orange: { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', ring: 'ring-orange-300', header: 'bg-orange-50 border-orange-100' },
    red:    { badge: 'bg-red-100    text-red-700    border-red-200',    dot: 'bg-red-500',    ring: 'ring-red-300',    header: 'bg-red-50    border-red-100'    },
    cyan:   { badge: 'bg-cyan-100   text-cyan-700   border-cyan-200',   dot: 'bg-cyan-500',   ring: 'ring-cyan-300',   header: 'bg-cyan-50   border-cyan-100'   },
    violet: { badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500', ring: 'ring-violet-300', header: 'bg-violet-50 border-violet-100' },
};

// ── Checkbox states ───────────────────────────────────────────────────────────

// Returns 'all' | 'none' | 'partial'
function moduleState(module, enabledFeatures, disabledSubs) {
    if (!enabledFeatures.includes(module.slug)) return 'none';
    const totalSubs    = module.subFeatures.length;
    const disabledCount = module.subFeatures.filter(s => disabledSubs.includes(s.slug)).length;
    if (disabledCount === 0)         return 'all';
    if (disabledCount === totalSubs) return 'none';
    return 'partial';
}

function CheckboxIcon({ state, size = 18 }) {
    if (state === 'all')     return <CheckSquare  size={size} className="text-indigo-600" />;
    if (state === 'partial') return <MinusSquare  size={size} className="text-indigo-400" />;
    return                          <Square       size={size} className="text-gray-300" />;
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModuleCard({ module, enabledFeatures, disabledSubs, readOnly, onToggleModule, onToggleSub }) {
    const [open, setOpen] = useState(true);
    const c      = COLOR_MAP[module.color] ?? COLOR_MAP.indigo;
    const Icon   = module.icon;
    const state  = moduleState(module, enabledFeatures, disabledSubs);
    const enabled = enabledFeatures.includes(module.slug);

    const enabledSubCount = module.subFeatures.filter(s =>
        enabled && !disabledSubs.includes(s.slug)
    ).length;

    return (
        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${state === 'none' ? 'opacity-60' : ''}`}>
            {/* Module header */}
            <div
                className={`flex items-center gap-3 px-5 py-4 border-b ${c.header} cursor-pointer`}
                onClick={() => setOpen(o => !o)}
            >
                {/* Parent checkbox */}
                {!readOnly && (
                    <button
                        onClick={e => { e.stopPropagation(); onToggleModule(module.slug, state); }}
                        className="shrink-0 hover:opacity-70 transition-opacity"
                    >
                        <CheckboxIcon state={state} size={20} />
                    </button>
                )}

                <div className="h-9 w-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
                    <Icon size={17} className="text-gray-600" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{module.label}</h3>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.badge}`}>
                            {enabledSubCount}/{module.subFeatures.length} enabled
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{module.description}</p>
                </div>

                {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
            </div>

            {/* Sub-features */}
            {open && (
                <div className="divide-y divide-gray-50">
                    {module.subFeatures.map(sub => {
                        const subEnabled = enabled && !disabledSubs.includes(sub.slug);
                        return (
                            <div
                                key={sub.slug}
                                onClick={() => !readOnly && onToggleSub(sub.slug, subEnabled)}
                                className={`flex items-center gap-3 px-5 py-3 transition-colors
                                    ${!readOnly ? 'cursor-pointer hover:bg-gray-50' : ''}
                                    ${!subEnabled ? 'opacity-50' : ''}`}
                            >
                                {!readOnly ? (
                                    <CheckboxIcon state={subEnabled && enabled ? 'all' : 'none'} size={16} />
                                ) : (
                                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${subEnabled ? c.dot : 'bg-gray-300'}`} />
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700">{sub.label}</p>
                                    <p className="text-xs text-gray-400 truncate">{sub.description}</p>
                                </div>

                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                    subEnabled && enabled
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {subEnabled && enabled ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeatureManagement() {
    const { hasRole }        = useAuth();
    const { success, error } = useToast();

    const [enabledFeatures, setEnabledFeatures] = useState([]);
    const [disabledSubs, setDisabledSubs]       = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [saving, setSaving]                   = useState(false);
    const [dirty, setDirty]                     = useState(false);

    const isSuperAdmin = hasRole('super_admin');

    useEffect(() => {
        Promise.all([get('/features'), get('/features/sub')])
            .then(([featRes, subRes]) => {
                const features = featRes.data ?? [];
                setEnabledFeatures(features.filter(f => f.enabled).map(f => f.slug));
                setDisabledSubs(subRes.data ?? []);
            })
            .catch(() => error('Failed to load configuration.'))
            .finally(() => setLoading(false));
    }, []);

    // Toggle parent module: 'all' or 'partial' → disable everything; 'none' → enable everything
    const toggleModule = (moduleSlug, state) => {
        const module = MODULES.find(m => m.slug === moduleSlug);
        if (!module) return;
        setDirty(true);

        if (state === 'none') {
            // Enable module + all sub-features
            setEnabledFeatures(prev => [...new Set([...prev, moduleSlug])]);
            setDisabledSubs(prev => prev.filter(s => !module.subFeatures.some(sf => sf.slug === s)));
        } else {
            // Disable module entirely (remove from enabled, disable all subs)
            setEnabledFeatures(prev => prev.filter(f => f !== moduleSlug));
            setDisabledSubs(prev => {
                const filtered = prev.filter(s => !module.subFeatures.some(sf => sf.slug === s));
                return [...filtered, ...module.subFeatures.map(sf => sf.slug)];
            });
        }
    };

    // Toggle individual sub-feature
    const toggleSub = (subSlug, currentlyEnabled) => {
        const parentSlug = subSlug.split('.')[0];
        setDirty(true);

        if (!currentlyEnabled) {
            // Enable: ensure parent is enabled and sub is not disabled
            setEnabledFeatures(prev => [...new Set([...prev, parentSlug])]);
            setDisabledSubs(prev => prev.filter(s => s !== subSlug));
        } else {
            // Disable this sub-feature
            setDisabledSubs(prev => [...new Set([...prev, subSlug])]);

            // If all subs of this module are now disabled, disable the parent too
            const module = MODULES.find(m => m.slug === parentSlug);
            if (module) {
                const newDisabled = [...new Set([...disabledSubs.filter(s => s !== subSlug), subSlug])];
                const allSubsDisabled = module.subFeatures.every(sf => newDisabled.includes(sf.slug));
                if (allSubsDisabled) {
                    setEnabledFeatures(prev => prev.filter(f => f !== parentSlug));
                }
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                put('/features', { features: enabledFeatures }),
                put('/features/sub', { disabled: disabledSubs }),
            ]);
            setDirty(false);
            success('Feature configuration saved. Changes take effect on next page load.', { title: 'Saved' });
        } catch {
            error('Failed to save configuration.');
        }
        setSaving(false);
    };

    const totalEnabled    = MODULES.filter(m => enabledFeatures.includes(m.slug)).length;
    const totalSubEnabled = MODULES.flatMap(m =>
        m.subFeatures.filter(s => enabledFeatures.includes(m.slug) && !disabledSubs.includes(s.slug))
    ).length;
    const totalSubs = MODULES.flatMap(m => m.subFeatures).length;

    return (
        <AppLayout breadcrumb="Feature Management">
            <div className="max-w-5xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Puzzle size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Feature Management</h1>
                            {!loading && (
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {totalEnabled}/{MODULES.length} modules · {totalSubEnabled}/{totalSubs} sub-features enabled
                                </p>
                            )}
                        </div>
                    </div>

                    {isSuperAdmin && !loading && (
                        <button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {saving ? <><Save size={14} className="animate-pulse" /> Saving…</> : <><Save size={14} /> Save Changes</>}
                        </button>
                    )}
                </div>

                {/* Read-only banner */}
                {!isSuperAdmin && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                        <ShieldCheck size={15} className="shrink-0" />
                        You can view but not change the feature configuration. Only Super Admins can toggle modules.
                    </div>
                )}

                {/* Unsaved changes banner */}
                {dirty && (
                    <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <p className="text-sm text-blue-700 font-medium">You have unsaved changes.</p>
                        <button onClick={handleSave} disabled={saving}
                            className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline">
                            Save now
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {MODULES.map(module => (
                            <ModuleCard
                                key={module.slug}
                                module={module}
                                enabledFeatures={enabledFeatures}
                                disabledSubs={disabledSubs}
                                readOnly={!isSuperAdmin}
                                onToggleModule={toggleModule}
                                onToggleSub={toggleSub}
                            />
                        ))}
                    </div>
                )}

                <p className="text-xs text-gray-400 text-center pb-4">
                    Disabled modules and sub-features are hidden from all users' navigation menus.
                    API routes for disabled top-level modules return 403. Changes take effect on next page load (cached 5 min).
                </p>
            </div>
        </AppLayout>
    );
}
