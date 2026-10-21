import config from '../../config/index.js';
import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';
import * as messaging from '../messaging/index.js';

// CAMPAIGNS: one promotional message, written once, sent to every customer who agreed to it.
//
//   1. DRAFT   — write the message. {name} and {first_name} are filled in per customer.
//   2. PREVIEW — see how many customers will get it and exactly what a few of them would receive.
//   3. SEND    — one personal message per customer who agreed to this channel. In preview mode
//                (MESSAGING_MODE=preview) they're recorded as "previewed" and nothing is sent.
//
// Rules: only opted-in customers (per channel), never erased ones; every message ends with how to
// stop receiving them; a campaign is sent once and can't be edited afterwards.

const COLUMNS = [
    'id', 'name', 'channel', 'subject', 'body', 'status', 'created_by_name', 'created_at', 'updated_at',
    'sent_by_name', 'sent_at', 'recipient_count', 'delivery_mode',
];
const ADDRESS_COLUMN = { email: 'email', whatsapp: 'phone' };
const OPT_IN_COLUMN = { email: 'email_opt_in', whatsapp: 'whatsapp_opt_in' };

// The opt-out line added to every promotion. Customers must always be told how to stop them.
function optOutLine(channel) {
    const from = config.messaging.businessName;
    return channel === 'whatsapp'
        ? `\n\nReply STOP to stop promotions from ${from}.`
        : `\n\n—\nYou're receiving this because you agreed to promotions from ${from}. Reply UNSUBSCRIBE to stop.`;
}

// Fill in the placeholders for one customer. Only these two exist; anything else stays as typed.
export function renderMessage(campaign, customer) {
    const firstName = customer.name.trim().split(/\s+/)[0];
    const body = campaign.body.replaceAll('{first_name}', firstName).replaceAll('{name}', customer.name.trim());
    return body + optOutLine(campaign.channel);
}

// Who gets this campaign: customers of this merchant who said yes to the channel, not erased,
// and who have an address for it.
function audienceQuery(trx, user, channel) {
    return trx('customers')
        .where({ merchant_id: user.merchantId, [OPT_IN_COLUMN[channel]]: true })
        .whereNull('erased_at')
        .whereNotNull(ADDRESS_COLUMN[channel]);
}

async function findCampaign(trx, user, id, { lock = false } = {}) {
    const query = trx('campaigns').select(COLUMNS).where({ id, merchant_id: user.merchantId }).first();
    if (lock) query.forUpdate();
    const campaign = await query;
    if (!campaign) throw new HttpError(404, `Campaign ${id} not found`);
    return campaign;
}

// ---------- reading ----------

export async function listCampaigns(user, { limit, offset }) {
    return db('campaigns').select(COLUMNS).where({ merchant_id: user.merchantId })
        .orderBy('created_at', 'desc').limit(limit).offset(offset);
}

export async function getCampaign(user, id) {
    return findCampaign(db, user, id);
}

// How many customers would get it, plus the exact text for up to 3 of them.
export async function previewCampaign(user, id) {
    const campaign = await findCampaign(db, user, id);
    const { count } = await audienceQuery(db, user, campaign.channel).count('* as count').first();
    const sample = await audienceQuery(db, user, campaign.channel).orderBy('name').limit(3)
        .select('id', 'name', ADDRESS_COLUMN[campaign.channel] + ' as to_address');
    return {
        campaign,
        delivery_mode: messaging.deliveryMode(),
        recipient_count: count,
        samples: sample.map((c) => ({ customer_id: c.id, name: c.name, to_address: c.to_address, body: renderMessage(campaign, c) })),
    };
}

export async function listMessages(user, id, { limit, offset }) {
    await findCampaign(db, user, id); // 404 if it isn't this merchant's
    return db('campaign_messages as m')
        .join('customers as c', 'c.id', 'm.customer_id')
        .where('m.campaign_id', id)
        .orderBy('m.id').limit(limit).offset(offset)
        .select('m.id', 'm.customer_id', 'c.name as customer_name', 'm.to_address', 'm.body', 'm.status', 'm.error', 'm.created_at');
}

// ---------- changing ----------

export async function createCampaign(user, data) {
    const [campaign] = await db('campaigns')
        .insert({ ...data, merchant_id: user.merchantId, created_by_name: user.name })
        .returning(COLUMNS);
    return campaign;
}

export async function updateCampaign(user, id, changes) {
    return db.transaction(async (trx) => {
        const campaign = await findCampaign(trx, user, id, { lock: true });
        if (campaign.status !== 'draft') throw new HttpError(409, 'This campaign was already sent and can\'t be changed. Make a copy instead.');
        const merged = { ...campaign, ...changes };
        if (merged.channel === 'email' && !merged.subject) throw new HttpError(400, 'An email needs a subject');
        const [updated] = await trx('campaigns').where({ id }).update({ ...changes, updated_at: trx.fn.now() }).returning(COLUMNS);
        return updated;
    });
}

// Send (or, in preview mode, record) one message per customer in the audience.
// NOTE for live sending later: don't call a real provider inside this database transaction (a slow
// provider would hold the lock, and a rollback can't un-send a message). Switch to an "outbox":
// save the messages here as 'queued', and let a separate worker send them and update their status.
export async function sendCampaign(user, id) {
    return db.transaction(async (trx) => {
        // Lock the campaign so pressing "Send" twice can't send it twice.
        const campaign = await findCampaign(trx, user, id, { lock: true });
        if (campaign.status !== 'draft') throw new HttpError(409, 'This campaign was already sent.');

        const audience = await audienceQuery(trx, user, campaign.channel)
            .orderBy('id').select('id', 'name', ADDRESS_COLUMN[campaign.channel] + ' as to_address');
        if (audience.length === 0) {
            throw new HttpError(409, `No customers have agreed to ${campaign.channel} promotions yet, so there's nobody to send to.`);
        }

        const mode = messaging.deliveryMode();
        const rows = [];
        for (const customer of audience) {
            const body = renderMessage(campaign, customer);
            const result = await messaging.send({ channel: campaign.channel, to: customer.to_address, subject: campaign.subject, body });
            rows.push({ campaign_id: campaign.id, customer_id: customer.id, to_address: customer.to_address, body, status: result.status, error: result.error ?? null });
        }
        // Insert in batches of 500 to keep each database statement a reasonable size.
        for (let i = 0; i < rows.length; i += 500) await trx('campaign_messages').insert(rows.slice(i, i + 500));

        const [sent] = await trx('campaigns').where({ id }).update({
            status: 'sent', sent_by_name: user.name, sent_at: trx.fn.now(),
            recipient_count: rows.length, delivery_mode: mode, updated_at: trx.fn.now(),
        }).returning(COLUMNS);
        return sent;
    });
}
