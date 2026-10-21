import { useState, useCallback } from 'react';
import { get, post } from '../lib/api';

export function useAuth() {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('rtt_user')); } catch { return null; }
    });
    const [token, setToken] = useState(() => localStorage.getItem('rtt_token'));

    const login = useCallback(async (credentials) => {
        const res = await post('/auth/login', credentials);
        // res is the full response body: { data: { token, user, evicted_session }, message, errors, meta }
        const { token: t, user: u, evicted_session: evictedSession } = res.data ?? res;
        localStorage.setItem('rtt_token', t);
        localStorage.setItem('rtt_user', JSON.stringify(u));
        if (evictedSession) {
            localStorage.setItem('rtt_session_evicted_notice', '1');
        }
        setToken(t);
        setUser(u);
        return u;
    }, []);

    // Fetch fresh user data from /auth/me and update localStorage + state.
    // Called on AppLayout mount to ensure roles are always up-to-date.
    const refreshUser = useCallback(async () => {
        try {
            const res = await get('/auth/me');
            // get() returns body JSON: { data: { user: {...} }, message, errors, meta }
            const freshUser = res.data?.user ?? res.data;
            if (freshUser) {
                localStorage.setItem('rtt_user', JSON.stringify(freshUser));
                setUser(freshUser);
            }
            return freshUser;
        } catch {
            localStorage.removeItem('rtt_token');
            localStorage.removeItem('rtt_user');
            setToken(null);
            setUser(null);
            window.location.href = '/login';
            return null;
        }
    }, []);

    const logout = useCallback(async () => {
        try { await post('/auth/logout'); } catch {}
        localStorage.removeItem('rtt_token');
        localStorage.removeItem('rtt_user');
        localStorage.removeItem('rtt_admin_token');
        localStorage.removeItem('rtt_admin_user');
        setToken(null);
        setUser(null);
        window.location.href = '/login';
    }, []);

    // Admin "login as" a target user — stash the admin's own session so it can be restored later.
    const impersonate = useCallback(async (userId) => {
        const res = await post(`/users/${userId}/impersonate`);
        const { token: t, user: u } = res.data ?? res;

        localStorage.setItem('rtt_admin_token', localStorage.getItem('rtt_token'));
        localStorage.setItem('rtt_admin_user', localStorage.getItem('rtt_user'));
        localStorage.setItem('rtt_token', t);
        localStorage.setItem('rtt_user', JSON.stringify(u));
        setToken(t);
        setUser(u);
        window.location.href = '/dashboard';
    }, []);

    const isImpersonating = !!localStorage.getItem('rtt_admin_token');

    const stopImpersonating = useCallback(() => {
        const adminToken = localStorage.getItem('rtt_admin_token');
        const adminUser = localStorage.getItem('rtt_admin_user');
        if (!adminToken) return;

        localStorage.setItem('rtt_token', adminToken);
        localStorage.setItem('rtt_user', adminUser);
        localStorage.removeItem('rtt_admin_token');
        localStorage.removeItem('rtt_admin_user');
        window.location.href = '/admin/users';
    }, []);

    // Roles may arrive as plain strings ['super_admin'] or as Spatie objects [{name: 'super_admin', ...}]
    const hasRole = useCallback((role) => {
        if (!user?.roles) return false;
        return user.roles.some((r) => (typeof r === 'string' ? r : r.name) === role);
    }, [user]);

    const hasAnyRole = useCallback((roles) => roles.some((r) => hasRole(r)), [hasRole]);

    const hasPermission = useCallback((perm) => {
        if (!user?.permissions) return false;
        return user.permissions.some((p) => (typeof p === 'string' ? p : p.name) === perm);
    }, [user]);

    const isAuthenticated = !!token && !!user;

    // Which records the user's permissions apply to: { type: 'all'|'college'|'category'|'own', college_id, categories }
    const accessScope = user?.access_scope ?? { type: 'own', college_id: null, categories: [] };
    const hasAnyPermission = useCallback((perms) => perms.some((p) => hasPermission(p)), [hasPermission]);
    /** Is a record (by its college and category) within the user's data scope? */
    const covers = useCallback((collegeId, category) => {
        if (accessScope.type === 'all') return true;
        if (accessScope.type === 'college') return !!collegeId && collegeId === accessScope.college_id;
        if (accessScope.type === 'category') return (accessScope.categories ?? []).includes(category);
        return false;
    }, [accessScope.type, accessScope.college_id, accessScope.categories]);

    return {
        user, setUser, token, login, logout, refreshUser, isAuthenticated, hasRole, hasAnyRole, hasPermission, hasAnyPermission, accessScope, covers,
        impersonate, isImpersonating, stopImpersonating,
    };
}
