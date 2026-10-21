import { useAuth } from '../features/auth/AuthContext.jsx';
import { NavLink } from 'react-router-dom';

// The frame around every signed-in page: top bar with the user and a sign-out button.
export default function AppShell({ children }) {
    const { user, signOut } = useAuth();
    return (
        <div className="app">
            <header className="topbar">
                <div className="topbar-brand">
                    <div className="brand-mark small" aria-hidden="true">A</div>
                    <span>ALTAI POS Admin</span>
                </div>
                <nav>
                    <NavLink to="/" end>Home</NavLink>
                    {' '}
                    <NavLink to="/settings">Settings</NavLink>
                </nav>
                <div className="topbar-user">
                    <span className="muted">{user?.name ?? 'Signed in'}</span>
                    <button type="button" className="button" onClick={signOut}>Sign out</button>
                </div>
            </header>
            <main className="content">{children}</main>
        </div>
    );
}
