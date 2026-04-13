import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import axiosClient from '../api/axiosClient';

const UserContext = createContext(null);

/**
 * UserProvider — fetches and exposes the authenticated user.
 *
 * Design notes:
 * - Place this inside MainLayout (not at root) so it naturally remounts
 *   on login/logout via route changes, avoiding the need to manually
 *   refresh after token writes.
 * - updatePreferences() does an optimistic state + localStorage update
 *   immediately, then retries the API call up to 3× with exponential
 *   backoff. If the user logs out mid-retry the attempt is aborted.
 * - Recovery: if localStorage already marks the tutorial as seen but
 *   the server disagrees (e.g. prior sync failed), we silently re-sync.
 */
export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const abortRetryRef = useRef(false);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await axiosClient.get('/users/me');
      const userData = res.data;

      // Recovery: localStorage optimistic update succeeded but API sync
      // failed previously → silently re-sync the server in background.
      const localKey = `tutorial_seen_${userData.user_id}`;
      if (localStorage.getItem(localKey) === 'true' && !userData.has_seen_tutorial) {
        axiosClient
          .patch('/users/me/preferences', { has_seen_tutorial: true })
          .catch(() => {/* best-effort, will retry next session */});
        userData.has_seen_tutorial = true;
      }

      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Detect logout from another browser tab (storage event fires cross-tab only)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'access_token' && !e.newValue) {
        abortRetryRef.current = true;
        setUser(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /**
   * Optimistically update user preferences, then persist to server.
   * Uses exponential backoff (500 ms → 1 s → 2 s) with up to 3 attempts.
   * Aborts if the access token disappears (logout).
   */
  const updatePreferences = useCallback(async (prefs) => {
    abortRetryRef.current = false;

    // Optimistic update — capture user_id before async work
    let userId;
    setUser((prev) => {
      userId = prev?.user_id;
      return prev ? { ...prev, ...prefs } : prev;
    });

    // Persist tutorial-seen flag to localStorage immediately so the
    // tutorial never re-appears even if the API call hasn't landed yet.
    if (userId !== undefined && prefs.has_seen_tutorial !== undefined) {
      localStorage.setItem(`tutorial_seen_${userId}`, String(prefs.has_seen_tutorial));
    }

    // Retry loop with exponential backoff
    let attempt = 0;
    const MAX_ATTEMPTS = 3;

    const trySync = async () => {
      if (abortRetryRef.current || !localStorage.getItem('access_token')) return;
      try {
        await axiosClient.patch('/users/me/preferences', prefs);
      } catch {
        attempt += 1;
        if (attempt < MAX_ATTEMPTS && !abortRetryRef.current) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
          return trySync();
        }
      }
    };

    trySync(); // fire-and-forget — caller does not need to await
  }, []);

  /** Call this on same-tab logout to immediately clear user state. */
  const clearUser = useCallback(() => {
    abortRetryRef.current = true;
    setUser(null);
    setIsLoading(false);
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, fetchUser, updatePreferences, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within <UserProvider>');
  return ctx;
}
