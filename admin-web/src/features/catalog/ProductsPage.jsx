import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { MAX_PER_REQUEST, chunk, groupBySku, parseEpcs } from './epc.js';

// PRODUCTS PAGE: find out which products a set of RFID tags belongs to.
//
// How it works, step by step:
//   1. The user scans tags with an RFID reader (the reader "types" each code and presses Enter),
//      or pastes a list of codes into the box.
//   2. We clean the list as they type (see parseEpcs in epc.js): count the good codes, point out typos.
//   3. On "Look up", we send the codes to OUR backend (POST /api/tags/lookup). Our backend asks the
//      team's API (Stock/TagLookup) about each tag and sends back what it found.
//   4. We group the answers by SKU (see groupBySku) and show one row per product variant,
//      plus the tags nobody recognised and the ones that failed.
//
// Why tags and not a normal product list? The team's API can tell us about a tag, but it doesn't
// yet have a "list all products" call. When it does, this page gets a second tab for that.

export default function ProductsPage() {
    // --- What the page remembers ("state") ---
    // React re-draws the page whenever one of these changes.
    const [text, setText] = useState('');            // everything typed/scanned into the box
    const [results, setResults] = useState(null);    // the answer from the server (null = not looked up yet)
    const [loading, setLoading] = useState(false);   // true while we're waiting for the server
    const [progress, setProgress] = useState(null);  // e.g. { done: 200, total: 450 } for big lists
    const [error, setError] = useState(null);        // a message to show if the whole lookup failed

    const boxRef = useRef(null);       // a handle on the text box, so we can put the cursor in it
    const stillOnPage = useRef(true);  // false once the user leaves the page, so we stop updating it

    // When the page opens: mark it as open, and put the cursor in the box so scanning can start
    // straight away. When the user leaves: mark it as closed.
    // Setting `true` here matters: in development React opens, closes and re-opens every page once
    // on purpose (to catch bugs), and without this line the page would think it was closed for good
    // and ignore every answer from the server.
    useEffect(() => {
        stillOnPage.current = true;
        boxRef.current?.focus();
        return () => { stillOnPage.current = false; };
    }, []);

    // Re-check the list every time the box changes (cheap: it's just text processing).
    const parsed = parseEpcs(text);
    const count = parsed.epcs.length;

    // --- Look up: ask the server about every tag ---
    async function lookUp() {
        if (count === 0) return;
        setLoading(true);
        setError(null);
        setResults(null);

        // The server takes at most 200 tags per request, so big lists go in batches, one after another.
        const batches = chunk(parsed.epcs, MAX_PER_REQUEST);
        const combined = { tags: [], unknown: [], failed: [] };
        try {
            for (const batch of batches) {
                if (batches.length > 1) setProgress({ done: combined.tags.length + combined.unknown.length + combined.failed.length, total: count });
                const answer = await api.post('/tags/lookup', { epcs: batch });
                combined.tags.push(...answer.tags);
                combined.unknown.push(...answer.unknown);
                combined.failed.push(...answer.failed);
            }
            if (stillOnPage.current) setResults(combined);
        } catch (err) {
            // If the session expired, api/client.js already sent the user to the login page.
            // Anything else (server down, team API down) is shown here.
            if (stillOnPage.current) setError(err.message);
        } finally {
            if (stillOnPage.current) {
                setLoading(false);
                setProgress(null);
            }
        }
    }

    // Ctrl+Enter in the box = press "Look up" (a plain Enter just starts a new line, like a scanner).
    function onKeyDown(event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            lookUp();
        }
    }

    function clearAll() {
        setText('');
        setResults(null);
        setError(null);
        boxRef.current?.focus();
    }

    // Put the tags that failed back in the box, so the user can try just those again.
    function retryFailed() {
        setText(results.failed.map((f) => f.epc).join('\n'));
        setResults(null);
        boxRef.current?.focus();
    }

    const rows = results ? groupBySku(results.tags) : [];

    // --- What the page shows ---
    return (
        <>
            <div className="page-header">
                <h1>Products</h1>
                <span className="muted">Look up products by RFID tag</span>
            </div>

            {/* Box where tags are scanned or pasted */}
            <section className="card">
                <label className="field" htmlFor="epc-input">
                    <span>RFID tags (EPC codes)</span>
                </label>
                <textarea
                    id="epc-input"
                    ref={boxRef}
                    className="epc-box"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={'Scan tags with the reader, or paste codes here. One per line.\nE280116060000209A1B2C3D4'}
                    rows={6}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={loading}
                />

                {/* Live feedback while typing: how many codes are good, and what's wrong */}
                <p className="epc-summary" aria-live="polite">
                    <strong>{count}</strong> tag{count === 1 ? '' : 's'} ready
                    {parsed.duplicates > 0 && <> · {parsed.duplicates} duplicate{parsed.duplicates === 1 ? '' : 's'} ignored</>}
                    {parsed.invalid.length > 0 && (
                        <span className="text-error">
                            {' '}· {parsed.invalid.length} not a valid EPC: <span className="mono">{parsed.invalid.slice(0, 3).join(', ')}{parsed.invalid.length > 3 ? '…' : ''}</span>
                        </span>
                    )}
                </p>

                <div className="button-row">
                    <button type="button" className="button primary" onClick={lookUp} disabled={loading || count === 0}>
                        {loading ? 'Looking up…' : count === 0 ? 'Look up' : `Look up ${count} tag${count === 1 ? '' : 's'}`}
                    </button>
                    <button type="button" className="button" onClick={clearAll} disabled={loading || (!text && !results)}>
                        Clear
                    </button>
                    <span className="muted small">Tip: Ctrl+Enter looks up</span>
                </div>

                {progress && <p className="muted" role="status">Checked {progress.done} of {progress.total} tags…</p>}
                {error && <p className="alert error" role="alert">{error}</p>}
            </section>

            {/* Results */}
            {results && (
                <section className="card">
                    <div className="results-header">
                        <h2>Results</h2>
                        <div className="chips">
                            <span className="chip">{rows.length} product variant{rows.length === 1 ? '' : 's'}</span>
                            <span className="chip">{results.tags.length} tag{results.tags.length === 1 ? '' : 's'} found</span>
                            {results.unknown.length > 0 && <span className="chip warn">{results.unknown.length} unknown</span>}
                            {results.failed.length > 0 && <span className="chip danger">{results.failed.length} failed</span>}
                        </div>
                    </div>

                    {rows.length === 0 && <p className="muted">None of these tags are registered to a product.</p>}

                    {rows.length > 0 && (
                        // The table can be wider than a phone screen, so it scrolls sideways on its own.
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Variation</th>
                                        <th>SKU</th>
                                        <th className="num">Tags</th>
                                        <th>Store</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.key}>
                                            <td>
                                                <div className="cell-main">{row.productName}</div>
                                                {row.productCode && <div className="muted small mono">{row.productCode}</div>}
                                            </td>
                                            <td>{row.variation || '—'}</td>
                                            <td className="mono">{row.sku ?? '—'}</td>
                                            <td className="num">
                                                {/* Click the number to see the exact tag codes */}
                                                <details className="epc-details">
                                                    <summary>{row.tagCount}</summary>
                                                    <ul className="mono small">{row.epcs.map((epc) => <li key={epc}>{epc}</li>)}</ul>
                                                </details>
                                            </td>
                                            <td>
                                                {row.stores.join(', ') || '—'}
                                                {row.pendingCount > 0 && (
                                                    <div><span className="chip warn" title="These tags are part of a transfer or count that isn't finished">
                                                        {row.pendingCount} in pending transaction
                                                    </span></div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Tags the team's system doesn't know: maybe never registered, or a misread */}
                    {results.unknown.length > 0 && (
                        <div className="sub-section">
                            <h3>Unknown tags</h3>
                            <p className="muted small">Not registered to any product. Check the tag was encoded, or scan it again.</p>
                            <ul className="mono small epc-list">{results.unknown.map((epc) => <li key={epc}>{epc}</li>)}</ul>
                        </div>
                    )}

                    {/* Tags where the lookup itself went wrong, e.g. the team's API was too slow */}
                    {results.failed.length > 0 && (
                        <div className="sub-section">
                            <h3>Failed lookups</h3>
                            <ul className="small epc-list">
                                {results.failed.map((f) => <li key={f.epc}><span className="mono">{f.epc}</span> — {f.error}</li>)}
                            </ul>
                            <button type="button" className="button" onClick={retryFailed}>Try these again</button>
                        </div>
                    )}
                </section>
            )}
        </>
    );
}
