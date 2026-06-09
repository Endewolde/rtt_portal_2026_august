import { useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { useAuth } from './useAuth';

/**
 * Reads the globally enabled feature set shared by the server via Inertia.
 *
 * Usage:
 *   const { hasFeature, enabledFeatures } = useFeature();
 *   if (!hasFeature('finance')) return <FeatureGate feature="finance" />;
 */
export function useFeature() {
    const { props } = usePage();
    const { hasRole } = useAuth();

    // Server shares enabled_features as a string array. If missing, treat all as enabled.
    const enabledFeatures = props.enabled_features ?? null;

    const hasFeature = useCallback(
        (feature) => {
            // super_admin always has access regardless of feature flags
            if (hasRole('super_admin')) return true;

            // No data yet (e.g. during initial hydration) → optimistically allow
            if (enabledFeatures === null) return true;

            return enabledFeatures.includes(feature);
        },
        [enabledFeatures, hasRole],
    );

    return { hasFeature, enabledFeatures: enabledFeatures ?? [] };
}
