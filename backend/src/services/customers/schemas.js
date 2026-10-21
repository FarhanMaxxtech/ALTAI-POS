import { z } from 'zod';
import { idParamSchema } from '../../lib/validators.js';
import { normalizePhone } from '../../lib/phone.js';

export { idParamSchema };

// What valid customer and campaign requests look like. Anything else gets a 400 with the reasons.

// Phone: accept any common way of typing it, store the standard form (+60123456789).
const phone = z.string().transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number, e.g. 012-345 6789' });
        return z.NEVER;
    }
    return normalized;
});
const email = z.email('Enter a valid email address').trim().toLowerCase().max(254);
const optionalText = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);
const channel = z.enum(['email', 'whatsapp']);
// How the customer gave (or withdrew) consent. Recorded with every answer, as proof.
const consentSource = z.enum(['in_store', 'phone_call', 'online_form', 'customer_reply', 'staff_update']);

export const createCustomerSchema = z.strictObject({
    phone,
    name: z.string().trim().min(1).max(120),
    email: email.nullish(),
    birthday: z.iso.date().nullish(),
    notes: optionalText(500),
    home_store_id: optionalText(50),
    // Consent is asked at sign-up, per channel. Never pre-ticked: the default is "no".
    email_opt_in: z.boolean().default(false),
    whatsapp_opt_in: z.boolean().default(false),
    consent_source: consentSource.default('in_store'),
}).refine((c) => !c.email_opt_in || c.email, { message: 'Email promotions need an email address', path: ['email'] });

export const updateCustomerSchema = z.strictObject({
    phone,
    name: z.string().trim().min(1).max(120),
    email: email.nullable(),
    birthday: z.iso.date().nullable(),
    notes: optionalText(500),
    home_store_id: optionalText(50),
}).partial().refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const consentSchema = z.strictObject({
    channel,
    granted: z.boolean(),
    source: consentSource,
});

export const listCustomersQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    opted_in: channel.optional(),           // only customers who agreed to this channel
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

// ---------- campaigns ----------

const campaignFields = {
    name: z.string().trim().min(1).max(120),
    channel,
    subject: optionalText(150),
    // {name} and {first_name} are replaced per customer. WhatsApp's limit is 4096 characters;
    // we keep room for the opt-out line we add at the end.
    body: z.string().trim().min(1).max(3500),
};

export const createCampaignSchema = z.strictObject(campaignFields)
    .refine((c) => c.channel !== 'email' || c.subject, { message: 'An email needs a subject', path: ['subject'] });

export const updateCampaignSchema = z.strictObject(campaignFields).partial()
    .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
});
