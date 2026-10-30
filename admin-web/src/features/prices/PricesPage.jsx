import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

// Dot colour for each colour name (unknown colours get grey)
const COLORS = { Black: '#1b1f24', White: '#ffffff', Blue: '#2f5fb3', Grey: '#9aa0a8', Navy: '#1f2a4d' };

export default function PricesPage() {
    const [stores, setStores] = useState(null);
    const [storeId, setStoreId] = useState('');
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState(null);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [flashIds, setFlashIds] = useState([]); // rows that just changed (green flash)
    const timer = useRef(null);

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

    function showToast(text, ids = []) {
        clearTimeout(timer.current);
        setToast(text);
        setFlashIds(ids);
        timer.current = setTimeout(() => { setToast(null); setFlashIds([]); }, 3000);
    }

    function savePrice(variantId, newPrice) {
        setProducts(products.map((p) => ({
            ...p,
            variants: p.variants.map((v) => (v.id === variantId ? { ...v, price: newPrice } : v)),
        })));
    }

    function updateStyle(productId, newBasePrice) {
        // Own prices are kept. ❓ Ask the lead: should "Update all" overwrite them instead?
        setProducts(products.map((p) => (p.id === productId ? { ...p, base_price: newBasePrice } : p)));
    }

    // A variant matches on its style's name/code, or on its own SKU, colour or size
    const q = search.trim().toLowerCase();
    const groups = (products ?? [])
        .map((p) => {
            const styleHit = p.name.toLowerCase().includes(q) || p.style_code.toLowerCase().includes(q);
            const variants = p.variants.filter((v) =>
                styleHit || [v.sku, v.color, v.size].some((text) => text.toLowerCase().includes(q)));
            return { product: p, variants };
        })
        .filter((g) => g.variants.length > 0);

    const shownVariants = groups.reduce((n, g) => n + g.variants.length, 0);
    const allVariants = (products ?? []).flatMap((p) => p.variants);
    const ownCount = allVariants.filter((v) => v.price !== null).length;

    return (
        <div className="pr-page">
            <div className="pr-head">
                <div>
                    <div className="pr-eyebrow"><TagIcon /> Catalog · Pricing</div>
                    <h1>Prices</h1>
                    <p className="muted">Set the selling price for each style, or give a single variant its own price.</p>
                </div>
                {products && (
                    <div className="pr-stat">
                        <div className="pr-stat-icon"><SlidersIcon /></div>
                        <div>
                            <div className="pr-stat-label">Own prices</div>
                            <div className="pr-stat-value">{ownCount} of {allVariants.length} variants</div>
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="alert error">{error}</p>}
            {!error && products === null && <p className="muted">Loading products…</p>}
            {products?.length === 0 && <p className="card muted">No products yet.</p>}

            {products?.length > 0 && (
                <>
                    <div className="pr-toolbar">
                        <div className="pr-search">
                            <SearchIcon />
                            <input
                                placeholder="Search name, style code, SKU, colour or size…"
                                aria-label="Search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button type="button" className="pr-clear" aria-label="Clear search" onClick={() => setSearch('')}>
                                    <CloseIcon />
                                </button>
                            )}
                        </div>
                        <select aria-label="Store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                            <option value="">All stores</option>
                            {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <span className="pr-count">
                            {groups.length} {groups.length === 1 ? 'style' : 'styles'} · {shownVariants} {shownVariants === 1 ? 'variant' : 'variants'}
                        </span>
                    </div>

                    {groups.length === 0 ? (
                        <div className="pr-table pr-empty">
                            <div className="pr-empty-icon"><SearchIcon /></div>
                            <b>No products match “{search.trim()}”</b>
                            <span className="muted">Check the spelling, or try a style code like CT-001.</span>
                            <button type="button" className="pr-btn primary" onClick={() => setSearch('')}>Clear search</button>
                        </div>
                    ) : (
                        <div className="pr-table">
                            <div className="pr-cols">
                                <div>SKU</div>
                                <div className="pr-hide-sm">Colour</div>
                                <div className="pr-hide-sm pr-center">Size</div>
                                <div className="pr-right">Price (RM)</div>
                                <div className="pr-hide-sm"></div>
                            </div>
                            {groups.map(({ product, variants }) => (
                                <StyleGroup
                                    key={product.id}
                                    product={product}
                                    variants={variants}
                                    flashIds={flashIds}
                                    onUpdate={(price) => {
                                        updateStyle(product.id, price);
                                        const kept = product.variants.filter((v) => v.price !== null).length;
                                        showToast(
                                            `${product.name}: base price RM${price}${kept ? ` · ${kept} own ${kept === 1 ? 'price' : 'prices'} kept` : ''}`,
                                            product.variants.filter((v) => v.price === null).map((v) => v.id),
                                        );
                                    }}
                                    onSave={(variant, price) => {
                                        savePrice(variant.id, price);
                                        showToast(`${variant.sku} → RM${price} saved`, [variant.id]);
                                    }}
                                    onUseBase={(variant) => {
                                        savePrice(variant.id, null);
                                        showToast(`${variant.sku} now uses the base price RM${product.base_price}`, [variant.id]);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {toast && (
                <div className="pr-toast" role="status">
                    <span className="pr-toast-ok"><CheckIcon /></span>{toast}
                </div>
            )}
        </div>
    );
}

function StyleGroup({ product, variants, flashIds, onUpdate, onSave, onUseBase }) {
    const [draft, setDraft] = useState(product.base_price);
    const [message, setMessage] = useState(null);

    function update() {
        if (!isValidPrice(draft)) {
            setMessage('Enter a price like 49.90 (0 or more, max 2 decimals)');
            return;
        }
        const price = formatPrice(draft);
        setMessage(null);
        setDraft(price);
        onUpdate(price);
    }

    return (
        <>
            <div className="pr-group">
                <div className="pr-group-name">
                    <b>{product.name}</b>
                    <span className="pr-code mono">{product.style_code}</span>
                    <span className="pr-group-count">
                        {product.variants.length} {product.variants.length === 1 ? 'variant' : 'variants'}
                    </span>
                </div>
                <div className="pr-group-base">
                    <label htmlFor={`base-${product.id}`}>Base price</label>
                    <span className={`pr-money ${message ? 'invalid' : ''}`}>
                        <input
                            id={`base-${product.id}`}
                            inputMode="decimal"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') update(); }}
                        />
                    </span>
                    <button type="button" className="pr-btn primary" onClick={update}>Update all</button>
                </div>
                {message && <div className="pr-error pr-group-error">{message}</div>}
            </div>

            {variants.map((variant) => (
                <VariantRow
                    key={variant.id}
                    variant={variant}
                    basePrice={product.base_price}
                    flash={flashIds.includes(variant.id)}
                    onSave={(price) => onSave(variant, price)}
                    onUseBase={() => onUseBase(variant)}
                />
            ))}
        </>
    );
}

function VariantRow({ variant, basePrice, flash, onSave, onUseBase }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [message, setMessage] = useState(null);
    const own = variant.price !== null;

    function edit() {
        setDraft(variant.price ?? basePrice);
        setMessage(null);
        setEditing(true);
    }

    function save() {
        if (!isValidPrice(draft)) {
            setMessage('Enter e.g. 49.90');
            return;
        }
        onSave(formatPrice(draft));
        setEditing(false);
    }

    function cancel() {
        setMessage(null);
        setEditing(false);
    }

    return (
        <div className={`pr-row ${flash ? 'pr-flash' : ''}`}>
            <div className="pr-sku-cell">
                <span className="pr-sku mono">{variant.sku}</span>
                <span className="pr-size pr-show-sm">{variant.size}</span>
            </div>
            <div className="pr-colour pr-hide-sm">
                <span className="pr-dot" style={{ background: COLORS[variant.color] ?? '#ccc' }} />
                {variant.color}
            </div>
            <div className="pr-center pr-hide-sm"><span className="pr-size">{variant.size}</span></div>

            <div className="pr-price">
                {editing ? (
                    <div className="pr-edit">
                        <span className={`pr-money ${message ? 'invalid' : ''}`}>
                            <input
                                autoFocus
                                inputMode="decimal"
                                aria-label={`Price for ${variant.sku}`}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') save();
                                    if (e.key === 'Escape') cancel();
                                }}
                            />
                        </span>
                        {message && <span className="pr-error">{message}</span>}
                    </div>
                ) : own ? (
                    <>
                        <button type="button" className="pr-use-base" onClick={onUseBase}>Use base</button>
                        <span className="pr-value own">{variant.price}</span>
                        <span className="pr-badge own">OWN</span>
                    </>
                ) : (
                    <>
                        <span className="pr-value">{basePrice}</span>
                        <span className="pr-badge">BASE</span>
                    </>
                )}
            </div>

            <div className="pr-actions">
                {editing ? (
                    <>
                        <button type="button" className="pr-btn primary" onClick={save}>Save</button>
                        <button type="button" className="pr-btn quiet" onClick={cancel}>Cancel</button>
                    </>
                ) : (
                    <button type="button" className="pr-btn text" onClick={edit}>Edit</button>
                )}
            </div>
        </div>
    );
}

// 0 or more, max 10 digits before the point, max 2 decimals. No signs, letters or spaces.
function isValidPrice(text) {
    return /^\d{1,10}(\.\d{1,2})?$/.test(text);
}

// "49.9" → "49.90", "0" → "0.00". Safe here because isValidPrice already allows max 2 decimals.
function formatPrice(text) {
    return Number(text).toFixed(2);
}

/* ---------- small inline icons (no icon library needed) ---------- */
function Icon({ children }) {
    return (
        <svg className="pr-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {children}
        </svg>
    );
}
const SearchIcon = () => <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
const CloseIcon = () => <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const CheckIcon = () => <Icon><path d="M20 6 9 17l-5-5" /></Icon>;
const TagIcon = () => <Icon><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></Icon>;
const SlidersIcon = () => <Icon><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Icon>;

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
