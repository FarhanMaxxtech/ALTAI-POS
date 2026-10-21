import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { formatRM } from '../../lib/money.js';
import { roundCash, splitTax } from '../../lib/tax.js';

// SETTINGS PAGE
//
// Business: name, registration numbers, and the tax rules every sale will use:
//   - SST rate (e.g. 6 or 10). Starts at 0% until someone who knows the right rate sets it.
//   - "Prices include SST": is the tax already inside the price on the tag? (normal in Malaysia)
//   - Cash rounding: round cash totals to the nearest 5 sen (Bank Negara's rule).
//   A live example shows what the choice means for a RM 49.90 tag.
// Receipts: per store, the address, phone and footer (e.g. the return policy), with a preview.

const EXAMPLE_CENTS = 4990;
const RECEIPT_WIDTH = 32; // characters per line on a typical 58 mm receipt printer

// Centre a line of text on the receipt, the way a thermal printer would.
const centre = (text) => {
    const line = text.slice(0, RECEIPT_WIDTH);
    return ' '.repeat(Math.max(0, Math.floor((RECEIPT_WIDTH - line.length) / 2))) + line;
};

function TaxExample({ rate, inclusive, rounding }) {
    const split = splitTax(EXAMPLE_CENTS, rate, inclusive);
    if (!split) return <p className="muted small">Enter a valid rate to see an example.</p>;
    const rm = (c) => formatRM(c, { fromCentsValue: true });
    const cash = rounding ? roundCash(split.total) : split.total;
    return (
        <div className="tax-example" aria-live="polite">
            <div className="stat-label">Example: a tag that says {rm(EXAMPLE_CENTS)}</div>
            <dl className="totals">
                <div><dt>Before SST</dt><dd>{rm(split.net)}</dd></div>
                <div><dt>SST {rate}%</dt><dd>{rm(split.tax)}</dd></div>
                <div><dt>Customer pays</dt><dd>{rm(split.total)}</dd></div>
                <div><dt>If paying cash</dt><dd>{rm(cash)}</dd></div>
            </dl>
            <p className="muted small">
                {inclusive
                    ? 'The tax is already inside the tag price, so the customer pays exactly what the tag says.'
                    : 'The tax is added on top, so the customer pays more than the tag says.'}
                {rounding && cash !== split.total && ' Cash totals are rounded to the nearest 5 sen.'}
            </p>
        </div>
    );
}

// The saved settings as form fields (text boxes need text, not null).
function toForm(s) {
    return {
        business_name: s.business_name ?? '', company_reg_no: s.company_reg_no ?? '', sst_reg_no: s.sst_reg_no ?? '',
        sst_rate: String(Number(s.sst_rate)), prices_include_tax: s.prices_include_tax, cash_rounding: s.cash_rounding,
        default_receipt_footer: s.default_receipt_footer ?? '',
    };
}

// `saved` = the business settings as last loaded/saved (shared with the receipt preview).
function BusinessSettings({ saved, onSaved }) {
    const [form, setForm] = useState(() => toForm(saved));
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
            const res = await api.put('/settings/business', {
                ...form,
                business_name: form.business_name.trim() || null,
                company_reg_no: form.company_reg_no.trim() || null,
                sst_reg_no: form.sst_reg_no.trim() || null,
                default_receipt_footer: form.default_receipt_footer.trim() || null,
            });
            onSaved(res.settings);
            setForm(toForm(res.settings));
            setMessage({ type: 'info', text: 'Saved. New sales will use these settings.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.details?.length ? err.details.map((d) => d.message).join(' · ') : err.message });
        } finally {
            setBusy(false);
        }
    }

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

    return (
        <form className="card" onSubmit={save}>
            <h2>Business &amp; tax</h2>
            <div className="form-grid">
                <label className="field" htmlFor="s-name"><span>Business name (on receipts)</span>
                    <input id="s-name" value={form.business_name} onChange={set('business_name')} maxLength={150} /></label>
                <label className="field" htmlFor="s-ssm"><span>Company registration no. (SSM)</span>
                    <input id="s-ssm" value={form.company_reg_no} onChange={set('company_reg_no')} maxLength={50} /></label>
                <label className="field" htmlFor="s-sstno"><span>SST registration no.</span>
                    <input id="s-sstno" value={form.sst_reg_no} onChange={set('sst_reg_no')} maxLength={50} placeholder="Leave empty if not registered" /></label>
                <label className="field" htmlFor="s-rate"><span>SST rate (%)</span>
                    <input id="s-rate" inputMode="decimal" value={form.sst_rate} onChange={set('sst_rate')} /></label>
            </div>
            <label className="check">
                <input id="s-incl" type="checkbox" checked={form.prices_include_tax} onChange={set('prices_include_tax')} />
                <span><strong>Prices include SST.</strong> The price on the tag is what the customer pays.</span>
            </label>
            <label className="check">
                <input id="s-round" type="checkbox" checked={form.cash_rounding} onChange={set('cash_rounding')} />
                <span><strong>Round cash payments to the nearest 5 sen</strong> (Bank Negara rounding).</span>
            </label>

            <TaxExample rate={form.sst_rate} inclusive={form.prices_include_tax} rounding={form.cash_rounding} />

            <label className="field" htmlFor="s-footer"><span>Default receipt footer</span>
                <input id="s-footer" value={form.default_receipt_footer} onChange={set('default_receipt_footer')} maxLength={500}
                    placeholder="e.g. Thank you! Exchange within 14 days with receipt." /></label>

            {saved?.updated_by_name && <p className="muted small">Last saved by {saved.updated_by_name}.</p>}
            {message && <p className={`alert ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
            <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
    );
}

function StoreReceiptSettings({ business }) {
    const [stores, setStores] = useState(null);
    const [storeId, setStoreId] = useState('');
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores').then((res) => {
            if (cancelled) return;
            setStores(res.stores);
            if (res.stores.length) setStoreId(res.stores[0].id);
        }).catch((err) => { if (!cancelled) setMessage({ type: 'error', text: err.message }); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!storeId) return undefined;
        let cancelled = false;
        api.get(`/settings/stores/${encodeURIComponent(storeId)}`).then((res) => {
            if (cancelled) return;
            const s = res.settings;
            setForm({ store_name: s.store_name, address: s.address ?? '', phone: s.phone ?? '', receipt_footer: s.receipt_footer ?? '' });
            setMessage(null);
        }).catch((err) => { if (!cancelled) setMessage({ type: 'error', text: err.message }); });
        return () => { cancelled = true; };
    }, [storeId]);

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
            await api.put(`/settings/stores/${encodeURIComponent(storeId)}`, {
                address: form.address.trim() || null, phone: form.phone.trim() || null, receipt_footer: form.receipt_footer.trim() || null,
            });
            setMessage({ type: 'info', text: `Saved for ${form.store_name}.` });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setBusy(false);
        }
    }

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
    const footer = form?.receipt_footer.trim() || business?.default_receipt_footer || '';

    return (
        <form className="card" onSubmit={save}>
            <h2>Receipts per store</h2>
            <label className="field" htmlFor="r-store"><span>Store</span>
                <select id="r-store" value={storeId} onChange={(e) => { setForm(null); setStoreId(e.target.value); }} disabled={!stores?.length}>
                    {stores === null && <option>Loading…</option>}
                    {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></label>

            {form && (
                <div className="receipt-layout">
                    <div>
                        <label className="field" htmlFor="r-address"><span>Address</span>
                            <input id="r-address" value={form.address} onChange={set('address')} maxLength={300} /></label>
                        <label className="field" htmlFor="r-phone"><span>Phone</span>
                            <input id="r-phone" value={form.phone} onChange={set('phone')} maxLength={30} /></label>
                        <label className="field" htmlFor="r-footer"><span>Receipt footer for this store</span>
                            <input id="r-footer" value={form.receipt_footer} onChange={set('receipt_footer')} maxLength={500}
                                placeholder={business?.default_receipt_footer ? `Default: ${business.default_receipt_footer}` : 'e.g. Exchange within 7 days'} /></label>
                        {message && <p className={`alert ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
                        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                    </div>
                    {/* What the top and bottom of this store's receipt will look like */}
                    <pre className="receipt-preview" aria-label="Receipt preview">{[
                        centre(business?.business_name || 'Your business name'),
                        business?.company_reg_no ? centre(`(${business.company_reg_no})`) : null,
                        centre(form.store_name),
                        ...(form.address ? form.address.match(new RegExp(`.{1,${RECEIPT_WIDTH}}(\\s|$)`, 'g')).map((l) => centre(l.trim())) : []),
                        form.phone ? centre(`Tel: ${form.phone}`) : null,
                        business?.sst_reg_no ? centre(`SST No: ${business.sst_reg_no}`) : null,
                        '-'.repeat(RECEIPT_WIDTH),
                        '  …items, totals, payment…',
                        '-'.repeat(RECEIPT_WIDTH),
                        ...(footer ? footer.match(new RegExp(`.{1,${RECEIPT_WIDTH}}(\\s|$)`, 'g')).map((l) => centre(l.trim())) : []),
                    ].filter((l) => l !== null).join('\n')}</pre>
                </div>
            )}
        </form>
    );
}

export default function SettingsPage() {
    // Loaded once here and shared: the business form edits it, the receipt preview shows it.
    const [business, setBusiness] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        api.get('/settings/business')
            .then((res) => { if (!cancelled) setBusiness(res.settings); })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, []);

    return (
        <>
            <div className="page-header"><h1>Settings</h1></div>
            {error && <p className="alert error" role="alert">{error}</p>}
            {!error && !business && <p className="muted" role="status">Loading settings…</p>}
            {business && <BusinessSettings saved={business} onSaved={setBusiness} />}
            {business && <StoreReceiptSettings business={business} />}
        </>
    );
}
