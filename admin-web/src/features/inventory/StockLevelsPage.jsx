import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import StoreSelect from '../../components/StoreSelect.jsx';
import ViewOnlyNote from './ViewOnlyNote.jsx';

// STOCK LEVELS: how many tagged items of each SKU a store has, from the team's system.
//
// The team's API lists every tagged item in a store (one row per RFID tag). Our backend fetches
// all of them, counts them per SKU, and splits the count by each tag's status in their system
// (e.g. in stock / sold). It keeps the list for 60 seconds; "Refresh" fetches it again.
// Click a SKU's total to see its individual tags.

const time = (iso) => new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function TagsRow({ storeId, sku, colSpan }) {
    const [tags, setTags] = useState(null);
    useEffect(() => {
        let cancelled = false;
        api.get(`/stock/tags?store_id=${encodeURIComponent(storeId)}&sku=${encodeURIComponent(sku)}`)
            .then((res) => { if (!cancelled) setTags(res.tags); })
            .catch(() => { if (!cancelled) setTags([]); });
        return () => { cancelled = true; };
    }, [storeId, sku]);
    return (
        <tr className="history-row">
            <td colSpan={colSpan}>
                {tags === null && <span className="muted small">Loading tags…</span>}
                {tags?.length === 0 && <span className="muted small">No tags.</span>}
                {tags?.length > 0 && (
                    <ul className="tag-grid mono small">
                        {tags.map((t) => <li key={t.epc}>{t.epc} <span className="muted">{t.status}</span></li>)}
                    </ul>
                )}
            </td>
        </tr>
    );
}

export default function StockLevelsPage() {
    const [storeId, setStoreId] = useState('');
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [openSku, setOpenSku] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0); // >0 = the user pressed Refresh

    // Load when the store, the search or Refresh changes. The search waits 300 ms after typing;
    // filtering happens on our backend from its cached list, so it doesn't call the team's API.
    useEffect(() => {
        if (!storeId) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            setLoading(true);
            const params = new URLSearchParams({ store_id: storeId });
            if (query.trim()) params.set('q', query.trim());
            if (refreshKey > 0) params.set('refresh', '1');
            api.get(`/stock/levels?${params}`)
                .then((res) => { if (!cancelled) { setData(res); setError(null); } })
                .catch((err) => { if (!cancelled) setError(err.readable ?? err.message); })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [storeId, query, refreshKey]);

    const statuses = data?.statuses ?? [];
    const colSpan = 4 + statuses.length;

    return (
        <>
            <div className="page-header">
                <h1>Stock levels</h1>
                {data && <span className="muted small">{data.tag_count.toLocaleString('en-MY')} tagged items · as of {time(data.as_of)}{data.from_cache ? ' (cached)' : ''}</span>}
            </div>
            <ViewOnlyNote />

            <section className="card">
                <div className="toolbar">
                    <StoreSelect value={storeId} onChange={(id) => { setOpenSku(null); setData(null); setStoreId(id); }} />
                    <label className="field grow" htmlFor="stock-search"><span>Search</span>
                        <input id="stock-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SKU, product or product code" autoComplete="off" /></label>
                    <div className="button-row toolbar-buttons">
                        <button type="button" className="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading || !storeId}>
                            {loading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {data && !data.complete && (
                    <p className="alert error" role="alert">
                        This store has {data.reported_total.toLocaleString('en-MY')} tagged items; only the first {data.tag_count.toLocaleString('en-MY')} are counted here. Use the team's website for the full figures.
                    </p>
                )}
                {error && <p className="alert error" role="alert">{error}</p>}
                {!error && !data && <p className="muted" role="status">Loading stock (large stores can take a few seconds)…</p>}
                {data?.skus.length === 0 && <p className="muted">{query ? 'Nothing matches.' : 'No tagged items in this store.'}</p>}
                {data?.skus.length > 0 && (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Variation</th>
                                    <th>SKU</th>
                                    <th className="num">Total</th>
                                    {statuses.map((s) => <th key={s} className="num">{s}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {data.skus.map((row) => {
                                    const key = row.sku ?? row.product_code ?? row.product_name;
                                    return [
                                        <tr key={key}>
                                            <td>
                                                <div className="cell-main">{row.product_name ?? 'Unknown product'}</div>
                                                {row.product_code && <div className="muted small mono">{row.product_code}</div>}
                                            </td>
                                            <td>{row.variation || '—'}</td>
                                            <td className="mono">{row.sku ?? '—'}</td>
                                            <td className="num">
                                                {row.sku
                                                    ? <button type="button" className="link-button strong" aria-expanded={openSku === row.sku}
                                                        onClick={() => setOpenSku(openSku === row.sku ? null : row.sku)}>{row.total}</button>
                                                    : row.total}
                                            </td>
                                            {statuses.map((s) => <td key={s} className="num">{row.by_status[s] ?? <span className="muted">0</span>}</td>)}
                                        </tr>,
                                        openSku === row.sku && <TagsRow key={`${key}-tags`} storeId={storeId} sku={row.sku} colSpan={colSpan} />,
                                    ];
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
