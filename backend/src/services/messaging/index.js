import config from '../../config/index.js';
import HttpError from '../../lib/httpError.js';

// THE ONLY PLACE THAT WOULD SEND A MESSAGE TO A CUSTOMER.
//
// Today (MESSAGING_MODE=preview) nothing leaves the building: each message is just marked
// "previewed", so you can see exactly who would get what before any real provider is connected.
//
// Later, to send for real, add a provider here, for example:
//   email    → SMTP (company mailbox) or a service like SendGrid / Amazon SES
//   whatsapp → WhatsApp Business Cloud API (Meta): needs a verified business account and
//              pre-approved message templates for promotions
// and switch MESSAGING_MODE to 'live'. Nothing else in the code needs to change.

export function deliveryMode() {
    return config.messaging.mode === 'live' ? 'live' : 'preview';
}

// message: { channel: 'email'|'whatsapp', to, subject?, body }
// Returns { status: 'previewed' | 'sent' | 'failed', error? }
export async function send(message) {
    if (deliveryMode() === 'preview') {
        return { status: 'previewed' };
    }
    // No live provider is connected yet. Refuse loudly instead of pretending it was sent.
    throw new HttpError(503, `No ${message.channel} provider is connected yet. Set MESSAGING_MODE=preview, or connect a provider in services/messaging.`);
}
