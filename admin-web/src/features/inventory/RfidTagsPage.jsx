import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import StoreSelect from '../../components/StoreSelect.jsx';
import { parseEpcs } from '../catalog/epc.js';

// RFID TAGS: a tag inspector (view only).
//
// Inspect: scan or paste up to 50 tags and see, for each one, everything the team's system knows:
//   what it is (product, SKU, variation), where it is (store), its status there, and whether an
//   unfinished transfer/count/adjustment holds it, which explains "why won't this item sell?".
// Search: find tags in one store by part of the EPC, the SKU or the product name.
//
// Assigning new tags to a SKU is done in the team's handheld app (their API has no way to mark
// tags missing/sold/retired directly). See decision 006.

const MAX_INSPECT = 50;

// A colour for the team's tag statuses. We don't know their full list, so we go by common words.
function StatusChip({ status }) {
    if (!status) return <span className="muted">—</span>;
    const s = status.toLowerCase();
    const cls = /missing|lost|stolen/.test(s) ? 'chip danger' : /^(in|available|instock|in stock|active)$/.test(s) ? 'chip ok' : 'chip';
    return <span className={cls}>{status}</span>;
}

function Inspect() {
    const [text, setText] = useState('');
    const [results, setResults] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const boxRef = useRef(null);
    useEffect(() => { boxRef.current?.focus(); }, []);

    const parsed = parseEpcs(text);
    const count = parsed.epcs.length;

    async function inspect() {
        if (count === 0 || count > MAX_INSPECT) return;
        setBusy(true);
        setError(null);
        try {
            const res = await api.post('/tags/inspect', { epcs: parsed.epcs });
            setResults(res.tags);
        } catch (err) {
            setError(err.readable ?? err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="card">
            <label className="field" htmlFor="inspect-box"><span>Tags to inspect (EPC codes, one per line, up to {MAX_INSPECT})</span></label>
            <textarea id="inspect-box" ref={boxRef} className="epc-box" rows={4} value={text} spellCheck={false}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); inspect(); } }}
                placeholder="Scan a tag with the reader, or paste codes here." disabled={busy} />
            <p className="epc-summary" aria-live="polite">
                <strong>{count}</strong> tag{count === 1 ? '' : 's'}
                {count > MAX_INSPECT && <span className="text-error"> · only {MAX_INSPECT} at a time</span>}
                {parsed.duplicates > 0 && <> · {parsed.duplicates} duplicate{parsed.duplicates === 1 ? '' : 's'} ignored</>}
                {parsed.invalid.length > 0 && <span className="text-error"> · not valid: <span className="mono">{parsed.invalid.slice(0, 3).join(', ')}</span></span>}
            </p>
            <div className="button-row">
                <button type="button" className="button primary" onClick={inspect} disabled={busy || count === 0 || count > MAX_INSPECT}>
                    {busy ? 'Inspecting…' : 'Inspect'}
                </button>
                <button type="button" className="button" onClick={() => { setText(''); setResults(null); boxRef.current?.focus(); }} disabled={busy}>Clear</button>
                <span className="muted small">Tip: Ctrl+Enter inspects</span>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}

            {results && (
                <div className="table-scroll sub-section">
                    <table className="data-table">
                        <thead><tr><th>EPC</th><th>Product</th><th>SKU</th><th>Store</th><th>Status</th><th>Held by</th></tr></thead>
                        <tbody>
                            {results.map((t) => (
                                <tr key={t.epc}>
                                    <td className="mono small">{t.epc}</td>
                                    {t.found === false && <td colSpan={5}><span className="chip warn">Not registered</span> <span className="muted small">This tag isn't assigned to any product in the team's system.</span></td>}
                                    {t.found === null && <td colSpan={5}><span className="chip danger">Lookup failed</span> <span className="muted small">{t.error}</span></td>}
                                    {t.found === true && (
                                        <>
                                            <td><div className="cell-main">{t.product_name ?? '—'}</div><div className="muted small">{t.variation ?? ''}</div></td>
                                            <td className="mono">{t.sku ?? '—'}</td>
                                            <td>{t.store_name ?? <span className="muted">Not in a store</span>}</td>
                                            <td>{t.status_error ? <span className="muted small">{t.status_error}</span> : <StatusChip status={t.status} />}</td>
                                            <td>{t.pending_transaction
                                                ? <span className="chip warn" title="An unfinished transfer, count or adjustment includes this tag">{t.pending_transaction_id ? `Pending ${t.pending_transaction_id}` : 'Pending transaction'}</span>
                                                : <span className="muted">—</span>}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function Search() {
    const [storeId, setStoreId] = useState('');
    const [q, setQ] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!storeId || q.trim().length < 2) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            api.get(`/stock/tags?store_id=${encodeURIComponent(storeId)}&q=${encodeURIComponent(q.trim())}`)
                .then((res) => { if (!cancelled) { setResult(res); setError(null); } })
                .catch((err) => { if (!cancelled) setError(err.readable ?? err.message); });
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [storeId, q]);

    const tooShort = q.trim().length < 2;

    return (
        <section className="card">
            <div className="toolbar">
                <StoreSelect value={storeId} onChange={setStoreId} />
                <label className="field grow" htmlFor="tag-search"><span>Search tags</span>
                    <input id="tag-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false}
                        placeholder="Part of an EPC, a SKU or a product name" /></label>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            {tooShort && <p className="muted small">Type at least 2 characters. (The first search in a store loads its tag list, which can take a few seconds.)</p>}
            {!tooShort && result && (
                <>
                    <p className="muted small">{result.total.toLocaleString('en-MY')} tag{result.total === 1 ? '' : 's'} found{result.total > result.tags.length ? `, showing the first ${result.tags.length}` : ''}.</p>
                    {result.tags.length > 0 && (
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead><tr><th>EPC</th><th>Product</th><th>Variation</th><th>SKU</th><th>Status</th></tr></thead>
                                <tbody>
                                    {result.tags.map((t) => (
                                        <tr key={t.epc}>
                                            <td className="mono small">{t.epc}</td>
                                            <td>{t.product_name ?? '—'}</td>
                                            <td>{t.variation ?? '—'}</td>
                                            <td className="mono">{t.sku ?? '—'}</td>
                                            <td><StatusChip status={t.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

export default function RfidTagsPage() {
    const [tab, setTab] = useState('inspect');
    return (
        <>
            <div className="page-header">
                <h1>RFID tags</h1>
                <div className="segmented" role="tablist" aria-label="RFID tags">
                    <button type="button" role="tab" aria-selected={tab === 'inspect'} className={tab === 'inspect' ? 'active' : ''} onClick={() => setTab('inspect')}>Inspect tags</button>
                    <button type="button" role="tab" aria-selected={tab === 'search'} className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Search a store</button>
                </div>
            </div>
            <p className="alert info">View only. To assign new tags to a product, use the team's RFID handheld app.</p>
            {tab === 'inspect' ? <Inspect /> : <Search />}
        </>
    );
}
