// The ONE place that talks to our backend. Every feature calls api.get/api.post from here,
// so the token, JSON handling and errors are written once.

const TOKEN_KEY = 'altai.token';

// sessionStorage: survives a page reload, cleared when the browser is closed.
// (localStorage would keep a shared shop computer logged in for days.)
export const tokenStore = {
    get: () => safe(() => sessionStorage.getItem(TOKEN_KEY)),
    set: (token) => safe(() => sessionStorage.setItem(TOKEN_KEY, token)),
    clear: () => safe(() => sessionStorage.removeItem(TOKEN_KEY)),
};

function safe(fn) {
    try { return fn(); } catch { return null; } // storage can be blocked (private mode, policies)
}

// An error the UI can show: message from the backend, plus status and field details.
export class ApiError extends Error {
    constructor(status, message, details = []) {
        super(message);
        this.status = status;
        this.details = details;
    }

    get sessionExpired() {
        return this.status === 401;
    }

    // The most useful text to show a person: the specific reasons when the server sent them
    // (e.g. '"from" must be on or before "to"'), otherwise the general message.
    get readable() {
        const reasons = this.details.map((d) => d.message).filter(Boolean);
        return reasons.length ? reasons.join(' · ') : this.message;
    }
}

// Set by AuthContext: what to do when the backend says the session is no longer valid.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
    onUnauthorized = fn;
}

async function request(method, path, body) {
    const headers = { Accept: 'application/json' };
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
        res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.');
    }

    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok !== false) return data;

    const error = new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.details ?? []);
    // A 401 on any call except login itself means our token is dead: sign the user out.
    if (res.status === 401 && token && path !== '/auth/login') onUnauthorized(error);
    throw error;
}

export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body ?? {}),
    put: (path, body) => request('PUT', path, body ?? {}),
    del: (path) => request('DELETE', path), // "delete" is a reserved word in JavaScript, hence "del"
};
