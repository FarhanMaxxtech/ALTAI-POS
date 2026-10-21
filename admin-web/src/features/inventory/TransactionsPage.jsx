import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import StoreSelect from '../../components/StoreSelect.jsx';
import ViewOnlyNote from './ViewOnlyNote.jsx';

// TRANSFERS, STOCK COUNTS and ADJUSTMENTS: one page, three uses.
// All three are lists of stock "transactions" in the team's system, with the same shape:
//   filter by store and dates (max ~3 months) → list → click one → its details and items.
//
// Field names: the team's API doesn't document these responses, so our backend maps the likely
// names (date, status, from/to store, quantity…) and also returns the original record. "Original
// record" at the bottom of a detail shows everything the team's system sent, so nothing is hidden
// if our mapping misses a field.

const KINDS = {
    transfers: { title: 'Transfers', noun: 'transfer', help: 'Stock moved from this store to another store or the warehouse.' },
    counts: { title: 'Stock counts', noun: 'stock count', help: 'Stock takes done with the RFID handheld, and their result.' },
    adjustments: { title: 'Adjustments', noun: 'adjustment', help: 'Corrections to stock, e.g. damaged, lost or found items.' },
};

const isoDay = (d) => d.toISOString().slice(0, 10);
const shortDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

function Detail({ kind, id, onClose }) {
    const [t, setT] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        api.get(`/stock/${kind}/${encodeURIComponent(id)}`)
            .then((res) => { if (!cancelled) setT(res.transaction); })
            .catch((err) => { if (!cancelled) setError(err.readable ?? err.message); });
        return () => { cancelled = true; };
    }, [kind, id]);

    return (
        <section className="card">
            <div className="results-header">
                <h2>{KINDS[kind].title.replace(/s$/, '')} {t?.reference ?? id}</h2>
                <button type="button" className="button" onClick={onClose}>Back to list</button>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            {!error && !t && <p className="muted" role="status">Loading…</p>}
            {t && (
                <>
                    <dl className="totals">
                        <div><dt>Date</dt><dd>{shortDate(t.date)}</dd></div>
                        <div><dt>Status</dt><dd>{t.status ? <span className="chip">{t.status}</span> : '—'}</dd></div>
                        {t.type && <div><dt>Type</dt><dd>{t.type}</dd></div>}
                        <div><dt>{kind === 'transfers' ? 'From' : 'Store'}</dt><dd>{t.store_name ?? '—'}</dd></div>
                        {kind === 'transfers' && <div><dt>To</dt><dd>{t.to_store_name ?? '—'}</dd></div>}
                        <div><dt>Items</dt><dd>{t.quantity ?? t.lines.length}</dd></div>
                        {t.created_by && <div><dt>By</dt><dd>{t.created_by}</dd></div>}
                    </dl>
                    {t.remark && <p className="small">Remark: {t.remark}</p>}

                    <div className="sub-section">
                        <h3>Items ({t.lines.length})</h3>
                        {t.lines.length === 0 && <p className="muted small">The team's system didn't send an item list for this {KINDS[kind].noun}.</p>}
                        {t.lines.length > 0 && (
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead><tr><th>Product</th><th>Variation</th><th>SKU</th><th>EPC</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {t.lines.map((l, i) => (
                                            <tr key={l.epc ?? i}>
                                                <td>{l.product_name ?? '—'}</td>
                                                <td>{l.variation ?? '—'}</td>
                                                <td className="mono">{l.sku ?? '—'}</td>
                                                <td className="mono small">{l.epc ?? '—'}</td>
                                                <td>{l.status ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <details className="sub-section raw-record">
                        <summary>Original record from the team's system</summary>
                        <pre className="mono small">{JSON.stringify(t.raw, null, 2)}</pre>
                    </details>
                </>
            )}
        </section>
    );
}

export default function TransactionsPage({ kind }) {
    const info = KINDS[kind];
    const [storeId, setStoreId] = useState('');
    const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 86400_000)));
    const [to, setTo] = useState(() => isoDay(new Date()));
    const [status, setStatus] = useState('');
    const [list, setList] = useState(null);
    const [error, setError] = useState(null);
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
        if (!storeId || !from || !to) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ store_id: storeId, from, to });
            if (status.trim()) params.set('status', status.trim());
            api.get(`/stock/${kind}?${params}`)
                .then((res) => { if (!cancelled) { setList(res.transactions); setError(null); } })
                .catch((err) => { if (!cancelled) { setList(null); setError(err.readable ?? err.message); } });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [kind, storeId, from, to, status]);

    if (openId) return <Detail kind={kind} id={openId} onClose={() => setOpenId(null)} />;

    return (
        <>
            <div className="page-header">
                <h1>{info.title}</h1>
                <span className="muted small">{info.help}</span>
            </div>
            <ViewOnlyNote />

            <section className="card">
                <div className="toolbar">
                    <StoreSelect value={storeId} onChange={setStoreId} />
                    <label className="field" htmlFor="tx-from"><span>From</span>
                        <input id="tx-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label className="field" htmlFor="tx-to"><span>To</span>
                        <input id="tx-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                    <label className="field" htmlFor="tx-status"><span>Status (optional)</span>
                        <input id="tx-status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. pending" autoComplete="off" /></label>
                </div>

                {error && <p className="alert error" role="alert">{error}</p>}
                {!error && list === null && <p className="muted" role="status">Loading {info.title.toLowerCase()}…</p>}
                {list?.length === 0 && <p className="muted">No {info.title.toLowerCase()} in this period.</p>}
                {list?.length > 0 && (
                    <div className="table-scroll">
                        <table className="data-table clickable">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    {kind === 'adjustments' && <th>Type</th>}
                                    {kind === 'transfers' && <th>To</th>}
                                    <th>Status</th>
                                    <th className="num">Items</th>
                                    <th>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((t, i) => (
                                    <tr key={t.id || i} onClick={() => t.id && setOpenId(t.id)}>
                                        <td>{shortDate(t.date)}</td>
                                        <td>
                                            {t.id
                                                ? <button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>{t.reference ?? t.id}</button>
                                                : '—'}
                                        </td>
                                        {kind === 'adjustments' && <td>{t.type ?? '—'}</td>}
                                        {kind === 'transfers' && <td>{t.to_store_name ?? '—'}</td>}
                                        <td>{t.status ? <span className="chip">{t.status}</span> : '—'}</td>
                                        <td className="num">{t.quantity ?? '—'}</td>
                                        <td className="muted small">{t.remark ?? ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}

// The three menu pages.
export const TransfersPage = () => <TransactionsPage kind="transfers" />;
export const StockCountsPage = () => <TransactionsPage kind="counts" />;
export const AdjustmentsPage = () => <TransactionsPage kind="adjustments" />;
