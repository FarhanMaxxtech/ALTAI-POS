import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { formatRM, toCents } from '../../lib/money.js';

// PRICES PAGE
//
// Pick "All stores" to manage DEFAULT prices, or one store to give it its own prices (e.g. an outlet).
// The table shows, per SKU: the default, that store's own price (if any), and the price that applies.
// Actions: set one price, set one price for many SKUs at once, see a SKU's history, remove a store price.
// SKUs come from the team's system (see the Products page); prices live in ALTAI.

const dateTime = (iso) => new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });

function PriceForm({ storeLabel, storeId, initial, onDone, onCancel }) {
    const [form, setForm] = useState({ sku: initial?.sku ?? '', product_name: initial?.product_name ?? '', price: '', reason: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
    const valid = form.sku.trim() && !/\s/.test(form.sku.trim()) && toCents(form.price) !== null && toCents(form.price) >= 0;

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await api.put(`/prices/${encodeURIComponent(form.sku.trim())}`, {
                price: form.price.trim(),
                ...(storeId ? { store_id: storeId } : {}),
                ...(form.product_name.trim() ? { product_name: form.product_name.trim() } : {}),
                ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
            });
            onDone(`Price saved for ${form.sku.trim()}.`);
        } catch (err) {
            setError(err.details?.length ? err.details.map((d) => d.message).join(' · ') : err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="card" onSubmit={submit}>
            <h2>{initial ? `Change price: ${initial.sku}` : 'Set a price'} <span className="muted small">({storeLabel})</span></h2>
            <div className="form-grid">
                <label className="field" htmlFor="p-sku"><span>SKU</span>
                    <input id="p-sku" value={form.sku} onChange={set('sku')} disabled={Boolean(initial)} autoComplete="off" spellCheck={false} placeholder="CT-001-BLK-M" /></label>
                <label className="field" htmlFor="p-name"><span>Product name (label for this list)</span>
                    <input id="p-name" value={form.product_name} onChange={set('product_name')} maxLength={200} autoComplete="off" /></label>
                <label className="field" htmlFor="p-price"><span>Price (RM){initial?.effective_price ? ` · now ${formatRM(initial.effective_price)}` : ''}</span>
                    <input id="p-price" value={form.price} onChange={set('price')} inputMode="decimal" autoComplete="off" autoFocus placeholder="49.90" /></label>
                <label className="field" htmlFor="p-reason"><span>Reason (optional)</span>
                    <input id="p-reason" value={form.reason} onChange={set('reason')} maxLength={255} placeholder="e.g. Raya markdown" /></label>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="button-row">
                <button type="submit" className="button primary" disabled={busy || !valid}>{busy ? 'Saving…' : 'Save price'}</button>
                <button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </form>
    );
}

function BulkForm({ storeLabel, storeId, onDone, onCancel }) {
    const [skusText, setSkusText] = useState('');
    const [price, setPrice] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    // One SKU per line (or separated by commas/spaces). Duplicates are dropped.
    const skus = [...new Set(skusText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
    const valid = skus.length > 0 && skus.length <= 500 && toCents(price) !== null && toCents(price) >= 0;

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await api.post('/prices/bulk', { skus, price: price.trim(), ...(storeId ? { store_id: storeId } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}) });
            onDone(`${res.updated} prices set to ${formatRM(price)}.`);
        } catch (err) {
            setError(err.details?.length ? err.details.map((d) => d.message).join(' · ') : err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="card" onSubmit={submit}>
            <h2>One price for many SKUs <span className="muted small">({storeLabel})</span></h2>
            <label className="field" htmlFor="b-skus"><span>SKUs, one per line (e.g. every size and colour of a style)</span>
                <textarea id="b-skus" className="epc-box" rows={5} value={skusText} onChange={(e) => setSkusText(e.target.value)} spellCheck={false} /></label>
            <p className="muted small">{skus.length} SKU{skus.length === 1 ? '' : 's'}{skus.length > 500 ? ' (max 500 at a time)' : ''}</p>
            <div className="form-grid">
                <label className="field" htmlFor="b-price"><span>Price (RM)</span>
                    <input id="b-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" autoComplete="off" /></label>
                <label className="field" htmlFor="b-reason"><span>Reason (optional)</span>
                    <input id="b-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} /></label>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="button-row">
                <button type="submit" className="button primary" disabled={busy || !valid}>{busy ? 'Saving…' : `Set ${skus.length} price${skus.length === 1 ? '' : 's'}`}</button>
                <button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </form>
    );
}

function HistoryRow({ sku, colSpan, storeNames }) {
    const [history, setHistory] = useState(null);
    useEffect(() => {
        let cancelled = false;
        api.get(`/prices/${encodeURIComponent(sku)}/history`).then((res) => { if (!cancelled) setHistory(res.history); }).catch(() => { if (!cancelled) setHistory([]); });
        return () => { cancelled = true; };
    }, [sku]);
    return (
        <tr className="history-row">
            <td colSpan={colSpan}>
                {history === null && <span className="muted small">Loading history…</span>}
                {history?.length === 0 && <span className="muted small">No changes recorded.</span>}
                {history?.length > 0 && (
                    <ul className="history-list">
                        {history.map((h, i) => (
                            <li key={i}>
                                <span className="muted small">{dateTime(h.created_at)}</span>
                                <span>
                                    {h.store_id ? (storeNames[h.store_id] ?? `Store ${h.store_id}`) : 'Default'}:{' '}
                                    {h.old_price ? formatRM(h.old_price) : 'no price'} → <strong>{h.new_price ? formatRM(h.new_price) : 'removed'}</strong>
                                </span>
                                <span className="muted small">{h.reason ? `${h.reason} · ` : ''}by {h.changed_by_name}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </td>
        </tr>
    );
}

export default function PricesPage() {
    const [stores, setStores] = useState([]);
    const [storeId, setStoreId] = useState(''); // '' = all stores (default prices)
    const [query, setQuery] = useState('');
    const [prices, setPrices] = useState(null);
    const [tax, setTax] = useState(null);
    const [mode, setMode] = useState(null);     // null | { name: 'set', row? } | { name: 'bulk' }
    const [openHistory, setOpenHistory] = useState(null);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores').then((res) => { if (!cancelled) setStores(res.stores); }).catch(() => {});
        api.get('/settings/business').then((res) => { if (!cancelled) setTax(res.settings); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // Load the list; typing waits 300 ms after the last key.
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ limit: '200' });
            if (query.trim()) params.set('q', query.trim());
            if (storeId) params.set('store_id', storeId);
            api.get(`/prices?${params}`)
                .then((res) => { if (!cancelled) { setPrices(res.prices); setError(null); } })
                .catch((err) => { if (!cancelled) setError(err.message); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [query, storeId, reloadKey]);

    const storeNames = Object.fromEntries(stores.map((s) => [s.id, s.name]));
    const storeLabel = storeId ? storeNames[storeId] ?? `Store ${storeId}` : 'default for all stores';

    function done(text) {
        setMode(null);
        setNotice(text);
        setReloadKey((k) => k + 1);
    }

    async function removeStorePrice(sku) {
        setError(null);
        try {
            await api.del(`/prices/${encodeURIComponent(sku)}?store_id=${encodeURIComponent(storeId)}`);
            done(`${sku} now uses the default price at ${storeLabel}.`);
        } catch (err) {
            setError(err.message);
        }
    }

    const colSpan = storeId ? 6 : 5;

    return (
        <>
            <div className="page-header">
                <h1>Prices</h1>
                {tax && <span className="muted small">{Number(tax.sst_rate) > 0 ? `SST ${Number(tax.sst_rate)}% ${tax.prices_include_tax ? 'included in' : 'added to'} these prices` : 'SST not set (0%). Change in Settings'}</span>}
            </div>

            {mode?.name === 'set' && <PriceForm storeLabel={storeLabel} storeId={storeId} initial={mode.row} onDone={done} onCancel={() => setMode(null)} />}
            {mode?.name === 'bulk' && <BulkForm storeLabel={storeLabel} storeId={storeId} onDone={done} onCancel={() => setMode(null)} />}

            <section className="card">
                <div className="toolbar">
                    <label className="field" htmlFor="pr-store"><span>Prices for</span>
                        <select id="pr-store" value={storeId} onChange={(e) => { setStoreId(e.target.value); setMode(null); setOpenHistory(null); }}>
                            <option value="">All stores (default prices)</option>
                            {stores.map((s) => <option key={s.id} value={s.id}>{s.name} (own prices)</option>)}
                        </select></label>
                    <label className="field grow" htmlFor="pr-search"><span>Search</span>
                        <input id="pr-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SKU or product name" autoComplete="off" /></label>
                    <div className="button-row toolbar-buttons">
                        <button type="button" className="button primary" onClick={() => { setNotice(null); setMode({ name: 'set' }); }}>Set a price</button>
                        <button type="button" className="button" onClick={() => { setNotice(null); setMode({ name: 'bulk' }); }}>Many at once</button>
                    </div>
                </div>

                {notice && <p className="alert info" role="status">{notice}</p>}
                {error && <p className="alert error" role="alert">{error}</p>}
                {!error && prices === null && <p className="muted" role="status">Loading prices…</p>}
                {prices?.length === 0 && <p className="muted">{query ? 'No prices match.' : 'No prices yet. Set the first one: SKUs without a price can\'t be sold.'}</p>}
                {prices?.length > 0 && (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Product</th>
                                    <th className="num">Default</th>
                                    {storeId && <th className="num">This store</th>}
                                    <th className="num">{storeId ? 'Charged here' : 'Stores with own price'}</th>
                                    <th><span className="visually-hidden">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {prices.map((p) => [
                                    <tr key={p.sku}>
                                        <td className="mono">{p.sku}</td>
                                        <td>{p.product_name ?? <span className="muted">—</span>}</td>
                                        <td className="num">{p.default_price ? formatRM(p.default_price) : <span className="chip warn">none</span>}</td>
                                        {storeId && <td className="num">{p.store_price ? formatRM(p.store_price) : <span className="muted">—</span>}</td>}
                                        <td className="num">
                                            {storeId
                                                ? (p.effective_price ? <strong>{formatRM(p.effective_price)}</strong> : <span className="chip danger">no price</span>)
                                                : p.store_price_count}
                                        </td>
                                        <td className="actions">
                                            <button type="button" className="link-button" onClick={() => { setNotice(null); setMode({ name: 'set', row: p }); }}>Change</button>
                                            {storeId && p.store_price && <button type="button" className="link-button" onClick={() => removeStorePrice(p.sku)}>Use default</button>}
                                            <button type="button" className="link-button" aria-expanded={openHistory === p.sku}
                                                onClick={() => setOpenHistory(openHistory === p.sku ? null : p.sku)}>History</button>
                                        </td>
                                    </tr>,
                                    openHistory === p.sku && <HistoryRow key={`${p.sku}-history`} sku={p.sku} colSpan={colSpan} storeNames={storeNames} />,
                                ])}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
