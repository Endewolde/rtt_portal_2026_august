import { Link } from '@inertiajs/react';
import { Check, Lock, ClipboardCheck, EyeOff, Presentation, ClipboardList, BadgeDollarSign } from 'lucide-react';
import { canOpenPath } from '../lib/routeAccess';
import { useAuth } from '../hooks/useAuth';

const STEPS = [
    {
        label:  'Validation',
        href:   '/admin/validation-queue',
        status: 'submitted',
        icon:   ClipboardCheck,
    },
    {
        label:  'Blind Review',
        href:   '/admin/blind-review',
        status: 'under_blind_review',
        icon:   EyeOff,
    },
    {
        label:  'Open Defence',
        href:   '/admin/open-defence',
        status: 'under_open_defence',
        icon:   Presentation,
    },
    {
        label:  'Central Eval',
        href:   '/admin/central-evaluation',
        status: 'accepted',
        icon:   ClipboardList,
    },
    {
        label:  'Funding',
        href:   '/admin/funding',
        status: 'funded',
        icon:   BadgeDollarSign,
    },
];

export default function WorkflowBreadcrumb({ current }) {
    const { hasPermission } = useAuth();

    const currentIdx = STEPS.findIndex(s => s.status === current);

    return (
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl px-6 py-4 overflow-x-auto shadow-sm">
            <div className="flex items-center min-w-max">
                {STEPS.map((step, i) => {
                    const isCurrent  = i === currentIdx;
                    const isDone     = i < currentIdx;
                    const hasAccess  = canOpenPath(step.href, hasPermission);
                    const Icon       = step.icon;

                    // ── Connector line ──────────────────────────────────────
                    const connector = i < STEPS.length - 1 ? (
                        <div className="w-12 sm:w-16 h-0.5 mx-1 shrink-0 relative overflow-hidden rounded-full bg-gray-200">
                            {isDone && (
                                <div className="absolute inset-0 bg-blue-400 rounded-full" />
                            )}
                            {isCurrent && (
                                <div className="absolute inset-0 bg-linear-to-r from-blue-500 to-gray-200 rounded-full" />
                            )}
                        </div>
                    ) : null;

                    // ── Circle styles ───────────────────────────────────────
                    let circleClass, iconColor;
                    if (!hasAccess) {
                        circleClass = 'bg-gray-100 border-2 border-dashed border-gray-200';
                        iconColor   = 'text-gray-300';
                    } else if (isCurrent) {
                        circleClass = 'bg-blue-600 border-2 border-blue-600 shadow-lg shadow-blue-200 ring-4 ring-blue-50';
                        iconColor   = 'text-white';
                    } else if (isDone) {
                        circleClass = 'bg-blue-50 border-2 border-blue-300';
                        iconColor   = 'text-blue-500';
                    } else {
                        circleClass = 'bg-white border-2 border-gray-200';
                        iconColor   = 'text-gray-400';
                    }

                    // ── Label styles ────────────────────────────────────────
                    let labelClass;
                    if (!hasAccess)     labelClass = 'text-gray-300';
                    else if (isCurrent) labelClass = 'text-blue-700 font-bold';
                    else if (isDone)    labelClass = 'text-blue-500 font-medium';
                    else                labelClass = 'text-gray-400 font-medium';

                    // ── Step number badge ───────────────────────────────────
                    let badge;
                    if (!hasAccess) {
                        badge = <Lock size={9} className="text-gray-300" />;
                    } else if (isDone) {
                        badge = <Check size={9} className="text-blue-500" />;
                    } else {
                        badge = <span className={`text-[9px] font-bold leading-none ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>{i + 1}</span>;
                    }

                    // ── Wrapper: link or span ───────────────────────────────
                    const inner = (
                        <div className="flex flex-col items-center gap-1.5 w-16 sm:w-20">
                            {/* Circle */}
                            <div className={`relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 ${circleClass} ${hasAccess && !isCurrent ? 'hover:scale-105' : ''}`}>
                                <Icon size={16} className={`${iconColor} transition-colors`} />
                                {/* Step badge */}
                                <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center border ${
                                    !hasAccess  ? 'bg-gray-100 border-gray-200' :
                                    isDone      ? 'bg-blue-100 border-blue-200' :
                                    isCurrent   ? 'bg-white border-blue-300' :
                                                  'bg-gray-50 border-gray-200'
                                }`}>
                                    {badge}
                                </div>
                            </div>
                            {/* Label */}
                            <span className={`text-[11px] whitespace-nowrap transition-colors ${labelClass}`}>
                                {step.label}
                            </span>
                            {/* Active underline dot */}
                            {isCurrent && (
                                <div className="w-1 h-1 rounded-full bg-blue-600" />
                            )}
                        </div>
                    );

                    return (
                        <div key={step.status} className="flex items-center">
                            {hasAccess && !isCurrent ? (
                                <Link href={step.href} title={`Go to ${step.label}`}>
                                    {inner}
                                </Link>
                            ) : (
                                <span title={!hasAccess ? "You don't have access to this stage" : undefined}>
                                    {inner}
                                </span>
                            )}
                            {connector}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
