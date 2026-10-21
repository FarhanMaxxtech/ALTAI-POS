import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { formatPhone } from '../../lib/phone.js';
import CustomerDetail from './CustomerDetail.jsx';
import CustomerForm from './CustomerForm.jsx';

// CUSTOMERS PAGE
//
// The list: search by name, phone (typed any way, even part of it) or email, and filter to those who
// agreed to WhatsApp or email promotions. Click a customer to open them; "Register customer" adds one.
// The page switches between three views: list, form (register/edit) and one customer's detail.

const FILTERS = [
    { value: '', label: 'All' },
    { value: 'whatsapp', label: 'WhatsApp: yes' },
    { value: 'email', label: 'Email: yes' },
];

export default function CustomersPage() {
    const [view, setView] = useState({ name: 'list' }); // { name: 'list' | 'new' | 'edit' | 'detail', customer? }
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('');
    const [customers, setCustomers] = useState(null);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0); // bump to reload the list after a change

    // Load the list. Typing waits 300 ms after the last key, so we don't ask the server on every letter.
    useEffect(() => {
        if (view.name !== 'list') return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ limit: '100' });
            if (query.trim()) params.set('q', query.trim());
            if (filter) params.set('opted_in', filter);
            api.get(`/customers?${params}`)
                .then((res) => { if (!cancelled) { setCustomers(res.customers); setError(null); } })
                .catch((err) => { if (!cancelled) setError(err.message); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [query, filter, view.name, reloadKey]);

    async function openCustomer(id) {
        try {
            const res = await api.get(`/customers/${id}`);
            setView({ name: 'detail', customer: res.customer });
        } catch (err) {
            setError(err.message);
        }
    }

    function backToList() {
        setReloadKey((k) => k + 1);
        setView({ name: 'list' });
    }

    if (view.name === 'new') {
        return <CustomerForm onSaved={(c) => setView({ name: 'detail', customer: c })} onCancel={backToList} />;
    }
    if (view.name === 'edit') {
        return <CustomerForm customer={view.customer} onSaved={(c) => setView({ name: 'detail', customer: c })} onCancel={() => setView({ name: 'detail', customer: view.customer })} />;
    }
    if (view.name === 'detail') {
        return (
            <CustomerDetail
                customer={view.customer}
                onChange={(c) => setView({ name: 'detail', customer: c })}
                onEdit={() => setView({ name: 'edit', customer: view.customer })}
                onClose={backToList}
            />
        );
    }

    return (
        <>
            <div className="page-header">
                <h1>Customers</h1>
                {customers && <span className="muted">{customers.length}{customers.length === 100 ? '+' : ''} shown</span>}
                <button type="button" className="button primary push-right" onClick={() => setView({ name: 'new' })}>Register customer</button>
            </div>

            <section className="card">
                <div className="toolbar">
                    <label className="field grow" htmlFor="customer-search">
                        <span>Search</span>
                        <input id="customer-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Name, phone or email" autoComplete="off" />
                    </label>
                    <div className="segmented" role="group" aria-label="Filter by promotions consent">
                        {FILTERS.map((f) => (
                            <button key={f.value} type="button" className={filter === f.value ? 'active' : ''} aria-pressed={filter === f.value}
                                onClick={() => setFilter(f.value)}>{f.label}</button>
                        ))}
                    </div>
                </div>

                {error && <p className="alert error" role="alert">{error}</p>}
                {!error && customers === null && <p className="muted" role="status">Loading customers…</p>}
                {customers?.length === 0 && (
                    <p className="muted">{query || filter ? 'No customers match.' : 'No customers yet. Register your first regular customer.'}</p>
                )}
                {customers?.length > 0 && (
                    <div className="table-scroll">
                        <table className="data-table clickable">
                            <thead>
                                <tr><th>Name</th><th>Phone</th><th>Email</th><th>WhatsApp</th><th>Email promos</th></tr>
                            </thead>
                            <tbody>
                                {customers.map((c) => (
                                    <tr key={c.id} onClick={() => openCustomer(c.id)}>
                                        <td>
                                            {/* A real button inside the row, so keyboard users can open it too */}
                                            <button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); openCustomer(c.id); }}>{c.name}</button>
                                        </td>
                                        <td className="mono">{formatPhone(c.phone)}</td>
                                        <td>{c.email ?? '—'}</td>
                                        <td>{c.whatsapp_opt_in ? <span className="chip ok">Yes</span> : <span className="muted">No</span>}</td>
                                        <td>{c.email_opt_in ? <span className="chip ok">Yes</span> : <span className="muted">No</span>}</td>
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
