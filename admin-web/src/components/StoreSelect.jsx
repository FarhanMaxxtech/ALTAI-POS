import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// A store picker for any page. Loads the stores this account can access (team API) and remembers the
// last one picked while the browser tab is open, so moving between pages keeps the same store.
//
// Usage: <StoreSelect value={storeId} onChange={setStoreId} />
// When nothing is chosen yet, it picks the remembered store, or the first one.

const KEY = 'altai.store';
const remembered = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const remember = (id) => { try { sessionStorage.setItem(KEY, id); } catch { /* storage blocked: just don't remember */ } };

export default function StoreSelect({ value, onChange, id = 'store-select', label = 'Store' }) {
    const [stores, setStores] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/stores')
            .then((res) => {
                if (cancelled) return;
                setStores(res.stores);
                if (!value && res.stores.length) {
                    const saved = remembered();
                    onChange(res.stores.some((s) => s.id === saved) ? saved : res.stores[0].id);
                }
            })
            .catch((err) => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
        // Only on first load: picking a default must not re-run when `value` changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <label className="field" htmlFor={id}>
            <span>{label}</span>
            <select id={id} value={value} disabled={!stores?.length}
                onChange={(e) => { remember(e.target.value); onChange(e.target.value); }}>
                {stores === null && !error && <option value="">Loading…</option>}
                {error && <option value="">Couldn't load stores</option>}
                {stores?.length === 0 && <option value="">No stores</option>}
                {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
        </label>
    );
}
