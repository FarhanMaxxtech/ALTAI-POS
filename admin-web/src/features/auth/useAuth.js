import { createContext, useContext } from 'react';

// The login "context" (who is logged in), and the hook every page uses to read it.
//
// Why a separate file from AuthContext.jsx: during development, Vite reloads changed files live.
// A file that exports both a component (AuthProvider) and something else (this hook) can't be
// reloaded in place, so it's rebuilt from scratch, which creates a SECOND context. Pages then read
// the new, empty one and crash with "useAuth() must be used inside <AuthProvider>".
// Keeping the context here, in a file with no components, means it's created exactly once.

export const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
    return ctx;
}
