import { useState } from 'react';
import { api } from '../../api/client.js';
import { formatRM, toCents } from '../../lib/money.js';
import CloseShiftForm from './CloseShiftForm.jsx';
import VarianceChip from './VarianceChip.jsx';

// THE TILL RIGHT NOW: one of three situations.
//   1. No open shift  → "Open shift" form (enter the opening float).
//   2. Shift open     → running totals (the X report), buttons for pay-in / pay-out / drop,
//                       "Close shift", and the list of every cash movement so far.
//   3. Just closed    → the final Z report, with a button to start the next shift.
//
// Every button calls our backend; the backend applies the rules (see shift.service.js) and sends
// back the updated shift, which we pass up with onChange so the page shows the new numbers.

const MOVEMENT_LABELS = { pay_in: 'Pay in', pay_out: 'Pay out', drop: 'Cash drop', sale: 'Cash sale', refund: 'Cash refund' };
const MOVEMENT_HELP = {
    pay_in: 'Cash added to the drawer, e.g. more change from the safe.',
    pay_out: 'Cash taken out for a small expense. Say what it was for.',
    drop: 'Cash moved from the drawer to the safe.',
};

const time = (iso) => new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
const dateTime = (iso) => new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });

export default function CurrentShift({ shift, store, register, onChange }) {
    const [mode, setMode] = useState(null);       // null | 'pay_in' | 'pay_out' | 'drop' | 'close'
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [openingFloat, setOpeningFloat] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Run one request to the backend: show "busy", catch the error message, pass the new shift up.
    async function run(request) {
        setBusy(true);
        setError(null);
        try {
            const res = await request();
            onChange(res.shift);
            setMode(null);
            setAmount('');
            setReason('');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    function startMode(next) {
        setMode(next);
        setError(null);
        setAmount('');
        setReason('');
    }

    // ---- 1. Till is closed: open a shift ----
    if (!shift || (shift.status === 'closed' && mode === 'new')) {
        const valid = toCents(openingFloat) !== null;
        return (
            <section className="card">
                <h2>Till {register} at {store.name} is closed</h2>
                <p className="muted">Count the change you're putting in the drawer, then open the shift.</p>
                <form className="inline-form" onSubmit={(e) => {
                    e.preventDefault();
                    run(() => api.post('/shifts', { store_id: store.id, register, opening_float: openingFloat.trim() }));
                }}>
                    <label className="field" htmlFor="opening-float">
                        <span>Opening float (RM)</span>
                        <input id="opening-float" inputMode="decimal" value={openingFloat}
                            onChange={(e) => setOpeningFloat(e.target.value)} placeholder="200.00" autoComplete="off" />
                    </label>
                    <button type="submit" className="button primary" disabled={busy || !valid}>
                        {busy ? 'Opening…' : 'Open shift'}
                    </button>
                </form>
                {error && <p className="alert error" role="alert">{error}</p>}
            </section>
        );
    }

    const r = shift.report;

    // ---- 3. Just closed: show the Z report ----
    if (shift.status === 'closed') {
        return (
            <section className="card">
                <div className="results-header">
                    <h2>Z report · Till {shift.register}</h2>
                    <VarianceChip cents={toCents(shift.variance)} />
                </div>
                <p className="muted small">
                    Opened {dateTime(shift.opened_at)} by {shift.opened_by_name} · Closed {dateTime(shift.closed_at)} by {shift.closed_by_name}
                </p>
                <dl className="totals">
                    <div><dt>Opening float</dt><dd>{formatRM(r.opening_float)}</dd></div>
                    <div><dt>Pay-ins</dt><dd>{formatRM(r.pay_ins)}</dd></div>
                    <div><dt>Pay-outs</dt><dd>{formatRM(r.pay_outs)}</dd></div>
                    <div><dt>Drops</dt><dd>{formatRM(r.drops)}</dd></div>
                    <div><dt>Expected</dt><dd>{formatRM(shift.expected_cash)}</dd></div>
                    <div><dt>Counted</dt><dd>{formatRM(shift.counted_cash)}</dd></div>
                </dl>
                {shift.close_note && <p className="small">Note: {shift.close_note}</p>}
                <button type="button" className="button primary" onClick={() => setMode('new')}>Open the next shift</button>
            </section>
        );
    }

    // ---- 2. Shift open: X report, actions, movements ----
    const amountValid = toCents(amount) > 0;
    const needsReason = mode === 'pay_out';
    const reasonValid = !needsReason || reason.trim().length >= 3;

    return (
        <section className="card">
            <div className="results-header">
                <h2>Till {shift.register} · open</h2>
                <span className="muted small">since {time(shift.opened_at)} · opened by {shift.opened_by_name}</span>
            </div>

            <div className="expected">
                <span className="stat-label">Cash that should be in the drawer</span>
                <span className="expected-value">{formatRM(r.expected_cash)}</span>
            </div>

            <dl className="totals">
                <div><dt>Opening float</dt><dd>{formatRM(r.opening_float)}</dd></div>
                <div><dt>Pay-ins</dt><dd>+ {formatRM(r.pay_ins)}</dd></div>
                <div><dt>Cash sales</dt><dd>+ {formatRM(r.cash_sales)}</dd></div>
                <div><dt>Pay-outs</dt><dd>− {formatRM(r.pay_outs)}</dd></div>
                <div><dt>Drops</dt><dd>− {formatRM(r.drops)}</dd></div>
                <div><dt>Cash refunds</dt><dd>− {formatRM(r.cash_refunds)}</dd></div>
            </dl>
            <p className="muted small">Cash sales and refunds will appear here once the checkout is built.</p>

            {mode === null && (
                <div className="button-row">
                    <button type="button" className="button" onClick={() => startMode('pay_in')}>Pay in</button>
                    <button type="button" className="button" onClick={() => startMode('pay_out')}>Pay out</button>
                    <button type="button" className="button" onClick={() => startMode('drop')}>Cash drop</button>
                    <button type="button" className="button primary push-right" onClick={() => startMode('close')}>Close shift</button>
                </div>
            )}

            {['pay_in', 'pay_out', 'drop'].includes(mode) && (
                <form className="movement-form" onSubmit={(e) => {
                    e.preventDefault();
                    run(() => api.post(`/shifts/${shift.id}/movements`, {
                        type: mode, amount: amount.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}),
                    }));
                }}>
                    <h3>{MOVEMENT_LABELS[mode]}</h3>
                    <p className="muted small">{MOVEMENT_HELP[mode]}</p>
                    <div className="inline-form">
                        <label className="field" htmlFor="movement-amount">
                            <span>Amount (RM)</span>
                            <input id="movement-amount" inputMode="decimal" value={amount} autoFocus
                                onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoComplete="off" />
                        </label>
                        <label className="field grow" htmlFor="movement-reason">
                            <span>Reason{needsReason ? '' : ' (optional)'}</span>
                            <input id="movement-reason" value={reason} maxLength={255}
                                onChange={(e) => setReason(e.target.value)} placeholder={needsReason ? 'e.g. Cleaning supplies' : ''} />
                        </label>
                    </div>
                    <div className="button-row">
                        <button type="submit" className="button primary" disabled={busy || !amountValid || !reasonValid}>
                            {busy ? 'Saving…' : `Record ${MOVEMENT_LABELS[mode].toLowerCase()}`}
                        </button>
                        <button type="button" className="button" onClick={() => startMode(null)} disabled={busy}>Cancel</button>
                    </div>
                </form>
            )}

            {mode === 'close' && (
                <CloseShiftForm
                    expectedCash={r.expected_cash}
                    busy={busy}
                    onCancel={() => startMode(null)}
                    onClose={(body) => run(() => api.post(`/shifts/${shift.id}/close`, body))}
                />
            )}

            {error && <p className="alert error" role="alert">{error}</p>}

            <div className="sub-section">
                <h3>Cash movements</h3>
                {shift.movements.length === 0 && <p className="muted small">None yet.</p>}
                {shift.movements.length > 0 && (
                    <ul className="movement-list">
                        {shift.movements.map((m) => (
                            <li key={m.id}>
                                <span className="muted small num">{time(m.created_at)}</span>
                                <span>{MOVEMENT_LABELS[m.type] ?? m.type}{m.reason ? ` · ${m.reason}` : ''}</span>
                                <span className="muted small">{m.created_by_name}</span>
                                <span className={`num ${['pay_out', 'drop', 'refund'].includes(m.type) ? 'text-error' : ''}`}>
                                    {['pay_out', 'drop', 'refund'].includes(m.type) ? '−' : '+'} {formatRM(m.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
