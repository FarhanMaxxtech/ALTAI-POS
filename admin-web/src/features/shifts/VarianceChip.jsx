import { formatRM } from '../../lib/money.js';

// The difference between counted and expected cash, as a coloured label:
//   Balanced (green) · Short RM x (red: money missing) · Over RM x (amber: more than expected)
// cents: counted − expected, in cents. null/undefined → "—" (e.g. a shift that isn't closed yet).
export default function VarianceChip({ cents }) {
    if (cents === null || cents === undefined) return <span className="muted">—</span>;
    if (cents === 0) return <span className="chip ok">Balanced</span>;
    if (cents < 0) return <span className="chip danger">Short {formatRM(-cents, { fromCentsValue: true })}</span>;
    return <span className="chip warn">Over {formatRM(cents, { fromCentsValue: true })}</span>;
}
