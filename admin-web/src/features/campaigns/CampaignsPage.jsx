import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { formatPhone } from '../../lib/phone.js';

// CAMPAIGNS PAGE: promotional messages to customers who agreed to receive them.
//
//   List   → every campaign, newest first.
//   New    → name, channel (WhatsApp or email), the message. {first_name} / {name} get filled in.
//   Open   → a draft can be edited, PREVIEWED (who gets it and exactly what they'll read) and sent.
//            A sent campaign shows every message and its status.
//
// While MESSAGING_MODE=preview (no email/WhatsApp account connected yet), "Send" only RECORDS the
// messages as "previewed". The page says so clearly, so nobody thinks customers were contacted.

const dateTime = (iso) => new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
const CHANNEL = { whatsapp: 'WhatsApp', email: 'Email' };
const STATUS_CHIP = { previewed: 'chip', sent: 'chip ok', failed: 'chip danger' };

function CampaignEditor({ campaign, onSaved, onCancel }) {
    const [form, setForm] = useState({
        name: campaign?.name ?? '',
        channel: campaign?.channel ?? 'whatsapp',
        subject: campaign?.subject ?? '',
        body: campaign?.body ?? '',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const bodyRef = useRef(null);
    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    // Put a placeholder like {first_name} where the cursor is in the message.
    function insert(placeholder) {
        const el = bodyRef.current;
        const start = el?.selectionStart ?? form.body.length;
        const end = el?.selectionEnd ?? form.body.length;
        setForm({ ...form, body: form.body.slice(0, start) + placeholder + form.body.slice(end) });
        requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + placeholder.length, start + placeholder.length); });
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const body = { name: form.name, channel: form.channel, body: form.body, subject: form.channel === 'email' ? (form.subject.trim() || null) : null };
        try {
            const res = campaign ? await api.patch(`/campaigns/${campaign.id}`, body) : await api.post('/campaigns', body);
            onSaved(res.campaign);
        } catch (err) {
            setError(err.details?.length ? err.details.map((d) => d.message).join(' · ') : err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="card" onSubmit={submit} noValidate>
            <h2>{campaign ? 'Edit draft' : 'New campaign'}</h2>
            <div className="form-grid">
                <label className="field" htmlFor="cp-name">
                    <span>Campaign name (only staff see this)</span>
                    <input id="cp-name" value={form.name} onChange={set('name')} placeholder="e.g. Raya sale 2026" autoComplete="off" />
                </label>
                <div className="field">
                    <span>Send by</span>
                    <div className="segmented" role="radiogroup" aria-label="Channel">
                        {['whatsapp', 'email'].map((ch) => (
                            <button key={ch} type="button" role="radio" aria-checked={form.channel === ch}
                                className={form.channel === ch ? 'active' : ''} onClick={() => setForm({ ...form, channel: ch })}>{CHANNEL[ch]}</button>
                        ))}
                    </div>
                </div>
            </div>
            {form.channel === 'email' && (
                <label className="field" htmlFor="cp-subject">
                    <span>Email subject</span>
                    <input id="cp-subject" value={form.subject} onChange={set('subject')} maxLength={150} autoComplete="off" />
                </label>
            )}
            <label className="field" htmlFor="cp-body">
                <span>Message</span>
                <textarea id="cp-body" ref={bodyRef} className="epc-box message-box" rows={6} maxLength={3500} value={form.body} onChange={set('body')}
                    placeholder={'Hi {first_name}! Our Raya sale starts this Friday: 20% off all tees.'} />
            </label>
            <div className="button-row">
                <span className="muted small">Insert:</span>
                <button type="button" className="button small-button" onClick={() => insert('{first_name}')}>{'{first_name}'}</button>
                <button type="button" className="button small-button" onClick={() => insert('{name}')}>{'{name}'}</button>
                <span className="muted small push-right">{form.body.length} / 3500</span>
            </div>
            <p className="muted small">A line telling customers how to stop promotions is added at the end automatically.</p>

            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="button-row">
                <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
                <button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </form>
    );
}

function CampaignDetail({ campaign, onChange, onEdit, onClose }) {
    const [preview, setPreview] = useState(null);
    const [messages, setMessages] = useState(null);
    const [confirmSend, setConfirmSend] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Drafts: load the preview (who gets it, what they read). Sent: load the messages.
    useEffect(() => {
        let cancelled = false;
        const request = campaign.status === 'draft'
            ? api.get(`/campaigns/${campaign.id}/preview`).then((res) => { if (!cancelled) setPreview(res); })
            : api.get(`/campaigns/${campaign.id}/messages?limit=100`).then((res) => { if (!cancelled) setMessages(res.messages); });
        request.catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, [campaign.id, campaign.status]);

    async function send() {
        setBusy(true);
        setError(null);
        try {
            const res = await api.post(`/campaigns/${campaign.id}/send`);
            setConfirmSend(false);
            onChange(res.campaign);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    const previewMode = (preview?.delivery_mode ?? campaign.delivery_mode) === 'preview';

    return (
        <section className="card">
            <div className="results-header">
                <h2>{campaign.name}</h2>
                <div className="button-row">
                    {campaign.status === 'draft' && <button type="button" className="button" onClick={onEdit}>Edit</button>}
                    <button type="button" className="button" onClick={onClose}>Back to list</button>
                </div>
            </div>
            <p className="muted small">
                {CHANNEL[campaign.channel]} · created {dateTime(campaign.created_at)} by {campaign.created_by_name}
                {campaign.status === 'sent' && <> · {campaign.delivery_mode === 'preview' ? 'recorded (preview)' : 'sent'} {dateTime(campaign.sent_at)} by {campaign.sent_by_name}</>}
            </p>
            {campaign.subject && <p><strong>Subject:</strong> {campaign.subject}</p>}

            {previewMode && (
                <p className="alert info">
                    Preview mode: no email or WhatsApp account is connected yet, so "Send" only records the messages. No customer is contacted.
                </p>
            )}

            {campaign.status === 'draft' && preview && (
                <>
                    <div className="expected">
                        <span className="stat-label">Customers who agreed to {CHANNEL[campaign.channel]} promotions</span>
                        <span className="expected-value">{preview.recipient_count}</span>
                    </div>
                    {preview.samples.length > 0 && (
                        <div className="sub-section">
                            <h3>What they'll receive (first {preview.samples.length})</h3>
                            {preview.samples.map((s) => (
                                <div key={s.customer_id} className="message-preview">
                                    <div className="muted small">To {s.name} · {campaign.channel === 'whatsapp' ? formatPhone(s.to_address) : s.to_address}</div>
                                    <div className="message-bubble">{s.body}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="sub-section">
                        {!confirmSend && (
                            <button type="button" className="button primary" disabled={preview.recipient_count === 0} onClick={() => setConfirmSend(true)}>
                                {previewMode ? 'Record' : 'Send'} to {preview.recipient_count} customer{preview.recipient_count === 1 ? '' : 's'}…
                            </button>
                        )}
                        {preview.recipient_count === 0 && <p className="muted small">Nobody has agreed to {CHANNEL[campaign.channel]} promotions yet.</p>}
                        {confirmSend && (
                            <>
                                <p>{previewMode
                                    ? `Record ${preview.recipient_count} message${preview.recipient_count === 1 ? '' : 's'} as a preview? Nothing will be sent.`
                                    : `Send to ${preview.recipient_count} customer${preview.recipient_count === 1 ? '' : 's'} now? This can't be undone.`}</p>
                                <div className="button-row">
                                    <button type="button" className="button primary" onClick={send} disabled={busy}>{busy ? 'Working…' : 'Yes, go ahead'}</button>
                                    <button type="button" className="button" onClick={() => setConfirmSend(false)} disabled={busy}>Cancel</button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {campaign.status === 'sent' && messages && (
                <div className="sub-section">
                    <h3>{campaign.recipient_count} message{campaign.recipient_count === 1 ? '' : 's'}</h3>
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead><tr><th>Customer</th><th>To</th><th>Status</th></tr></thead>
                            <tbody>
                                {messages.map((m) => (
                                    <tr key={m.id}>
                                        <td>{m.customer_name}</td>
                                        <td className="mono">{campaign.channel === 'whatsapp' ? formatPhone(m.to_address) : m.to_address}</td>
                                        <td><span className={STATUS_CHIP[m.status] ?? 'chip'}>{m.status}</span>{m.error && <span className="muted small"> {m.error}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {error && <p className="alert error" role="alert">{error}</p>}
        </section>
    );
}

export default function CampaignsPage() {
    const [view, setView] = useState({ name: 'list' }); // list | new | edit | detail
    const [campaigns, setCampaigns] = useState(null);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (view.name !== 'list') return undefined;
        let cancelled = false;
        api.get('/campaigns?limit=50')
            .then((res) => { if (!cancelled) { setCampaigns(res.campaigns); setError(null); } })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, [view.name, reloadKey]);

    const backToList = () => { setReloadKey((k) => k + 1); setView({ name: 'list' }); };
    const open = (campaign) => setView({ name: 'detail', campaign });

    if (view.name === 'new') return <CampaignEditor onSaved={open} onCancel={backToList} />;
    if (view.name === 'edit') return <CampaignEditor campaign={view.campaign} onSaved={open} onCancel={() => open(view.campaign)} />;
    if (view.name === 'detail') {
        return <CampaignDetail key={`${view.campaign.id}-${view.campaign.status}-${view.campaign.updated_at}`} campaign={view.campaign}
            onChange={open} onEdit={() => setView({ name: 'edit', campaign: view.campaign })} onClose={backToList} />;
    }

    return (
        <>
            <div className="page-header">
                <h1>Campaigns</h1>
                <button type="button" className="button primary push-right" onClick={() => setView({ name: 'new' })}>New campaign</button>
            </div>
            <section className="card">
                {error && <p className="alert error" role="alert">{error}</p>}
                {!error && campaigns === null && <p className="muted" role="status">Loading campaigns…</p>}
                {campaigns?.length === 0 && <p className="muted">No campaigns yet. Write your first promotion to customers who agreed to receive them.</p>}
                {campaigns?.length > 0 && (
                    <div className="table-scroll">
                        <table className="data-table clickable">
                            <thead><tr><th>Name</th><th>Channel</th><th>Status</th><th className="num">Recipients</th><th>Date</th></tr></thead>
                            <tbody>
                                {campaigns.map((c) => (
                                    <tr key={c.id} onClick={() => open(c)}>
                                        <td><button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); open(c); }}>{c.name}</button></td>
                                        <td>{CHANNEL[c.channel]}</td>
                                        <td>{c.status === 'draft' ? <span className="chip">Draft</span> : <span className="chip ok">{c.delivery_mode === 'preview' ? 'Recorded (preview)' : 'Sent'}</span>}</td>
                                        <td className="num">{c.recipient_count ?? '—'}</td>
                                        <td>{dateTime(c.sent_at ?? c.created_at)}</td>
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
