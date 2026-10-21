import { useState } from 'react';
import { DENOMINATIONS, formatRM, fromCents, toCents } from '../../lib/money.js';
import VarianceChip from './VarianceChip.jsx';

// CLOSE SHIFT: count the drawer and finish the shift.
//
// The cashier types how many of each note and coin they counted (e.g. 3 × RM 50). We add it up
// and, before they confirm, show how that compares with the expected cash:
//   Balanced  → counted = expected
//   Short     → less cash than expected (money missing)
//   Over      → more cash than expected (e.g. change not given)
// The server checks the same sum again; the screen is only a helper.

export default function CloseShiftForm({ expectedCash, onClose, onCancel, busy }) {
    const [counts, setCounts] = useState({});   // { "50": "3", "1": "12", ... } as typed
    const [note, setNote] = useState('');

    // Total of all notes and coins, in cents. Empty or invalid boxes count as 0.
    const lines = DENOMINATIONS.map((d) => {
        const quantity = /^\d+$/.test(counts[d.value] ?? '') ? Number(counts[d.value]) : 0;
        return { ...d, quantity, cents: quantity * toCents(d.value) };
    });
    const countedCents = lines.reduce((sum, line) => sum + line.cents, 0);
    const varianceCents = countedCents - toCents(expectedCash);

    function submit(event) {
        event.preventDefault();
        // Only send the notes and coins that were actually counted.
        const breakdown = Object.fromEntries(lines.filter((l) => l.quantity > 0).map((l) => [l.value, l.quantity]));
        onClose({
            counted_cash: fromCents(countedCents),
            breakdown,
            ...(note.trim() ? { note: note.trim() } : {}),
        });
    }

    return (
        <form className="close-form" onSubmit={submit}>
            <h3>Count the drawer</h3>
            <div className="denominations">
                {lines.map((line) => (
                    <label key={line.value} className="denomination">
                        <span>{line.label}</span>
                        <input
                            id={`count-${line.value}`}
                            inputMode="numeric"
                            value={counts[line.value] ?? ''}
                            onChange={(e) => setCounts({ ...counts, [line.value]: e.target.value.replace(/\D/g, '') })}
                            placeholder="0"
                            aria-label={`Number of ${line.label}`}
                        />
                        <span className="muted small num">{line.quantity > 0 ? formatRM(line.cents, { fromCentsValue: true }) : ''}</span>
                    </label>
                ))}
            </div>

            <dl className="close-summary">
                <div><dt>Counted</dt><dd>{formatRM(countedCents, { fromCentsValue: true })}</dd></div>
                <div><dt>Expected</dt><dd>{formatRM(expectedCash)}</dd></div>
                <div><dt>Difference</dt><dd><VarianceChip cents={varianceCents} /></dd></div>
            </dl>

            <label className="field" htmlFor="close-note">
                <span>Note {varianceCents !== 0 && <span className="muted">(explain the difference)</span>}</span>
                <input id="close-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
            </label>

            <div className="button-row">
                <button type="submit" className="button primary" disabled={busy}>
                    {busy ? 'Closing…' : `Close shift with ${formatRM(countedCents, { fromCentsValue: true })}`}
                </button>
                <button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </form>
    );
}
