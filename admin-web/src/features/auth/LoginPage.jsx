import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function LoginPage() {
    const { status, signIn, notice } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const goTo = location.state?.from?.pathname ?? '/';

    const [mode, setMode] = useState('password'); // 'password' | 'badge'
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [epc, setEpc] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const firstField = useRef(null);
    useEffect(() => { firstField.current?.focus(); }, [mode]);

    if (status === 'signed-in') return <Navigate to={goTo} replace />;

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);

        const credentials = mode === 'badge'
            ? { epc: epc.trim() }
            : { login_id: loginId.trim(), password };

        // Quick checks before calling the server. The backend validates again: never trust the browser.
        if (mode === 'password' && (!credentials.login_id || !credentials.password)) {
            setError('Enter your login ID and password.');
            return;
        }
        if (mode === 'badge' && !/^[0-9A-Fa-f]{8,64}$/.test(credentials.epc)) {
            setError('That badge could not be read. Tap it again.');
            setEpc('');
            return;
        }

        setSubmitting(true);
        try {
            await signIn(credentials);
            navigate(goTo, { replace: true });
        } catch (err) {
            setError(err.message);
            if (mode === 'badge') setEpc('');
            else setPassword('');
            firstField.current?.focus();
        } finally {
            setSubmitting(false);
        }
    }

    function switchMode(next) {
        setMode(next);
        setError(null);
    }

    return (
        <main className="login-screen">
            <form className="card login-card" onSubmit={handleSubmit} noValidate>
                <header className="login-header">
                    <div className="brand-mark" aria-hidden="true">A</div>
                    <div>
                        <h1>ALTAI POS</h1>
                        <p className="muted">Sign in to the admin console</p>
                    </div>
                </header>

                <div className="tabs" role="tablist" aria-label="Sign-in method">
                    <button type="button" role="tab" aria-selected={mode === 'password'}
                        className={mode === 'password' ? 'tab active' : 'tab'} onClick={() => switchMode('password')}>
                        Login ID
                    </button>
                    <button type="button" role="tab" aria-selected={mode === 'badge'}
                        className={mode === 'badge' ? 'tab active' : 'tab'} onClick={() => switchMode('badge')}>
                        Staff badge
                    </button>
                </div>

                {notice && !error && <p className="alert info" role="status">{notice}</p>}
                {error && <p className="alert error" role="alert">{error}</p>}

                {mode === 'password' ? (
                    <>
                        <label className="field">
                            <span>Login ID</span>
                            <input ref={firstField} value={loginId} onChange={(e) => setLoginId(e.target.value)}
                                autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={submitting} />
                        </label>
                        <label className="field">
                            <span>Password</span>
                            <div className="input-with-action">
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={submitting} />
                                <button type="button" className="link-button" onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </label>
                    </>
                ) : (
                    <label className="field">
                        <span>Tap your badge on the reader</span>
                        {/* The reader "types" the EPC and presses Enter, which submits the form.
                            Masked like a password, because the badge EPC is a credential. */}
                        <input ref={firstField} type="password" value={epc} onChange={(e) => setEpc(e.target.value)}
                            autoComplete="off" placeholder="Waiting for badge…" disabled={submitting} />
                    </label>
                )}

                <button type="submit" className="button primary full" disabled={submitting}>
                    {submitting ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </main>
    );
}
