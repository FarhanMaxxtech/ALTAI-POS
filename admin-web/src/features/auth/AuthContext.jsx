import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../../api/client.js';
import { AuthContext } from './useAuth.js';

// Who is logged in, shared with every page through React context.
//
// status:
//   'checking'   — page just loaded with a saved token; asking the backend if it still works
//   'signed-in'  — user + permissions known
//   'signed-out' — show the login page
//
// The token is the only proof of login. The user's name is cached next to it for display only.

const USER_KEY = 'altai.user';

function readCachedUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; }
}

function writeCachedUser(user) {
    try {
        if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        else sessionStorage.removeItem(USER_KEY);
    } catch { /* storage blocked: the user just logs in again after a reload */ }
}

export function AuthProvider({ children }) {
    const [status, setStatus] = useState(() => (tokenStore.get() ? 'checking' : 'signed-out'));
    const [user, setUser] = useState(() => (tokenStore.get() ? readCachedUser() : null));
    const [permissions, setPermissions] = useState([]);
    const [notice, setNotice] = useState(null); // e.g. "Your session expired" shown on the login page

    const signOut = useCallback((message = null) => {
        tokenStore.clear();
        writeCachedUser(null);
        setUser(null);
        setPermissions([]);
        setNotice(message);
        setStatus('signed-out');
    }, []);

    // Any API call that gets a 401 lands here (see api/client.js).
    useEffect(() => {
        setUnauthorizedHandler(() => signOut('Your session has expired. Please log in again.'));
    }, [signOut]);

    // On page load: is the saved token still valid?
    useEffect(() => {
        if (status !== 'checking') return;
        let cancelled = false;
        api.get('/auth/me')
            .then((me) => {
                if (cancelled) return;
                setPermissions(me.permissions);
                setStatus('signed-in');
            })
            .catch((err) => {
                if (cancelled) return;
                // 401 is already handled by the unauthorized handler. Anything else (server down):
                // sign out too, but say why.
                if (!err.sessionExpired) signOut(err.message);
            });
        return () => { cancelled = true; };
    }, [status, signOut]);

    // credentials: { login_id, password } or { epc }
    const signIn = useCallback(async (credentials) => {
        const { token, user: signedInUser } = await api.post('/auth/login', credentials);
        tokenStore.set(token);
        writeCachedUser(signedInUser);
        setUser(signedInUser);
        setNotice(null);
        // Permissions are a nice-to-have for now: don't block login if that call fails.
        const me = await api.get('/auth/me').catch(() => ({ permissions: [] }));
        setPermissions(me.permissions);
        setStatus('signed-in');
    }, []);

    const value = useMemo(
        () => ({ status, user, permissions, notice, signIn, signOut: () => signOut() }),
        [status, user, permissions, notice, signIn, signOut],
    );
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
