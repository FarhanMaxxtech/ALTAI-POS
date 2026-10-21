// Run with: npm test
// Customers, consent and campaigns, end to end through the API. Uses the dev database under a
// made-up merchant id unique to this run, and deletes everything it created at the end.
// Messaging runs in preview mode: nothing is ever sent.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const RUN = `C${Date.now().toString(36).toUpperCase()}`;
const OTHER = `${RUN}X`;
let api, db, staff, otherBusiness;

before(async () => {
    process.env.AUTH_SECRET = 'test-secret-for-signing-tokens';
    process.env.MESSAGING_MODE = 'preview';
    process.env.BUSINESS_NAME = 'ALTAI Test';
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
    const { encodeToken } = await import('../src/services/integrations/altai-api/token.js');
    const bearer = (merchantId, name) => ({ Authorization: `Bearer ${encodeToken({ session: 's', merchantId, loginId: name.toLowerCase(), name })}` });
    staff = bearer(RUN, 'Aina');
    otherBusiness = bearer(OTHER, 'Zed');
});

after(async () => {
    const campaignIds = db('campaigns').whereIn('merchant_id', [RUN, OTHER]).select('id');
    const customerIds = db('customers').whereIn('merchant_id', [RUN, OTHER]).select('id');
    await db('campaign_messages').whereIn('campaign_id', campaignIds).del();
    await db('campaigns').whereIn('merchant_id', [RUN, OTHER]).del();
    await db('customer_consents').whereIn('customer_id', customerIds).del();
    await db('customers').whereIn('merchant_id', [RUN, OTHER]).del();
    await db.destroy();
});

const create = (body) => api.post('/api/customers').set(staff).send(body);
const consent = (id, body) => api.post(`/api/customers/${id}/consent`).set(staff).send(body);
const ids = {};

test('register a customer: phone stored in one standard form, consent "no" by default and recorded', async () => {
    const res = await create({ phone: '012-345 6789', name: 'Siti Aminah', birthday: '1990-05-14' }).expect(201);
    const c = res.body.customer;
    ids.siti = c.id;
    assert.equal(c.phone, '+60123456789');
    assert.equal(c.birthday, '1990-05-14', 'date stays the same day (no timezone shift)');
    assert.equal(c.created_by_name, 'Aina');
    assert.deepEqual([c.email_opt_in, c.whatsapp_opt_in], [false, false]);
    assert.deepEqual(c.consent_history.map((h) => [h.channel, h.granted]).sort(), [['email', false], ['whatsapp', false]]);
});

test('same phone typed differently → 409 naming who has it', async () => {
    const res = await create({ phone: '+60 12 345 6789', name: 'Someone Else' }).expect(409);
    assert.match(res.body.error, /already registered to Siti Aminah/);
    assert.equal(res.body.details[0].customer_id, ids.siti);
});

test('validation: bad phone, email promotions without an email', async () => {
    const bad = await create({ phone: '12345', name: 'X' }).expect(400);
    assert.match(bad.body.details[0].message, /valid phone number/);
    await create({ phone: '0129999999', name: 'X', email_opt_in: true }).expect(400);
});

test('consent: yes to WhatsApp is recorded with who and how; email needs an address first', async () => {
    const res = await consent(ids.siti, { channel: 'whatsapp', granted: true, source: 'in_store' }).expect(200);
    assert.equal(res.body.customer.whatsapp_opt_in, true);
    assert.deepEqual(
        (({ channel, granted, source, recorded_by_name }) => ({ channel, granted, source, recorded_by_name }))(res.body.customer.consent_history[0]),
        { channel: 'whatsapp', granted: true, source: 'in_store', recorded_by_name: 'Aina' },
    );
    await consent(ids.siti, { channel: 'email', granted: true, source: 'in_store' }).expect(400);
});

test('more customers for the campaign tests', async () => {
    ids.ben = (await create({ phone: '0111234 5678', name: 'Ben Tan', email: 'BEN@Example.com', email_opt_in: true }).expect(201)).body.customer.id;
    ids.chen = (await create({ phone: '0137778888', name: 'Chen Wei', whatsapp_opt_in: true }).expect(201)).body.customer.id;
    ids.dina = (await create({ phone: '0145556666', name: 'Dina Rahman', whatsapp_opt_in: true }).expect(201)).body.customer.id;
    const ben = (await api.get(`/api/customers/${ids.ben}`).set(staff).expect(200)).body.customer;
    assert.equal(ben.email, 'ben@example.com', 'emails are stored lower-case');
});

test('search by part of a name, part of a phone, a full phone typed any way, or email', async () => {
    const find = async (q) => (await api.get('/api/customers').set(staff).query({ q }).expect(200)).body.customers.map((c) => c.name);
    assert.deepEqual(await find('amin'), ['Siti Aminah']);
    assert.deepEqual(await find('3456789'), ['Siti Aminah']);
    assert.deepEqual(await find('012 345 6789'), ['Siti Aminah']);
    assert.deepEqual(await find('example.com'), ['Ben Tan']);
    const waOnly = (await api.get('/api/customers').set(staff).query({ opted_in: 'whatsapp' }).expect(200)).body.customers.map((c) => c.name);
    assert.deepEqual(waOnly, ['Chen Wei', 'Dina Rahman', 'Siti Aminah']);
});

test('removing an email also ends email promotions, and that is recorded', async () => {
    const tmp = (await create({ phone: '0151112222', name: 'Temp Person', email: 't@example.com', email_opt_in: true }).expect(201)).body.customer;
    const res = await api.patch(`/api/customers/${tmp.id}`).set(staff).send({ email: null }).expect(200);
    assert.equal(res.body.customer.email_opt_in, false);
    assert.deepEqual((({ channel, granted, source }) => ({ channel, granted, source }))(res.body.customer.consent_history[0]), { channel: 'email', granted: false, source: 'staff_update' });
});

let waCampaign;

test('campaign draft: email needs a subject; WhatsApp draft created', async () => {
    await api.post('/api/campaigns').set(staff).send({ name: 'x', channel: 'email', body: 'Hi' }).expect(400);
    const res = await api.post('/api/campaigns').set(staff)
        .send({ name: 'Raya sale', channel: 'whatsapp', body: 'Hi {first_name}! Raya sale: 20% off all tees this weekend.' }).expect(201);
    waCampaign = res.body.campaign;
    assert.equal(waCampaign.status, 'draft');
});

test('preview: only customers who said yes; exact personal text with the opt-out line', async () => {
    let p = (await api.get(`/api/campaigns/${waCampaign.id}/preview`).set(staff).expect(200)).body;
    assert.equal(p.recipient_count, 3); // Chen, Dina, Siti (Ben said no to WhatsApp)
    assert.equal(p.delivery_mode, 'preview');

    // Dina withdraws, Chen asks to have their data erased → both drop out.
    await consent(ids.dina, { channel: 'whatsapp', granted: false, source: 'customer_reply' }).expect(200);
    const erased = (await api.post(`/api/customers/${ids.chen}/erase`).set(staff).expect(200)).body.customer;
    assert.deepEqual([erased.name, erased.phone, erased.whatsapp_opt_in], ['Erased customer', null, false]);
    assert.ok(erased.erased_at);

    p = (await api.get(`/api/campaigns/${waCampaign.id}/preview`).set(staff).expect(200)).body;
    assert.equal(p.recipient_count, 1);
    assert.equal(p.samples[0].to_address, '+60123456789');
    assert.equal(p.samples[0].body, 'Hi Siti! Raya sale: 20% off all tees this weekend.\n\nReply STOP to stop promotions from ALTAI Test.');
});

test('send: recorded as previewed (nothing sent), once only, then locked', async () => {
    const [a, b] = await Promise.all([
        api.post(`/api/campaigns/${waCampaign.id}/send`).set(staff),
        api.post(`/api/campaigns/${waCampaign.id}/send`).set(staff),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], 'pressing Send twice sends once');
    const sent = (a.status === 200 ? a : b).body.campaign;
    assert.deepEqual([sent.status, sent.recipient_count, sent.delivery_mode, sent.sent_by_name], ['sent', 1, 'preview', 'Aina']);

    const msgs = (await api.get(`/api/campaigns/${waCampaign.id}/messages`).set(staff).expect(200)).body.messages;
    assert.deepEqual(msgs.map((m) => [m.customer_name, m.status]), [['Siti Aminah', 'previewed']]);

    await api.patch(`/api/campaigns/${waCampaign.id}`).set(staff).send({ body: 'changed' }).expect(409);
});

test('email campaign reaches the email opt-ins, with the unsubscribe footer', async () => {
    const c = (await api.post('/api/campaigns').set(staff).send({ name: 'VIP night', channel: 'email', subject: 'You are invited', body: 'Dear {name}, join us.' }).expect(201)).body.campaign;
    const p = (await api.get(`/api/campaigns/${c.id}/preview`).set(staff).expect(200)).body;
    assert.equal(p.recipient_count, 1);
    assert.equal(p.samples[0].to_address, 'ben@example.com');
    assert.match(p.samples[0].body, /^Dear Ben Tan, join us\.\n\n—\nYou're receiving this because you agreed to promotions from ALTAI Test\. Reply UNSUBSCRIBE to stop\.$/);
});

test('nobody opted in → sending is refused', async () => {
    // A brand-new business with one customer who said no.
    const other = (await api.post('/api/customers').set(otherBusiness).send({ phone: '0160001111', name: 'No Thanks' }).expect(201)).body.customer;
    assert.ok(other.id);
    const c = (await api.post('/api/campaigns').set(otherBusiness).send({ name: 'x', channel: 'whatsapp', body: 'Hi' }).expect(201)).body.campaign;
    const res = await api.post(`/api/campaigns/${c.id}/send`).set(otherBusiness).expect(409);
    assert.match(res.body.error, /nobody to send to/);
});

test("another business can't see these customers or campaigns; an erased phone can register again", async () => {
    await api.get(`/api/customers/${ids.siti}`).set(otherBusiness).expect(404);
    await api.get(`/api/campaigns/${waCampaign.id}`).set(otherBusiness).expect(404);
    const theirs = (await api.get('/api/customers').set(otherBusiness).expect(200)).body.customers.map((c) => c.name);
    assert.deepEqual(theirs, ['No Thanks']);

    const again = await create({ phone: '0137778888', name: 'Chen Wei' }).expect(201);
    assert.notEqual(again.body.customer.id, ids.chen);
});

test('no token → 401', async () => {
    await api.get('/api/customers').expect(401);
    await api.get('/api/campaigns').expect(401);
});
