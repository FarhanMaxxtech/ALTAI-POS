import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';

export async function listCategories() {
    return db('categories').select('id', 'parent_id', 'name').orderBy('name');
}

export async function createCategory({ name, parent_id = null }) {
    if (parent_id) {
        const parent = await db('categories').where({ id: parent_id }).first();
        if (!parent) throw new HttpError(400, `Parent category ${parent_id} does not exist`);
    }
    const [row] = await db('categories')
        .insert({ name, parent_id })
        .returning(['id', 'parent_id', 'name']);
    return row;
}
