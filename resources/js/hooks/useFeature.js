import { useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { useAuth } from './useAuth';

/**
 * Reads the globally enabled feature set shared by the server via Inertia.
 *
 * Usage:
 *   const { hasFeature, hasSubFeature } = useFeature();
 *   if (!hasFeature('finance')) return null;
 *   if (!hasSubFeature('finance.disbursements')) return null;
 */
export function useFeature() {
    const { props } = usePage();
    const { hasRole } = useAuth();

    const enabledFeatures    = props.enabled_features ?? null;
    const disabledSubFeatures = props.disabled_sub_features ?? [];

    const hasFeature = useCallback(
        (feature) => {
            if (hasRole('super_admin')) return true;
            if (enabledFeatures === null) return true;
            return enabledFeatures.includes(feature);
        },
        [enabledFeatures, hasRole],
    );

    // Check a sub-feature: parent module must be enabled AND sub-feature must not be disabled.
    const hasSubFeature = useCallback(
        (subSlug) => {
            if (hasRole('super_admin')) return true;
            const parent = subSlug.split('.')[0];
            if (!hasFeature(parent)) return false;
            return !disabledSubFeatures.includes(subSlug);
        },
        [hasFeature, disabledSubFeatures, hasRole],
    );

    return {
        hasFeature,
        hasSubFeature,
        enabledFeatures:    enabledFeatures ?? [],
        disabledSubFeatures,
    };
}
