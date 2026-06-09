import { Lock } from 'lucide-react';
import { useFeature } from '../hooks/useFeature';

/**
 * Renders children only when the user's college has the given feature enabled.
 * Shows an upgrade prompt otherwise (or nothing if `silent` is true).
 *
 * Props:
 *   feature   - Feature slug to check, e.g. 'finance'
 *   silent    - If true, renders nothing when access is denied (no prompt)
 *   fallback  - Optional custom node to render instead of the default prompt
 */
export default function FeatureGate({ feature, silent = false, fallback, children }) {
    const { hasFeature, subscription } = useFeature();

    if (hasFeature(feature)) {
        return children;
    }

    if (silent) return null;

    if (fallback) return fallback;

    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 mb-4">
                <Lock size={24} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Feature Not Available</h2>
            <p className="text-sm text-gray-500 max-w-sm">
                This module is not included in your current subscription plan
                {subscription?.plan ? ` (${subscription.plan})` : ''}.
                Contact your administrator to upgrade.
            </p>
        </div>
    );
}
