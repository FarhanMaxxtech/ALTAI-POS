import { useEffect, useState } from 'react';

export default function SettingsPage() {
    const [stores, setStores] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadStores()
            .then((data) => setStores(data))
            .catch((err) => setError(err.message));
    }, []);

    return (
        <>
            <h1>Store Settings</h1>
            <p className="muted">What the till uses for receipts and tax.</p>

            <h2>Store</h2>
            {!error && stores === null && <p className="muted">Loading stores...</p>}
            {stores?.length === 0 && <p className="card muted">No stores yet.</p>}
            {error && <p className='alert error'>{error}</p>}
            {stores?.map((store) => (
                <StoreCard key={store.id} store={store} />
            ))}
        </>
    );
}

function StoreCard({ store }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(store);
    const [editing, setEditing] = useState(false);

    function edit() {
        setDraft(variant.price ?? basePrice);
        setEditing(true);
    }

    function save() {
        if (!isValidPrice(draft)) {
            setMessage('Enter a valid price!');
            return;
        }
        setMessage(null);
        onSave(variant.id, draft);
        setEditing(false)
    }

    function cancel() {
        setMessage(null);
        setEditing(false);
    }

    return (
        <section className="card">
            <h3>{store.name}</h3>
            <button type="button" className='button' onClick={() => setOpen(!open)}>
                {open ? 'Hide details' : 'Show details'}
            </button>

            { open && (
            editing ? (
                <div>
                    <label className='field'>
                        <span>Name</span>
                        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </label>
                    <label className='field'>
                        <span>Address</span>
                        <input value={draft.address} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </label>
                    <button type="button" className='button' onClick={setEditing(false)}>Cancel</button>
                </div>
            ) : (
                <>
                    <p>Address: {store.address}</p>
                    <p>Tax: {store.tax_rate}%</p>
                    <p>Price Include Tax: {store.prices_include_tax ? 'Yes' : 'No'}</p>
                    <p>Receipt Footer: {store.receipt_footer}</p>
                    <button type='button' className='button' onClick={() => { setDraft(store); setEditing(true);}}>Edit</button>
                </>
            )
        )}
        </section>
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