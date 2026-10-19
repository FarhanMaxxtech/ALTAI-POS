import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// First page after login. Loading the store list proves the token works end to end:
// browser → our backend → team API → back.
export default function HomePage() {
    const { user, permissions } = useAuth();
    const [stores, setStores] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores')
            .then((res) => { if (!cancelled) setStores(res.stores); })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, []);

    return (
        <>
            <h1>Welcome, {user?.name ?? 'there'}</h1>
            <p className="muted">
                Merchant {user?.merchant_id ?? '—'} · {permissions.length} permission{permissions.length === 1 ? '' : 's'}
            </p>

            <section className="card">
                <h2>Your stores</h2>
                {error && <p className="alert error" role="alert">{error}</p>}
                {!error && stores === null && <p className="muted" role="status">Loading stores…</p>}
                {stores?.length === 0 && <p className="muted">No stores found for this account.</p>}
                {stores?.length > 0 && (
                    <ul className="list">
                        {stores.map((s) => (
                            <li key={s.id}>
                                <span>{s.name || 'Unnamed store'}</span>
                                <span className="muted mono">#{s.id}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
