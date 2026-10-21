// Shared wording for consent, so the screen always asks the same, fair question.
// The cashier reads the question out; the customer answers; we record the answer and how we got it.

export const CONSENT_QUESTION = {
    whatsapp: 'May we send you promotions by WhatsApp? You can stop any time by replying STOP.',
    email: 'May we send you promotions by email? You can unsubscribe any time.',
};

// How the answer was given. Must match the backend's list (customers/schemas.js).
export const CONSENT_SOURCES = [
    { value: 'in_store', label: 'In store, told the cashier' },
    { value: 'phone_call', label: 'On a phone call' },
    { value: 'online_form', label: 'Online form' },
    { value: 'customer_reply', label: 'Replied to a message (e.g. STOP)' },
    { value: 'staff_update', label: 'Staff correction' },
];

export const sourceLabel = (value) => CONSENT_SOURCES.find((s) => s.value === value)?.label ?? value;
