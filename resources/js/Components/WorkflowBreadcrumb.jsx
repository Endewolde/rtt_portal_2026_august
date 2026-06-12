import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

const STEPS = [
    { label: 'Validation',    href: '/admin/validation-queue',   status: 'submitted' },
    { label: 'Blind Review',  href: '/admin/blind-review',       status: 'under_blind_review' },
    { label: 'Open Defence',  href: '/admin/open-defence',       status: 'under_open_defence' },
    { label: 'Central Eval',  href: '/admin/central-evaluation', status: 'accepted' },
    { label: 'Funding',       href: '/admin/funding',            status: 'funded' },
];

export default function WorkflowBreadcrumb({ current }) {
    return (
        <div className="flex items-center gap-1 mb-6 bg-white border border-gray-200 rounded-xl px-4 py-3 overflow-x-auto">
            {STEPS.map((step, i) => (
                <div key={step.status} className="flex items-center gap-1 shrink-0">
                    <Link
                        href={step.href}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            current === step.status
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        {i + 1}. {step.label}
                    </Link>
                    {i < STEPS.length - 1 && (
                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    )}
                </div>
            ))}
        </div>
    );
}
