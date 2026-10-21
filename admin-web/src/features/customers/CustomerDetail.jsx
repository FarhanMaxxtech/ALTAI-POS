import { useState } from 'react';
import { api } from '../../api/client.js';
import { formatPhone } from '../../lib/phone.js';
import { CONSENT_QUESTION, CONSENT_SOURCES, sourceLabel } from './consent.js';

// ONE CUSTOMER: details, promotions consent (with its full history), and erasing on request.
//
// Consent is changed here, one channel at a time, always with "how did they answer?", so the
// history shows exactly when and how a customer said yes or no. That history is your proof if
// anyone ever asks why a customer received a message.

const dateTime = (iso) => new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
const date = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });

function ConsentRow({ customer, channel, onChange }) {
    const optedIn = customer[`${channel}_opt_in`];
    const [source, setSource] = useState(optedIn ? 'customer_reply' : 'in_store');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const label = channel === 'whatsapp' ? 'WhatsApp' : 'Email';

    async function record(granted) {
        setBusy(true);
        setError(null);
        try {
            const res = await api.post(`/customers/${customer.id}/consent`, { channel, granted, source });
            onChange(res.customer);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="consent-row">
            <div>
                <div className="consent-title">
                    {label} promotions <span className={optedIn ? 'chip ok' : 'chip'}>{optedIn ? 'Yes' : 'No'}</span>
                </div>
                <p className="muted small">{CONSENT_QUESTION[channel]}</p>
            </div>
            <div className="consent-actions">
                <select value={source} onChange={(e) => setSource(e.target.value)} aria-label={`How they answered (${label})`} disabled={busy}>
                    {CONSENT_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {optedIn
                    ? <button type="button" className="button" onClick={() => record(false)} disabled={busy}>Record "no"</button>
                    : <button type="button" className="button primary" onClick={() => record(true)} disabled={busy}>Record "yes"</button>}
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
        </div>
    );
}

export default function CustomerDetail({ customer, onChange, onEdit, onClose }) {
    const [confirmErase, setConfirmErase] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function erase() {
        setBusy(true);
        setError(null);
        try {
            const res = await api.post(`/customers/${customer.id}/erase`);
            onChange(res.customer);
            setConfirmErase(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (customer.erased_at) {
        return (
            <section className="card">
                <div className="results-header"><h2>Erased customer</h2><button type="button" className="button" onClick={onClose}>Back to list</button></div>
                <p className="muted">This customer's personal data was erased on {dateTime(customer.erased_at)}. Only an anonymous record remains, so past sales still add up.</p>
            </section>
        );
    }

    return (
        <section className="card">
            <div className="results-header">
                <h2>{customer.name}</h2>
                <div className="button-row">
                    <button type="button" className="button" onClick={onEdit}>Edit</button>
                    <button type="button" className="button" onClick={onClose}>Back to list</button>
                </div>
            </div>

            <dl className="totals">
                <div><dt>Phone</dt><dd>{formatPhone(customer.phone)}</dd></div>
                <div><dt>Email</dt><dd>{customer.email ?? '—'}</dd></div>
                <div><dt>Birthday</dt><dd>{customer.birthday ? date(customer.birthday) : '—'}</dd></div>
                <div><dt>Registered</dt><dd>{dateTime(customer.created_at)} by {customer.created_by_name}</dd></div>
            </dl>
            {customer.notes && <p className="small">Notes: {customer.notes}</p>}

            <div className="sub-section">
                <h3>Promotions</h3>
                {/* key changes with the answer, so the row starts fresh (default "how") after each change */}
                <ConsentRow key={`wa-${customer.whatsapp_opt_in}`} customer={customer} channel="whatsapp" onChange={onChange} />
                <ConsentRow key={`em-${customer.email_opt_in}`} customer={customer} channel="email" onChange={onChange} />
            </div>

            <div className="sub-section">
                <h3>Consent history</h3>
                <ul className="history-list">
                    {customer.consent_history.map((h, i) => (
                        <li key={i}>
                            <span className="muted small">{dateTime(h.created_at)}</span>
                            <span>{h.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}: <strong>{h.granted ? 'yes' : 'no'}</strong></span>
                            <span className="muted small">{sourceLabel(h.source)} · recorded by {h.recorded_by_name}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="sub-section danger-zone">
                <h3>Erase personal data</h3>
                <p className="muted small">Use this only when the customer asks to have their data deleted. Their name, phone, email and notes are removed for good, including from messages already sent. This can't be undone.</p>
                {!confirmErase && <button type="button" className="button danger" onClick={() => setConfirmErase(true)}>Erase {customer.name}'s data…</button>}
                {confirmErase && (
                    <div className="button-row">
                        <button type="button" className="button danger-solid" onClick={erase} disabled={busy}>{busy ? 'Erasing…' : 'Yes, erase permanently'}</button>
                        <button type="button" className="button" onClick={() => setConfirmErase(false)} disabled={busy}>Cancel</button>
                    </div>
                )}
                {error && <p className="alert error" role="alert">{error}</p>}
            </div>
        </section>
    );
}
