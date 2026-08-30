import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://example.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.RESEND_API_KEY = 'resend-key';
process.env.LEAD_HASH_SALT = 'test-salt';

const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
let course;
let sentEmail;

const makeBuilder = (table) => {
    const state = { table, operation: null, filters: [], payload: null, count: false, head: false, single: false };
    const matches = (row) => state.filters.every(([column, value]) => String(row[column]) === String(value));

    const run = () => {
        if (state.table === 'courses') {
            if (state.single) {
                return matches(course)
                    ? { data: course, error: null }
                    : { data: null, error: { message: 'not found' } };
            }
            return { data: [], error: null };
        }

        if (state.count) return { data: state.head ? null : [], count: 0, error: null };
        if (state.operation === 'insert') return { data: { id: 'message-1' }, error: null };
        return { data: null, error: null };
    };

    const builder = {
        select(_columns, options) {
            state.count = Boolean(options?.count);
            state.head = Boolean(options?.head);
            return builder;
        },
        insert(payload) {
            state.operation = 'insert';
            state.payload = payload;
            return builder;
        },
        update(payload) {
            state.operation = 'update';
            state.payload = payload;
            return builder;
        },
        eq(column, value) {
            state.filters.push([column, value]);
            return builder;
        },
        gte() {
            return builder;
        },
        single() {
            state.single = true;
            return builder;
        },
        then(resolve, reject) {
            return Promise.resolve(run()).then(resolve, reject);
        }
    };

    return builder;
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: (table) => makeBuilder(table),
        auth: {
            getUser: async () => ({ data: { user: { id: PROVIDER_ID, email: 'anbieter@example.com' } }, error: null })
        }
    })
}));

vi.mock('resend', () => ({
    Resend: class {
        constructor() {
            this.emails = {
                send: async (options) => {
                    sentEmail = options;
                    return { id: 'email-1' };
                }
            };
        }
    }
}));

const { default: handler } = await import('../api/contact.js');

const makeResponse = () => {
    const response = { statusCode: null, body: null };
    response.status = (statusCode) => {
        response.statusCode = statusCode;
        return response;
    };
    response.json = (body) => {
        response.body = body;
        return response;
    };
    return response;
};

describe('/api/contact category suggestions', () => {
    beforeEach(() => {
        course = { id: 42, title: 'Kreativkurs für Einsteiger', user_id: PROVIDER_ID };
        sentEmail = null;
    });

    it('accepts a plain message and adds a direct course link to the email', async () => {
        const response = makeResponse();
        await handler({
            method: 'POST',
            headers: { authorization: 'Bearer provider-token' },
            body: {
                type: 'category-suggestion',
                courseId: 42,
                subject: 'Kategorie-Vorschlag: Kreativkurs',
                message: 'Für diesen Kurs fehlt eine passende Kategorie.'
            }
        }, response);

        expect(response.statusCode).toBe(200);
        expect(sentEmail.html).toContain('Kreativkurs für Einsteiger');
        expect(sentEmail.html).toContain('https://kursnavi.ch/course/42');
        expect(sentEmail.html).toContain('Für diesen Kurs fehlt eine passende Kategorie.');
    });

    it('rejects a suggestion for a course owned by another provider', async () => {
        course.user_id = '33333333-3333-4333-8333-333333333333';
        const response = makeResponse();
        await handler({
            method: 'POST',
            headers: { authorization: 'Bearer provider-token' },
            body: {
                type: 'category-suggestion',
                courseId: 42,
                subject: 'Kategorie-Vorschlag',
                message: 'Unberechtigter Zugriff'
            }
        }, response);

        expect(response.statusCode).toBe(403);
        expect(sentEmail).toBeNull();
    });
});
