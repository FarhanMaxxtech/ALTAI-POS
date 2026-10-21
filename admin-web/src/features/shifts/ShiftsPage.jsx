import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { formatRM, toCents } from '../../lib/money.js';
import CurrentShift from './CurrentShift.jsx';
import VarianceChip from './VarianceChip.jsx';

// SHIFTS & CASH PAGE
//
// Top:    pick the store and the till ("register", e.g. T1). A store can have several tills,
//         each with its own drawer and its own shift.
// Middle: the till right now (see CurrentShift.jsx): open it, record cash in/out, close it.
// Bottom: the history of shifts at this store, newest first, with each one's difference.
//
// The till app (pos-app) will use the same backend endpoints. This page also lets a manager
// do it from the office, and see the history.

const dateTime = (iso) => new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });

export default function ShiftsPage() {
    const [stores, setStores] = useState(null);
    const [storeId, setStoreId] = useState('');
    const [register, setRegister] = useState('T1');
    const [current, setCurrent] = useState(undefined); // undefined = loading, null = till closed
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);

    // 1. Load the stores this account can use, and pick the first one.
    useEffect(() => {
        let cancelled = false;
        api.get('/stores')
            .then((res) => {
                if (cancelled) return;
                setStores(res.stores);
                if (res.stores.length > 0) setStoreId(res.stores[0].id);
            })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, []);

    // 2. Whenever the store or till changes: load that till's open shift and the store's history.
    const tillCode = register.trim().toUpperCase();
    useEffect(() => {
        if (!storeId || !/^[A-Z0-9._-]{1,20}$/.test(tillCode)) return undefined;
        // If the user picks another till before this answer arrives, `cancelled` becomes true and the
        // old answer is ignored. Otherwise a slow reply for T1 could overwrite the screen for T2.
        let cancelled = false;
        Promise.all([
            api.get(`/shifts/current?store_id=${encodeURIComponent(storeId)}&register=${encodeURIComponent(tillCode)}`),
            api.get(`/shifts?store_id=${encodeURIComponent(storeId)}&limit=20`),
        ])
            .then(([cur, list]) => {
                if (cancelled) return;
                setCurrent(cur.shift);
                setHistory(list.shifts);
                setError(null);
            })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, [storeId, tillCode]);

    // Picking another store or till: show "Loading…" until that till's shift arrives.
    function pickStore(id) {
        setCurrent(undefined);
        setStoreId(id);
    }
    function pickRegister(value) {
        setCurrent(undefined);
        setRegister(value);
    }

    // After opening, a cash movement or closing: show the new state, then refresh the history.
    function onShiftChange(shift) {
        setCurrent(shift);
        api.get(`/shifts?store_id=${encodeURIComponent(storeId)}&limit=20`)
            .then((res) => setHistory(res.shifts))
            .catch(() => {}); // the history is a nice-to-have; the current shift is already shown
    }

    const store = stores?.find((s) => s.id === storeId);

    return (
        <>
            <div className="page-header">
                <h1>Shifts &amp; cash</h1>
            </div>

            {/* Which till are we looking at? */}
            <section className="card till-picker">
                <label className="field" htmlFor="shift-store">
                    <span>Store</span>
                    <select id="shift-store" value={storeId} onChange={(e) => pickStore(e.target.value)} disabled={!stores?.length}>
                        {stores === null && <option>Loading…</option>}
                        {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </label>
                <label className="field" htmlFor="shift-register">
                    <span>Till</span>
                    <input id="shift-register" value={register} maxLength={20} autoComplete="off"
                        onChange={(e) => pickRegister(e.target.value)} placeholder="T1" />
                </label>
            </section>

            {error && <p className="alert error" role="alert">{error}</p>}
            {stores?.length === 0 && <p className="muted">This account has no stores.</p>}

            {store && current === undefined && !error && <p className="muted" role="status">Loading till {tillCode}…</p>}
            {store && current !== undefined && (
                // key: start fresh (empty forms) whenever another till is picked
                <CurrentShift key={`${storeId}/${tillCode}`} shift={current} store={store} register={tillCode} onChange={onShiftChange} />
            )}

            {/* Recent shifts at this store */}
            {store && (
                <section className="card">
                    <h2>Recent shifts at {store.name}</h2>
                    {history.length === 0 && <p className="muted">No shifts yet.</p>}
                    {history.length > 0 && (
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Opened</th>
                                        <th>Till</th>
                                        <th>Opened by</th>
                                        <th className="num">Float</th>
                                        <th className="num">Expected</th>
                                        <th className="num">Counted</th>
                                        <th>Difference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((s) => (
                                        <tr key={s.id}>
                                            <td>{dateTime(s.opened_at)}</td>
                                            <td className="mono">{s.register}</td>
                                            <td>{s.opened_by_name}</td>
                                            <td className="num">{formatRM(s.opening_float)}</td>
                                            <td className="num">{s.status === 'open' ? '—' : formatRM(s.expected_cash)}</td>
                                            <td className="num">{s.status === 'open' ? '—' : formatRM(s.counted_cash)}</td>
                                            <td>{s.status === 'open' ? <span className="chip">Open</span> : <VarianceChip cents={toCents(s.variance)} />}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}
        </>
    );
}
