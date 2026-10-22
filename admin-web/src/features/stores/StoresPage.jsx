import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

// The stores this account can access, from the team API (Stock/StoreList).
// Shows the three states every data page needs: loading, error, empty.
export default function StoresPage() {
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
            <div className="page-header">
                <h1>Stores</h1>
                {stores && <span className="muted">{stores.length} store{stores.length === 1 ? '' : 's'}</span>}
            </div>

            <section className="card">
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
