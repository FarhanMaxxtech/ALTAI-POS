import { useState, useEffect } from "react";
import { api } from '../../api/client';

export default function SalesPage() {
    const [stores, setStores] = useState(null);
    const [store, setStore] = useState('');
    const [sales, setSales] = useState(null);
    const [cashier, setCashier] = useState('');
    const [error, setError] = useState(null);
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    useEffect(() => {
        loadSales()
            .then((data) => setSales(data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores')
            .then((res) => { if (!cancelled) setStores(res.stores); })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, []);

    // Unique cashier names: ['Auni', 'Abu', 'Aina']
    const cashiers = [...new Set(sales?.map((s) => s.cashier))];

    // Sales that pass ALL filters. An empty filter lets everything through.
    const shown = sales?.filter((s) => {
        const time = s.created_at.slice(0, 10); 
        return (store === '' || s.store === store)
            && (cashier === '' || s.cashier === cashier)
            && (start === '' || time >= start)
            && (end === '' || time <= end);
    });

    function clearFilters() {
        setStore('');
        setCashier('');
        setStart('');
        setEnd('');
    }

    const filtering = store || cashier || start || end;

    return (
        <>
            <h1>Sales</h1>
            {error && <p className="alert error">{error}</p>}
            {!error && sales === null && <p className="muted">Loading sales...</p>}
            {sales?.length === 0 && <p className="card muted">No sales yet.</p>}

            {sales?.length > 0 && (
                <>
                    <div>
                        {/* Mock sales only have the store NAME, so filter by name for now.
                            With the real API, use the store ID instead. */}
                        <select aria-label="Store" value={store} onChange={(e) => setStore(e.target.value)}>
                            <option value="">All stores</option>
                            {stores?.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>

                        <select aria-label="Cashier" value={cashier} onChange={(e) => setCashier(e.target.value)}>
                            <option value="">All cashiers</option>
                            {cashiers.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <label>
                            From
                            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                        </label>

                        <label>
                            To
                            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
                        </label>

                        {filtering && (
                            <button type="button" onClick={clearFilters}>Clear filters</button>
                        )}
                    </div>

                    {shown.length === 0 ? (
                        <p className="muted">No sales match these filters.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Receipt No.</th>
                                    <th>Date & time</th>
                                    <th>Store</th>
                                    <th>Cashier</th>
                                    <th>Items</th>
                                    <th>Payment</th>
                                    <th>Total (RM)</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((s) => (
                                    <tr key={s.id}>
                                        <td>{s.receipt_no}</td>
                                        <td>{s.created_at}</td>
                                        <td>{s.store}</td>
                                        <td>{s.cashier}</td>
                                        <td>{s.items}</td>
                                        <td>{s.payment}</td>
                                        <td>{s.total}</td>
                                        <td>{s.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </>
    );
}

// keep your loadSales() function below, unchanged

function loadSales() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 1, receipt_no: 'R-0001-000123', created_at: '2026-10-30T14:15:00', store: 'Altai Demo Store', cashier: 'Auni', items: 3, payment: 'Card', total: '178.90', status: 'completed' },
                { id: 2, receipt_no: 'R-0001-000122', created_at: '2026-10-30T11:02:00', store: 'Altai Demo Store', cashier: 'Abu', items: 1, payment: 'Cash', total: '49.90', status: 'completed' },
                { id: 3, receipt_no: 'R-0002-000045', created_at: '2026-10-29T18:40:00', store: 'UV', cashier: 'Auni', items: 2, payment: 'DuitNow QR', total: '258.00', status: 'refunded' },
                { id: 4, receipt_no: 'R-0001-000121', created_at: '2026-10-29T16:20:00', store: 'Altai Demo Store', cashier: 'Abu', items: 4, payment: 'Card', total: '319.60', status: 'voided' },
                { id: 5, receipt_no: 'R-0002-000044', created_at: '2026-10-25T13:05:00', store: 'UV', cashier: 'Aina', items: 2, payment: 'Cash', total: '99.80', status: 'completed' },
            ]);
        }, 1000);
    });
}