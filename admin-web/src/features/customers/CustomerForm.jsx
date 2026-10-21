import { useState } from 'react';
import { api } from '../../api/client.js';
import { CONSENT_QUESTION, CONSENT_SOURCES } from './consent.js';

// REGISTER A CUSTOMER (or edit one, when `customer` is given).
//
// The phone number is required: it's how the cashier finds the customer next time, and it's the
// WhatsApp address. When registering, the two consent questions are shown as the cashier should ask
// them. The boxes are never pre-ticked: a customer only gets promotions if they actually say yes.
// (When editing, consent is changed separately, in the customer's detail, so every change is recorded.)

export default function CustomerForm({ customer, onSaved, onCancel }) {
    const editing = Boolean(customer);
    const [form, setForm] = useState({
        phone: customer?.phone ?? '',
        name: customer?.name ?? '',
        email: customer?.email ?? '',
        birthday: customer?.birthday ?? '',
        notes: customer?.notes ?? '',
        whatsapp_opt_in: false,
        email_opt_in: false,
        consent_source: 'in_store',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setFieldErrors({});

        // Empty optional fields are sent as null ("no value"), not as empty text.
        const body = {
            phone: form.phone,
            name: form.name,
            email: form.email.trim() || null,
            birthday: form.birthday || null,
            notes: form.notes.trim() || null,
        };
        if (!editing) Object.assign(body, {
            whatsapp_opt_in: form.whatsapp_opt_in,
            email_opt_in: form.email_opt_in,
            consent_source: form.consent_source,
        });

        try {
            const res = editing
                ? await api.patch(`/customers/${customer.id}`, body)
                : await api.post('/customers', body);
            onSaved(res.customer);
        } catch (err) {
            // Show the server's reasons next to the right field, e.g. "Enter a valid phone number".
            const byField = {};
            for (const d of err.details ?? []) if (d.field) byField[d.field.replace(/^body\./, '')] = d.message;
            setFieldErrors(byField);
            setError(Object.keys(byField).length ? 'Please check the highlighted fields.' : err.message);
        } finally {
            setBusy(false);
        }
    }

    const fieldError = (name) => fieldErrors[name] && <span className="field-error">{fieldErrors[name]}</span>;

    return (
        <form className="card customer-form" onSubmit={submit} noValidate>
            <h2>{editing ? `Edit ${customer.name}` : 'Register a customer'}</h2>

            <div className="form-grid">
                <label className="field" htmlFor="c-phone">
                    <span>Phone number *</span>
                    <input id="c-phone" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="off"
                        placeholder="012-345 6789" aria-invalid={Boolean(fieldErrors.phone)} autoFocus={!editing} />
                    {fieldError('phone')}
                </label>
                <label className="field" htmlFor="c-name">
                    <span>Name *</span>
                    <input id="c-name" value={form.name} onChange={set('name')} autoComplete="off" aria-invalid={Boolean(fieldErrors.name)} />
                    {fieldError('name')}
                </label>
                <label className="field" htmlFor="c-email">
                    <span>Email</span>
                    <input id="c-email" type="email" value={form.email} onChange={set('email')} autoComplete="off" aria-invalid={Boolean(fieldErrors.email)} />
                    {fieldError('email')}
                </label>
                <label className="field" htmlFor="c-birthday">
                    <span>Birthday</span>
                    <input id="c-birthday" type="date" value={form.birthday} onChange={set('birthday')} />
                    {fieldError('birthday')}
                </label>
            </div>
            <label className="field" htmlFor="c-notes">
                <span>Notes</span>
                <input id="c-notes" value={form.notes} onChange={set('notes')} maxLength={500} placeholder="e.g. prefers size M, VIP" />
            </label>

            {!editing && (
                <fieldset className="consent-box">
                    <legend>Promotions: ask the customer</legend>
                    <label className="check">
                        <input id="c-wa" type="checkbox" checked={form.whatsapp_opt_in} onChange={set('whatsapp_opt_in')} />
                        <span>{CONSENT_QUESTION.whatsapp} <strong>They said yes.</strong></span>
                    </label>
                    <label className="check">
                        <input id="c-em" type="checkbox" checked={form.email_opt_in} onChange={set('email_opt_in')} />
                        <span>{CONSENT_QUESTION.email} <strong>They said yes.</strong></span>
                    </label>
                    <label className="field" htmlFor="c-source">
                        <span>How did they answer?</span>
                        <select id="c-source" value={form.consent_source} onChange={set('consent_source')}>
                            {CONSENT_SOURCES.filter((s) => s.value !== 'customer_reply').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                    <p className="muted small">Leave a box unticked if they said no or weren't asked. They won't get promotions on that channel.</p>
                </fieldset>
            )}

            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="button-row">
                <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Register customer'}</button>
                <button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </form>
    );
}
