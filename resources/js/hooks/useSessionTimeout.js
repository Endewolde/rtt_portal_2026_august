import { useEffect, useRef, useCallback } from 'react'
import api from '../lib/api'

// The server ends a sign-in that goes unused for a while; someone reading without
// clicking anything is still active, so the browser tells it so now and then.
const KEEP_ALIVE_MS = 10 * 60 * 1000

/**
 * Tracks user inactivity and calls:
 *   onWarn(secondsLeft)  — when approaching timeout
 *   onLogout()           — when timeout is reached
 *
 * Any user interaction (mouse, keyboard, scroll, touch) resets the idle clock.
 */
export function useSessionTimeout({ timeoutMinutes, onWarn, onLogout }) {
    const lastActivityRef = useRef(Date.now())
    const warnFiredRef    = useRef(false)
    const intervalRef     = useRef(null)
    const lastPingRef     = useRef(Date.now())

    const resetActivity = useCallback(() => {
        lastActivityRef.current = Date.now()
        warnFiredRef.current    = false
        if (Date.now() - lastPingRef.current > KEEP_ALIVE_MS && localStorage.getItem('rtt_token')) {
            lastPingRef.current = Date.now()
            api.get('/auth/ping', { skipErrorToast: true }).catch(() => {})
        }
    }, [])

    useEffect(() => {
        const mins = parseInt(timeoutMinutes ?? 0, 10)
        if (!mins || mins <= 0) return

        const timeoutMs = mins * 60 * 1000
        // Warn 60 s before logout, but at least 20 % into the session
        const warnBeforeMs = Math.min(60_000, timeoutMs * 0.2)
        const warnAtMs     = timeoutMs - warnBeforeMs

        const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
        EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))

        intervalRef.current = setInterval(() => {
            const idle = Date.now() - lastActivityRef.current

            if (idle >= timeoutMs) {
                clearInterval(intervalRef.current)
                onLogout()
                return
            }

            if (idle >= warnAtMs && !warnFiredRef.current) {
                warnFiredRef.current = true
                const secsLeft = Math.ceil((timeoutMs - idle) / 1000)
                onWarn(secsLeft)
            }
        }, 5_000) // check every 5 seconds

        return () => {
            clearInterval(intervalRef.current)
            EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
        }
    }, [timeoutMinutes, onWarn, onLogout, resetActivity])

    return { resetActivity }
}
