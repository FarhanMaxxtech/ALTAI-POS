import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import StoreSelect from '../../components/StoreSelect.jsx';
import ViewOnlyNote from './ViewOnlyNote.jsx';

// TRANSFERS, STOCK COUNTS, ADJUSTMENTS and CHECKOUTS: one page, four uses.
// All four are lists of stock "transactions" in the team's system, with the same shape:
//   filter by store and dates (max ~3 months) → list → click one → its details, one line per SKU.
//
// Field names follow the team's API docs (docs/api/team-api-reference.md). What differs per kind is
// the quantity: transfers and checkouts have a quantity, adjustments have "in" and "out", stock
// counts have counted / expected / difference. "Original record" at the bottom of a detail shows
// everything the team's system sent, so nothing is hidden if our mapping misses a field.

const KINDS = {
    transfers: { title: 'Transfers', one: 'Transfer', help: 'Stock moved from this store to another store or the warehouse.' },
    counts: { title: 'Stock counts', one: 'Stock count', help: 'Stock takes done with the RFID handheld, and their result.' },
    adjustments: { title: 'Adjustments', one: 'Adjustment', help: 'Corrections to stock: items added (stock in) or removed (stock out).' },
    checkouts: { title: 'Checkouts', one: 'Checkout', help: 'Items checked out (sold) at the till, taken out of this store\'s stock.' },
};

// The quantity columns of a detail line, per kind: [heading, field].
const LINE_COLUMNS = {
    transfers: [['Qty', 'qty']],
    checkouts: [['Qty', 'qty']],
    adjustments: [['In', 'qty_in'], ['Out', 'qty_out']],
    counts: [['Counted', 'counted'], ['Expected', 'expected'], ['Difference', 'variance']],
};

// A transfer lists each SKU twice: TFO (out of the source store) and TFI (into the destination).
const LINE_TYPES = { TFO: 'Out', TFI: 'In' };

const isoDay = (d) => d.toISOString().slice(0, 10);
const shortDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};
const signed = (n) => (n === null || n === undefined ? '—' : n > 0 ? `+${n}` : String(n));
const storeLabel = (name, code) => (name ? (code ? `${name} (${code})` : name) : '—');

function StatusChip({ t }) {
    if (!t.status_label) return '—';
    const approved = /approved/i.test(t.status_label);
    return <span className={`chip${approved ? ' ok' : ''}`} title={`Code ${t.status}`}>{t.status_label}</span>;
}

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

    const columns = LINE_COLUMNS[kind];
    return (
        <section className="card">
            <div className="results-header">
                <h2>{KINDS[kind].one} {t?.reference ?? id}</h2>
                <button type="button" className="button" onClick={onClose}>Back to list</button>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            {!error && !t && <p className="muted" role="status">Loading…</p>}
            {t && (
                <>
                    <dl className="totals">
                        <div><dt>Date</dt><dd>{shortDate(t.date)}</dd></div>
                        <div><dt>Status</dt><dd><StatusChip t={t} /></dd></div>
                        {t.type_label && <div><dt>Type</dt><dd>{t.type_label}</dd></div>}
                        {t.trx_id && t.trx_id !== t.reference && <div><dt>Transaction no.</dt><dd className="mono">{t.trx_id}</dd></div>}
                        <div><dt>{kind === 'transfers' ? 'From' : 'Store'}</dt><dd>{storeLabel(t.store_name, t.store_code)}</dd></div>
                        {kind === 'transfers' && <div><dt>To</dt><dd>{storeLabel(t.to_store_name, t.to_store_code)}</dd></div>}
                        {t.totals
                            ? (
                                <>
                                    <div><dt>Counted</dt><dd>{t.totals.counted ?? '—'}</dd></div>
                                    <div><dt>Expected</dt><dd>{t.totals.expected ?? '—'}</dd></div>
                                    <div><dt>Difference</dt><dd>{signed(t.totals.variance)}</dd></div>
                                </>
                            )
                            : <div><dt>Items</dt><dd>{t.item_count}</dd></div>}
                    </dl>
                    {t.remark && <p className="small">Remark: {t.remark}</p>}

                    <div className="sub-section">
                        <h3>Lines ({t.lines.length})</h3>
                        {t.lines.length === 0 && <p className="muted small">The team's system didn't send any lines for this {KINDS[kind].one.toLowerCase()}.</p>}
                        {t.lines.length > 0 && (
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th><th>Variation</th><th>SKU</th>
                                            {kind === 'transfers' && <th>Direction</th>}
                                            {columns.map(([heading]) => <th key={heading} className="num">{heading}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {t.lines.map((l, i) => (
                                            <tr key={`${l.sku}-${l.line_type ?? ''}-${i}`}>
                                                <td>{l.product_name ?? '—'}{l.product_code && <span className="muted small"> · {l.product_code}</span>}</td>
                                                <td>{l.variation ?? '—'}</td>
                                                <td className="mono">{l.sku ?? '—'}</td>
                                                {kind === 'transfers' && <td>{LINE_TYPES[l.line_type] ?? l.line_type ?? '—'}</td>}
                                                {columns.map(([heading, field]) => (
                                                    <td key={heading} className="num">{field === 'variance' ? signed(l[field]) : (l[field] ?? '—')}</td>
                                                ))}
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
                    <StoreSelect value={storeId} onChange={setStoreId} label={kind === 'transfers' ? 'From store' : 'Store'} />
                    <label className="field" htmlFor="tx-from"><span>From</span>
                        <input id="tx-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label className="field" htmlFor="tx-to"><span>To</span>
                        <input id="tx-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                    <label className="field" htmlFor="tx-status"><span>Status (optional)</span>
                        <input id="tx-status" value={status} onChange={(e) => setStatus(e.target.value)}
                            placeholder={kind === 'counts' ? 'e.g. approved' : 'name or code'} autoComplete="off" /></label>
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
                                    {kind === 'counts' && <><th className="num">Counted</th><th className="num">Expected</th><th className="num">Difference</th></>}
                                    <th>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((t, i) => (
                                    <tr key={t.id || i} onClick={() => t.id && setOpenId(t.id)}>
                                        <td>{shortDate(t.date)}</td>
                                        <td>
                                            {t.id
                                                ? <button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>{t.reference}</button>
                                                : '—'}
                                        </td>
                                        {kind === 'adjustments' && <td>{t.type_label ?? '—'}</td>}
                                        {kind === 'transfers' && <td>{storeLabel(t.to_store_name, t.to_store_code)}</td>}
                                        <td><StatusChip t={t} /></td>
                                        {kind === 'counts' && (
                                            <>
                                                <td className="num">{t.totals?.counted ?? '—'}</td>
                                                <td className="num">{t.totals?.expected ?? '—'}</td>
                                                <td className="num">{signed(t.totals?.variance)}</td>
                                            </>
                                        )}
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

// The four menu pages.
export const TransfersPage = () => <TransactionsPage kind="transfers" />;
export const StockCountsPage = () => <TransactionsPage kind="counts" />;
export const AdjustmentsPage = () => <TransactionsPage kind="adjustments" />;
export const CheckoutsPage = () => <TransactionsPage kind="checkouts" />;
