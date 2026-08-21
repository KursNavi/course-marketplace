/**
 * Regression: /api/admin action=save-course must never replace saved Termine
 * with an empty event list.
 *
 * The impersonated save path ran the course_events sync unconditionally. When
 * the client sent `validEvents: []` — which happened whenever the editor state
 * had lost its dates — every row in course_events was deleted and nothing was
 * written back, so the Termine were gone after reloading the course.
 *
 * The same payload also dropped `bookingType`/`locations`, which wiped
 * course_locations for the impersonated provider.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://example.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const COURSE_ID = '33333333-3333-4333-8333-333333333333';

let db;
let nextId;

const matches = (row, filters) => filters.every(([kind, col, val]) => (
    kind === 'in' ? val.includes(row[col]) : row[col] === val
));

const makeBuilder = (table) => {
    const state = { table, op: null, payload: null, filters: [], head: false, count: false };
    const run = () => {
        const rows = db[table] || [];
        if (state.op === 'select') {
            const found = rows.filter(row => matches(row, state.filters));
            if (state.count) return { data: state.head ? null : found, count: found.length, error: null };
            if (state.single) {
                return found[0]
                    ? { data: found[0], error: null }
                    : { data: null, error: { message: 'not found' } };
            }
            return { data: found, error: null };
        }
        if (state.op === 'delete') {
            db[table] = rows.filter(row => !matches(row, state.filters));
            return { data: null, error: null };
        }
        if (state.op === 'update') {
            rows.forEach(row => { if (matches(row, state.filters)) Object.assign(row, state.payload); });
            return { data: null, error: null };
        }
        if (state.op === 'insert') {
            const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
            const inserted = incoming.map(row => ({ id: row.id ?? `row-${nextId++}`, ...row }));
            rows.push(...inserted);
            db[table] = rows;
            return state.single ? { data: inserted[0], error: null } : { data: inserted, error: null };
        }
        return { data: null, error: null };
    };

    const builder = {
        select(_cols, opts) {
            state.op = state.op || 'select';
            if (opts?.count) state.count = true;
            if (opts?.head) state.head = true;
            return builder;
        },
        insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
        update(payload) { state.op = 'update'; state.payload = payload; return builder; },
        delete() { state.op = 'delete'; return builder; },
        eq(col, val) { state.filters.push(['eq', col, val]); return builder; },
        in(col, vals) { state.filters.push(['in', col, vals]); return builder; },
        single() { state.single = true; return builder; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); }
    };
    return builder;
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: (table) => makeBuilder(table),
        auth: {
            getUser: async (token) => (token === 'admin-token'
                ? { data: { user: { id: ADMIN_ID } }, error: null }
                : { data: null, error: { message: 'bad token' } })
        }
    })
}));

const { default: handler } = await import('../api/admin.js');

const makeRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

const callSaveCourse = async (payload) => {
    const req = {
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        query: {},
        body: { action: 'save-course', userId: PROVIDER_ID, courseId: COURSE_ID, course: { title: 'Kurs' }, ...payload }
    };
    const res = makeRes();
    await handler(req, res);
    return res;
};

const courseEvents = () => db.course_events.filter(ev => ev.course_id === COURSE_ID);

describe('/api/admin save-course — Termine dürfen nicht durch eine leere Liste ersetzt werden', () => {
    beforeEach(() => {
        nextId = 1;
        db = {
            profiles: [{ id: ADMIN_ID, role: 'admin' }],
            courses: [{ id: COURSE_ID, user_id: PROVIDER_ID, image_url: null, title: 'Kurs' }],
            course_events: [
                { id: 'ev-1', course_id: COURSE_ID, start_date: '2026-10-05', end_date: null, location: 'Bahnhofstrasse 1, 8000 Zürich', canton: 'Zürich', schedule_description: '', max_participants: 0 },
                { id: 'ev-2', course_id: COURSE_ID, start_date: '2026-10-12', end_date: null, location: 'Bahnhofstrasse 1, 8000 Zürich', canton: 'Zürich', schedule_description: '', max_participants: 0 }
            ],
            course_locations: [
                { id: 'loc-1', course_id: COURSE_ID, location_type: 'presence', street: null, city: '8000 Zürich', canton: 'Zürich', sort_order: 0 }
            ],
            course_category_assignments: []
        };
    });

    it('rejects an empty event list instead of deleting the saved Termine', async () => {
        const res = await callSaveCourse({ validEvents: [] });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/gespeicherte Termine/i);
        expect(courseEvents().map(ev => ev.start_date)).toEqual(['2026-10-05', '2026-10-12']);
    });

    it('treats events without a start_date as empty and keeps the saved Termine', async () => {
        const res = await callSaveCourse({
            validEvents: [{ id: null, start_date: '', location: '', canton: 'Zürich' }]
        });

        expect(res.statusCode).toBe(400);
        expect(courseEvents()).toHaveLength(2);
    });

    it('does not touch course_locations when bookingType is missing from the payload', async () => {
        await callSaveCourse({ validEvents: [] });

        expect(db.course_locations).toHaveLength(1);
        expect(db.course_locations[0].id).toBe('loc-1');
    });

    it('still clears the Termine when the course is explicitly in "Feste Standorte" mode', async () => {
        const res = await callSaveCourse({
            validEvents: [],
            bookingType: 'lead',
            locationMode: 'locations',
            locations: [{ type: 'presence', street: 'Seestrasse 4', city: '6000 Luzern', canton: 'Luzern' }]
        });

        expect(res.statusCode).toBe(200);
        expect(courseEvents()).toHaveLength(0);
        expect(db.course_locations).toHaveLength(1);
        expect(db.course_locations[0].canton).toBe('Luzern');
    });

    it('updates existing Termine, inserts new ones and removes only the ones left out', async () => {
        const res = await callSaveCourse({
            bookingType: 'lead',
            locationMode: 'events',
            validEvents: [
                { id: 'ev-1', type: 'presence', start_date: '2026-10-06', end_date: '2026-10-07', location: 'Bahnhofstrasse 1, 8000 Zürich', canton: 'Zürich', schedule_description: 'Sa & So', max_participants: 0 },
                { id: null, type: 'presence', start_date: '2026-10-19', end_date: null, location: 'Seestrasse 4, 6000 Luzern', canton: 'Luzern', schedule_description: '', max_participants: 8 }
            ]
        });

        expect(res.statusCode).toBe(200);
        const saved = courseEvents().sort((a, b) => a.start_date.localeCompare(b.start_date));
        expect(saved.map(ev => ev.start_date)).toEqual(['2026-10-06', '2026-10-19']);
        expect(saved[0].id).toBe('ev-1');
        expect(saved[0].end_date).toBe('2026-10-07');
        expect(saved[1].max_participants).toBe(8);
        // ev-2 was not part of the payload and is the only row that got removed.
        expect(courseEvents().some(ev => ev.id === 'ev-2')).toBe(false);
    });

    it('normalises the canton of online Termine like the direct save path does', async () => {
        await callSaveCourse({
            bookingType: 'lead',
            locationMode: 'events',
            validEvents: [
                { id: 'ev-1', type: 'online', start_date: '2026-10-06', location: 'Online', canton: 'Zürich', schedule_description: '', max_participants: 0 },
                { id: 'ev-2', type: 'ausland', start_date: '2026-10-12', location: 'München', canton: 'Zürich', schedule_description: '', max_participants: 0 }
            ]
        });

        const byId = Object.fromEntries(courseEvents().map(ev => [ev.id, ev]));
        expect(byId['ev-1'].canton).toBeNull();
        expect(byId['ev-2'].canton).toBe('Ausland');
    });
});
