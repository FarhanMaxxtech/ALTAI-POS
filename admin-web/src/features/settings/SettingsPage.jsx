import { useRef, useEffect, useState } from 'react';

const TAX_RE = /^\d{1,3}(\.\d{1,2})?$/;

function isValidTax(value) {
    return TAX_RE.test(value) && Number(value) <= 100;
}

const SAMPLE_ITEMS = [
    { name: 'Classic Tee Black M', price: '49.90' },
    { name: 'Slim Jeans Blue 32', price: '129.00' },
];

export default function SettingsPage() {
    const [stores, setStores] = useState(null);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [toast, setToast] = useState(null);

    const timer = useRef(null);
    const current = stores?.find((s) => s.id === selectedId);
    const changed = JSON.stringify(draft) !== JSON.stringify(current);

    function showToast(type, text) {
        clearTimeout(timer.current);
        setToast({ type, text });
        timer.current = setTimeout(() => setToast(null), 3000);
    }

    function discard() {
        setDraft(current);
    }

    function save() {
        if (!draft.name.trim()) {
            showToast('error', 'Name is required!');
            return;
        }
        if (!isValidTax(draft.tax_rate)) {
            showToast('error', 'Enter a valid tax!');
            return;
        }
        if (draft.receipt_footer.length > 200) {
            showToast('error', 'Receipt footer is too long (max 200 characters)');
            return;
        }
        setStores(stores.map((s) => (s.id === draft.id ? draft : s)));
        showToast('success', 'Saved!')
    }

    useEffect(() => {
        loadStores()
            .then((data) => {
                setStores(data);
                setSelectedId(data[0].id);
                setDraft(data[0]);
            })
            .catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        function warn(e) {
            if (changed) e.preventDefault();
        }
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changed]);

    function selectStore(store) {
        if (changed && !confirm('You have unsaved changes. Discard them?')) {
            return;
        }
        setSelectedId(store.id);
        setDraft(store);
    }

    return (
        <>
            <div className='page-head'>
                <div>
                    <h1>Store Settings</h1>
                    <p className="muted">What the till uses for receipts and tax.</p>
                </div>
                <div className="store-tabs" >
                    {stores?.map((s) => (
                        <button key={s.id} type="button"
                            className={`store-tab ${s.id === selectedId ? 'active' : ''}`}
                            onClick={() => selectStore(s)}>
                            {s.name}
                        </button>
                    ))}
                </div>
            </div>

            {error && <p className="alert error">{error}</p>}
            {!error && !draft && <p className="muted">Loading stores…</p>}
            {draft && (
                <div className='layout'>
                    <div><StoreDetails draft={draft} setDraft={setDraft} /></div>
                    <ReceiptPreview draft={draft} />
                </div>
            )}

            {changed && (
                <div className="save-bar show">
                    <span>Unsaved changes</span>
                    <span>
                        <button type="button" className="button ghost" onClick={discard}>Discard</button>
                        <button type="button" className="button primary" onClick={save}>Save changes</button>
                    </span>
                </div>
            )}
            {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}
        </>
    );
}

function StoreDetails({ draft, setDraft }) {
    const nameBad = !draft.name.trim();
    const taxBad = !isValidTax(draft.tax_rate);
    const footerLen = draft.receipt_footer.length;

    return (
        <>
            <section className="card">
                <div className="card-head">
                    <div className="icon" aria-hidden="true">🏬</div>
                    <div>
                        <h2>Store details</h2>
                        <p className="muted small">Shown at the top of every receipt.</p>
                    </div>
                </div>

                <label className="field">
                    <span>Store name</span>
                    <input className={nameBad ? 'invalid' : ''} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <small className="hint">Required.</small>
                </label>

                <label className="field">
                    <span>Address</span>
                    <textarea rows="2" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                </label>
            </section>

            <section className="card">
                <div className="card-head">
                    <div className="icon" aria-hidden="true">％</div>
                    <div>
                        <h2>Tax</h2>
                        <p className="muted small">Leave 0.00 if this store doesn't charge SST at the till.</p>
                    </div>
                </div>

                <label className="field">
                    <span>Tax rate</span>
                    <div className={`input-with-action ${taxBad ? 'invalid' : ''}`}>
                        <input inputMode="decimal" value={draft.tax_rate} onChange={(e) => setDraft({ ...draft, tax_rate: e.target.value })} />
                        <span className="suffix">%</span>
                    </div>
                    <small className="hint">0 - 100, max 2 decimals.</small>
                </label>

                <div className='toggle-row'>
                    <div>
                        <strong> Prices include tax</strong>
                        <p className="muted small">On: the price tag is what the customer pays. Off: tax is added at checkout.</p>
                    </div>
                    <label className="switch">
                        <input type="checkbox"
                            checked={draft.prices_include_tax}
                            onChange={(e) => setDraft({ ...draft, prices_include_tax: e.target.checked })}
                        />
                        <span className='slider'></span>
                    </label>
                </div>

            </section>

            <section className="card">
                <div className="card-head">
                    <div className="icon" aria-hidden="true">🧾</div>
                    <div>
                        <h2>Receipt footer</h2>
                        <p className="muted small">Printed under the totals. Line breaks are kept.</p>
                    </div>
                </div>

                <label className="field">
                    <span>Footer text <span className={`counter ${footerLen > 180 ? 'warn' : ''}`}>{footerLen} / 200</span></span>
                    <textarea rows="3" maxLength={200} value={draft.receipt_footer} onChange={(e) => setDraft({ ...draft, receipt_footer: e.target.value })} />
                    <small className="hint">Max 200 characters.</small>
                </label>
            </section>

        </>
    );
}

function loadStores() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                {
                    id: 1,
                    name: 'Altai Demo Store',
                    address: 'Klang Malaysia',
                    tax_rate: '10.00',
                    prices_include_tax: true,
                    receipt_footer: 'Thank you for shopping with us!',
                },
                {
                    id: 2,
                    name: 'UV',
                    address: 'KL',
                    tax_rate: '0.00',
                    prices_include_tax: false,
                    receipt_footer: 'Exchanges within 7 days with receipt.',
                },
            ]);
        }, 1000);
    });
}

function ReceiptPreview({ draft }) {

    const subtotal = SAMPLE_ITEMS.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0);
    const rate = Number(draft.tax_rate) || 0;

    const tax = draft.prices_include_tax
        ? Math.round(subtotal - (subtotal / (1 + rate / 100)))
        : Math.round(subtotal * rate / 100);

    const total = draft.prices_include_tax ? subtotal : subtotal + tax;
    const rm = (cents) => (cents / 100).toFixed(2);

    return (
        <>
            <aside className="preview">
                <p className='muted small'>LIVE PREVIEW</p>
                <div className='receipt' aria-live="polite">
                    <div className='c b'>{draft.name || 'Store Name'}</div>
                    <div className='c foot'>{draft.address}</div>
                    <hr />
                    {SAMPLE_ITEMS.map((item) => (
                        <div className='row' key={item.name}><span>{item.name}</span><span>{item.price}</span></div>
                    ))}
                    <hr />
                    <div className='row'><span>Subtotal</span><span>{rm(subtotal)}</span></div>
                    {rate > 0 && (
                        <div className='row'>
                            <span>SST {draft.tax_rate}%{draft.prices_include_tax ? ' (incl.)' : ' '}</span>
                            <span>{rm(tax)}</span>
                        </div>
                    )}
                    <div className='row b'><span>TOTAL</span><span>{rm(total)}</span></div>
                    <hr />
                    <div className='foot'>{draft.receipt_footer}</div>
                </div>
            </aside>
        </>
    );
}