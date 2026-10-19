import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';

const COLUMNS = ['id', 'code', 'name', 'type', 'status'];

export async function listLocations() {
    return db('locations').select(COLUMNS).orderBy('code');
}

export async function createLocation(data) {
    const [row] = await db('locations').insert(data).returning(COLUMNS);
    return row;
}

export async function updateLocation(id, changes) {
    const [row] = await db('locations').where({ id }).update({ ...changes, updated_at: db.fn.now() }).returning(COLUMNS);
    if (!row) throw new HttpError(404, `Location ${id} not found`);
    return row;
}
