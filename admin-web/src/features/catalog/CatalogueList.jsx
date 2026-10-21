import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import StoreSelect from '../../components/StoreSelect.jsx';

// CATALOGUE: the team's product list (their Product/List), read-only.
//
//   search by name, product code or SKU → one row per product → click it to see its SKUs
//   (variation, price, cost, stock at the chosen store).
//
// Prices here are the TEAM's prices. ALTAI also has its own Prices page; which one the till uses
// is still an open question for the team (docs/api/team-api-reference.md).

const PAGE_SIZE = 25;
const rm = (v) => (v === null || v === undefined ? '—' : `RM ${v}`);

function SkuTable({ skus }) {
    if (!skus.length) return <p className="muted small">No SKUs.</p>;
    return (
        <table className="data-table">
            <thead>
                <tr><th>SKU</th><th>Variation</th><th className="num">Price</th><th className="num">Cost</th><th className="num">In stock</th><th>Active</th></tr>
            </thead>
            <tbody>
                {skus.map((s) => (
                    <tr key={s.sku_id ?? s.sku}>
                        <td className="mono">{s.sku ?? '—'}</td>
                        <td>{s.variation ?? '—'}</td>
                        <td className="num">{rm(s.price)}</td>
                        <td className="num">{rm(s.cost)}</td>
                        <td className="num">
                            {s.balance ?? '—'}
                            {s.balance !== null && s.stock_warn !== null && s.balance <= s.stock_warn && <> <span className="chip warn">low</span></>}
                        </td>
                        <td>{s.active ? 'Yes' : <span className="chip">No</span>}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function CatalogueList() {
    const [storeId, setStoreId] = useState('');
    const [q, setQ] = useState('');
    const [field, setField] = useState('q'); // what the search box searches: name (q), code or sku
    const [page, setPage] = useState(1);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
        if (!storeId) return undefined;
        let cancelled = false;
        // Wait until typing pauses, so we don't ask the team's server on every key press.
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ store_id: storeId, page: String(page), page_size: String(PAGE_SIZE) });
            if (q.trim()) params.set(field, q.trim());
            api.get(`/catalog/products?${params}`)
                .then((res) => { if (!cancelled) { setResult(res); setError(null); } })
                .catch((err) => { if (!cancelled) { setResult(null); setError(err.readable ?? err.message); } });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [storeId, q, field, page]);

    // A new search starts again at page 1 (set here, in the handlers, not in an effect).
    const search = (value) => { setQ(value); setPage(1); };
    const searchBy = (value) => { setField(value); setPage(1); };
    const pickStore = (value) => { setStoreId(value); setPage(1); };

    const products = result?.products ?? [];
    return (
        <section className="card">
            <div className="toolbar">
                <StoreSelect value={storeId} onChange={pickStore} label="Stock at store" />
                <label className="field" htmlFor="cat-field"><span>Search by</span>
                    <select id="cat-field" value={field} onChange={(e) => searchBy(e.target.value)}>
                        <option value="q">Product name</option>
                        <option value="code">Product code</option>
                        <option value="sku">SKU</option>
                    </select>
                </label>
                <label className="field" htmlFor="cat-q"><span>Search</span>
                    <input id="cat-q" value={q} onChange={(e) => search(e.target.value)} placeholder="e.g. tee" autoComplete="off" />
                </label>
            </div>

            {error && <p className="alert error" role="alert">{error}</p>}
            {!error && result === null && <p className="muted" role="status">Loading products…</p>}
            {result && products.length === 0 && <p className="muted">No products found.</p>}
            {products.length > 0 && (
                <div className="table-scroll">
                    <table className="data-table clickable">
                        <thead>
                            <tr><th>Product</th><th>Code</th><th className="num">SKUs</th><th className="num">Price</th><th>Active</th></tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const prices = [...new Set(p.skus.map((s) => s.price).filter(Boolean))];
                                const open = openId === p.product_id;
                                return (
                                    <Fragment key={p.product_id}>
                                        <tr onClick={() => setOpenId(open ? null : p.product_id)}>
                                            <td>
                                                <button type="button" className="row-link" aria-expanded={open}
                                                    onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : p.product_id); }}>
                                                    {p.product_name ?? '—'}
                                                </button>
                                            </td>
                                            <td className="mono">{p.product_code ?? '—'}</td>
                                            <td className="num">{p.sku_count}</td>
                                            <td className="num">{prices.length === 1 ? rm(prices[0]) : prices.length ? <span className="muted small">varies</span> : '—'}</td>
                                            <td>{p.active ? 'Yes' : <span className="chip">No</span>}</td>
                                        </tr>
                                        {open && (
                                            <tr className="detail-row">
                                                <td colSpan={5}><SkuTable skus={p.skus} /></td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* The team's API doesn't say how many products there are in total, so: previous / next. */}
            {result && (page > 1 || products.length === PAGE_SIZE) && (
                <div className="toolbar">
                    <button type="button" className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                    <span className="muted small">Page {page}</span>
                    <button type="button" className="button" disabled={products.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>Next</button>
                </div>
            )}
        </section>
    );
}
