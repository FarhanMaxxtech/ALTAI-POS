import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { allNavItems } from '../../navigation.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Dashboard. For now: who you are, how many stores you can reach, and which pages are coming.
// Real sales figures arrive with the checkout phase. We don't show made-up numbers before that.
const planned = allNavItems.filter((item) => item.status === 'planned');
const phases = [...new Set(planned.map((item) => item.phase))].sort();

export default function HomePage() {
    const { user, permissions } = useAuth();
    const [storeCount, setStoreCount] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores')
            .then((res) => { if (!cancelled) setStoreCount(res.stores.length); })
            .catch(() => { if (!cancelled) setStoreCount('—'); });
        return () => { cancelled = true; };
    }, []);

    return (
        <>
            <div className="page-header">
                <h1>Welcome, {user?.name ?? 'there'}</h1>
            </div>

            <div className="stat-row">
                <Link to="/stores" className="card stat">
                    <span className="stat-label">Stores</span>
                    <span className="stat-value">{storeCount ?? '…'}</span>
                </Link>
                <div className="card stat">
                    <span className="stat-label">Merchant</span>
                    <span className="stat-value">{user?.merchant_id ?? '—'}</span>
                </div>
                <div className="card stat">
                    <span className="stat-label">Permissions</span>
                    <span className="stat-value">{permissions.length}</span>
                </div>
            </div>

            <section className="card">
                <h2>Coming next</h2>
                <div className="roadmap">
                    {phases.map((phase) => (
                        <div key={phase}>
                            <h3 className="roadmap-phase">{phase}</h3>
                            <ul className="roadmap-items">
                                {planned.filter((item) => item.phase === phase).map((item) => (
                                    <li key={item.path}><Link to={item.path}>{item.label}</Link></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
