import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function PricesPage() {
    const [stores, setStores] = useState(null);
    const [storeId, setStoreId] = useState('');
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadProducts()
            .then((data) => setProducts(data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores')
            .then((res) => { if (!cancelled) setStores(res.stores); })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, []);


    const shown = products?.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.style_code.toLowerCase().includes(search.toLowerCase())
    );

    function savePrice(variantId, newPrice) {
        setProducts(products.map((p) => ({
            ...p,
            variants: p.variants.map((v) => (v.id === variantId ? { ...v, price: newPrice } : v))
        })))
    }

    function updateStyle(productId, newBasePrice) {
        setProducts(products.map((p) =>
            p.id === productId
                ? { ...p, base_price: newBasePrice, variants: p.variants.map((v) => ({ ...v, price: null })) }
                : p
        ));
    }

    return (
        <>
            <h1>Prices</h1>

            {!error && products === null && <p className="muted">Loading products...</p>}
            {error && <p className='alert error'>{error}</p>}
            {products?.length === 0 && <p className="card muted">No Products yet.</p>}
            <div>
                <div className="toolbar">
                    <label className="field">
                        <span>Search</span>
                        <input
                            className="search"
                            placeholder="Search Name / Code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>

                    <label className="field">
                        <span>Store</span>
                        <select
                            className="input-small store-select"
                            value={storeId}
                            onChange={(e) => setStoreId(e.target.value)}>
                            <option value="">All stores</option>
                            {stores?.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {shown?.map((product) => (
                    <ProductCard key={product.id} product={product} onSave={savePrice} onUpdate={updateStyle} />
                ))}
            </div>
        </>
    );
}

function loadProducts() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                {
                    id: 1, style_code: 'CT-001', name: 'Classic Tee', base_price: '49.90',
                    variants: [
                        { id: 11, sku: 'CT-001-BLK-S', color: 'Black', size: 'S', price: null },
                        { id: 12, sku: 'CT-001-BLK-M', color: 'Black', size: 'M', price: null },
                        { id: 13, sku: 'CT-001-BLK-XL', color: 'Black', size: 'XL', price: '54.90' },
                        { id: 14, sku: 'CT-001-WHT-M', color: 'White', size: 'M', price: null },
                    ],
                },
                {
                    id: 2, style_code: 'SJ-002', name: 'Slim Jeans', base_price: '129.00',
                    variants: [
                        { id: 21, sku: 'SJ-002-BLU-30', color: 'Blue', size: '30', price: null },
                        { id: 22, sku: 'SJ-002-BLU-32', color: 'Blue', size: '32', price: null },
                        { id: 23, sku: 'SJ-002-BLK-32', color: 'Black', size: '32', price: '139.00' },
                    ],
                },
                {
                    id: 3, style_code: 'HD-003', name: 'Zip Hoodie', base_price: '89.90',
                    variants: [
                        { id: 31, sku: 'HD-003-GRY-M', color: 'Grey', size: 'M', price: null },
                        { id: 32, sku: 'HD-003-GRY-L', color: 'Grey', size: 'L', price: null },
                    ],
                },
                {
                    id: 4, style_code: 'PL-004', name: 'Polo Shirt', base_price: '69.90',
                    variants: [
                        { id: 41, sku: 'PL-004-NVY-M', color: 'Navy', size: 'M', price: '59.90' },
                    ],
                },
            ]);
        }, 1000);
    });
}

function VariantRow({ variant, basePrice, onSave }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [message, setMessage] = useState(null);

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
        <tr key={variant.id}>
            <td className="mono">{variant.sku}</td>
            <td>{variant.color}</td>
            <td>{variant.size}</td>
            <td className="price">{editing ?
                <input
                    className="input-small"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                /> :
                (variant.price ?? basePrice)}
                {editing && message && <p className="alert error">{message}</p>}
            </td>
            <td>
                <div>
                    {editing ? (
                        <>
                            <button type="button" className="button primary" onClick={save}>
                                Save
                            </button>
                            <button type="button" className="button" onClick={cancel}>
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="button" onClick={edit}>
                                Edit
                            </button>
                        </>
                    )}

                </div>
            </td>
        </tr>
    )
}

function StyleUpdate({ product, onUpdate }) {
    const [draft, setDraft] = useState(product.base_price);
    const [message, setMessage] = useState(null)

    function update() {
        if (!isValidPrice(draft)) {
            setMessage('Enter a valid price!');
            return;
        }
        setMessage(null);
        onUpdate(product.id, draft);
    }

    return (
        <div>
            Base Price: RM{' '}
            <input
                className="input-small"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
            /> {' '}
            <button type="button" className="button primary" onClick={update}>
                Update All
            </button>
            {message && <p className="alert error">{message}</p>}
        </div>
    )
}

function ProductCard({ product, onSave, onUpdate }) {
    const [open, setOpen] = useState(false);

    return (
        <section className="card">
            <div className="card-header">
                <button type="button" className="card-title" onClick={() => setOpen(!open)}>
                    {open ? '▾' : '▸'} {product.name} | {product.style_code}
                </button>
                <StyleUpdate product={product} onUpdate={onUpdate} />
            </div>

            {open && (
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Color</th>
                                <th>Size</th>
                                <th className="price">Price</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {product.variants.map((variant) => (
                                <VariantRow key={variant.id} variant={variant} basePrice={product.base_price} onSave={onSave} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function isValidPrice(text) {
    return /^\d{1,10}(\.\d{1,2})?$/.test(text); 
}