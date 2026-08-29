import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Regression: Termine im Anbieter-Kurseditor gingen beim Speichern verloren.
//
// Native input[type="date"] fields showed the picked value while the React
// `events` state kept an older snapshot, so `validEvents` was built from stale
// (or empty) dates. After saving and reloading the Termine were gone again.
//
// This test drives the real TeacherForm: it types several Startdaten, checks
// that the "Mindestens ein Termin mit Datum" hint disappears, saves, and then
// re-mounts the editor from what actually landed in course_events — the
// component equivalent of a full page reload.
// ---------------------------------------------------------------------------

// --- In-memory stand-in for the Supabase tables the save path touches -------
const db = {
    courses: [],
    course_events: [],
    course_locations: [],
    course_category_assignments: []
};
let nextEventId = 1000;

const matches = (row, filters) => filters.every(([kind, col, val]) => (
    kind === 'in' ? val.includes(row[col]) : row[col] === val
));

const runQuery = (state) => {
    const table = db[state.table];
    if (!table) return { data: null, error: { message: `unknown table ${state.table}` } };

    if (state.op === 'select') {
        return { data: table.filter(row => matches(row, state.filters)), error: null };
    }
    if (state.op === 'delete') {
        const kept = table.filter(row => !matches(row, state.filters));
        db[state.table] = kept;
        return { data: null, error: null };
    }
    if (state.op === 'update') {
        table.forEach(row => {
            if (matches(row, state.filters)) Object.assign(row, state.payload);
        });
        return { data: null, error: null };
    }
    if (state.op === 'insert') {
        const rows = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = rows.map(row => ({ id: row.id ?? nextEventId++, ...row }));
        table.push(...inserted);
        return { data: inserted, error: null };
    }
    return { data: null, error: null };
};

const makeBuilder = (table) => {
    const state = { table, op: null, payload: null, filters: [] };
    const builder = {
        select() { state.op = state.op || 'select'; return builder; },
        insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
        update(payload) { state.op = 'update'; state.payload = payload; return builder; },
        delete() { state.op = 'delete'; return builder; },
        eq(col, val) { state.filters.push(['eq', col, val]); return builder; },
        in(col, vals) { state.filters.push(['in', col, vals]); return builder; },
        single() { state.single = true; return builder; },
        then(resolve, reject) {
            const result = runQuery(state);
            if (state.single) result.data = Array.isArray(result.data) ? (result.data[0] || null) : result.data;
            return Promise.resolve(result).then(resolve, reject);
        }
    };
    return builder;
};

vi.mock('../src/lib/supabase', () => ({
    supabase: {
        from: (table) => makeBuilder(table),
        auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) }
    }
}));

vi.mock('../src/hooks/useTaxonomy', () => ({
    useTaxonomy: () => ({
        loading: false,
        taxonomy: null,
        types: [],
        areas: [],
        specialties: [],
        focuses: [],
        isV2: false,
        getAreas: () => [],
        getSpecialties: () => [],
        getSpecialtyObjects: () => [],
        getFocuses: () => []
    })
}));

vi.mock('../src/lib/imageUtils', () => ({
    DEFAULT_COURSE_IMAGE: 'https://example.test/default.jpg',
    computeImageHash: async () => 'hash',
    getExistingImageByHash: async () => null,
    uploadImageWithHash: async () => 'https://example.test/uploaded.jpg',
    getUserCourseImages: async () => [],
    deleteImageFromLibrary: async () => ({}),
    isUnsplashUrl: () => false,
    importUnsplashImage: async (url) => url
}));

vi.mock('../src/lib/courseRefresh', () => ({
    refreshCoursesAfterMutation: async () => {}
}));

vi.mock('browser-image-compression', () => ({ default: async (file) => file }));

const { default: TeacherForm } = await import('../src/components/TeacherForm.jsx');

const COURSE_ID = 1;
const USER_ID = 'user-1';

const baseCourse = {
    id: COURSE_ID,
    user_id: USER_ID,
    title: 'Töpferkurs für Einsteiger',
    description: 'Ein Kurs zum Ausprobieren.',
    keywords: 'töpfern, keramik',
    booking_type: 'lead',
    status: 'draft',
    category_type: 'privat',
    category_area: 'Kreativ',
    category_specialty: 'Töpfern',
    category_focus: '',
    image_url: 'https://example.test/course.jpg',
    languages: ['Deutsch'],
    delivery_types: ['presence']
};

const renderEditor = (courseEvents, courseOverrides = {}) => render(
    <TeacherForm
        t={{ btn_back_dash: 'Zurück', edit_course: 'Kurs bearbeiten', create_course: 'Kurs erstellen', success_msg: 'Gespeichert' }}
        setView={() => {}}
        user={{ id: USER_ID, name: 'Test Anbieter' }}
        initialData={{ ...baseCourse, ...courseOverrides, course_events: courseEvents }}
        fetchCourses={() => {}}
        showNotification={() => {}}
        setEditingCourse={() => {}}
    />
);

// Re-reads course_events from the fake DB — this is what a full page reload
// would hand back to the editor.
const reloadEventsFromDb = () => db.course_events
    .filter(ev => ev.course_id === COURSE_ID)
    .map(ev => ({ ...ev }));

// The Termin labels are not wired to their inputs via htmlFor, so resolve each
// input through its label's wrapper instead of guessing at DOM order.
const inputsForLabel = (labelText) => screen
    .queryAllByText(labelText)
    .map(label => label.parentElement.querySelector('input'))
    .filter(Boolean);

const startDateInputs = () => inputsForLabel('Startdatum');
const endDateInputs = () => inputsForLabel('Enddatum (optional)');

describe('TeacherForm – Termine (start_date/end_date) reach the state and survive a reload', () => {
    beforeEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        db.courses = [{ ...baseCourse }];
        db.course_events = [
            { id: 1, course_id: COURSE_ID, start_date: '2026-09-01', end_date: null, location: 'Bahnhofstrasse 1, 8000 Zürich', canton: 'Zürich', schedule_description: '', max_participants: 0 }
        ];
        db.course_locations = [];
        db.course_category_assignments = [];
        nextEventId = 1000;
    });

    it('keeps every entered Startdatum, clears the hint, and still shows all Termine after a reload', async () => {
        renderEditor(reloadEventsFromDb());

        // The editor opens in "Konkrete Termine" mode because the course has dated events.
        await waitFor(() => expect(startDateInputs().length).toBe(1));

        // Add two more Termin rows.
        const addButton = screen.getByRole('button', { name: /Termin hinzufügen/i });
        await act(async () => { fireEvent.click(addButton); });
        await act(async () => { fireEvent.click(addButton); });
        expect(startDateInputs().length).toBe(3);

        // Clear the only dated Termin so the missing-fields hint appears.
        await act(async () => {
            fireEvent.change(startDateInputs()[0], { target: { value: '' } });
        });
        expect(screen.getByText('Mindestens ein Termin mit Datum')).toBeInTheDocument();

        // Enter all three Startdaten inside ONE React batch. A handler that reads
        // `events` from its render closure loses the earlier values here.
        await act(async () => {
            const inputs = startDateInputs();
            fireEvent.change(inputs[0], { target: { value: '2026-10-05' } });
            fireEvent.change(inputs[1], { target: { value: '2026-10-12' } });
            fireEvent.change(inputs[2], { target: { value: '2026-10-19' } });
        });

        // Every field kept its own value — none was overwritten by a stale snapshot.
        expect(startDateInputs().map(i => i.value)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);

        // An Enddatum on the last Termin must land in state too.
        await act(async () => {
            fireEvent.change(endDateInputs()[2], { target: { value: '2026-10-20' } });
        });

        // The hint is gone now that dated Termine exist.
        expect(screen.queryByText('Mindestens ein Termin mit Datum')).not.toBeInTheDocument();

        // Save.
        await act(async () => {
            // Same as the Playwright specs: let the JS validator decide, not the
            // browser's constraint validation (which would block requestSubmit).
            document.querySelector('form').noValidate = true;
            fireEvent.click(screen.getByTestId('save-course'));
        });

        expect(window.alert).not.toHaveBeenCalled();

        // All three Termine were written to course_events, not an empty list.
        await waitFor(() => {
            expect(db.course_events.filter(ev => ev.course_id === COURSE_ID)).toHaveLength(3);
        });
        const savedDates = db.course_events.map(ev => ev.start_date).sort();
        expect(savedDates).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
        expect(db.course_events.find(ev => ev.start_date === '2026-10-19').end_date).toBe('2026-10-20');

        // --- Full reload: unmount and re-open the editor from the DB state -----
        cleanup();
        renderEditor(reloadEventsFromDb());

        await waitFor(() => expect(startDateInputs().length).toBe(3));
        expect(startDateInputs().map(i => i.value).sort()).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
        expect(screen.queryByText('Mindestens ein Termin mit Datum')).not.toBeInTheDocument();
    });

    it('does not wipe saved Termine when a single date field is edited', async () => {
        renderEditor(reloadEventsFromDb());
        await waitFor(() => expect(startDateInputs().length).toBe(1));

        await act(async () => {
            fireEvent.change(startDateInputs()[0], { target: { value: '2026-11-03' } });
        });

        await act(async () => {
            // Same as the Playwright specs: let the JS validator decide, not the
            // browser's constraint validation (which would block requestSubmit).
            document.querySelector('form').noValidate = true;
            fireEvent.click(screen.getByTestId('save-course'));
        });

        expect(window.alert).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(db.course_events.filter(ev => ev.course_id === COURSE_ID)).toHaveLength(1);
        });
        // Updated in place (same row id), not deleted and re-created empty.
        expect(db.course_events[0].id).toBe(1);
        expect(db.course_events[0].start_date).toBe('2026-11-03');
    });

    it('saves a draft without a complete primary category and keeps it unpublished', async () => {
        renderEditor(reloadEventsFromDb(), {
            category_area: '',
            category_specialty: '',
            category_focus: '',
            status: 'draft'
        });

        await waitFor(() => expect(startDateInputs().length).toBe(1));
        document.querySelector('form').noValidate = true;

        await act(async () => {
            fireEvent.click(screen.getByTestId('save-course'));
        });

        expect(window.alert).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(db.courses[0].status).toBe('draft');
            expect(db.courses[0].category_level3_id).toBeNull();
        });
        expect(db.course_category_assignments).toHaveLength(0);
        expect(screen.getByText('Jetzt veröffentlichen').closest('button')).toBeDisabled();
    });

    it('saves the draft first and links the category suggestion to the saved course', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true })
        });
        vi.stubGlobal('fetch', fetchMock);

        renderEditor(reloadEventsFromDb(), {
            category_area: '',
            category_specialty: '',
            category_focus: '',
            status: 'draft'
        });

        await waitFor(() => expect(startDateInputs().length).toBe(1));
        document.querySelector('form').noValidate = true;
        fireEvent.click(screen.getByRole('button', { name: /Kategorie fehlt\?/i }));

        const typeSelect = screen.getByText('Kategorietyp (Level 1) *').parentElement.querySelector('select');
        fireEvent.change(typeSelect, { target: { value: typeSelect.options[1].value } });
        fireEvent.change(screen.getByPlaceholderText('z.B. Digitale Kunst'), { target: { value: 'Neue Kurswelt' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Vorschlag senden & Entwurf speichern/i }));
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0][1];
        const body = JSON.parse(request.body);
        expect(body.type).toBe('category-suggestion');
        expect(body.courseId).toBe(COURSE_ID);
        expect(body.suggestion.newArea).toBe('Neue Kurswelt');
        expect(db.courses[0].status).toBe('draft');
    });
});
