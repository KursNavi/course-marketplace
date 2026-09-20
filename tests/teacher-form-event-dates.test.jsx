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
let restoreCourseFormatAfterRelatedWrite = false;

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
        if (restoreCourseFormatAfterRelatedWrite && state.table === 'course_category_assignments') {
            const courseId = inserted[0]?.course_id;
            const course = db.courses.find(row => row.id === courseId);
            if (course) course.privat_kursart = 'wochenkurs';
        }
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

const renderEditor = (courseEvents, courseOverrides = {}, formOverrides = {}) => render(
    <TeacherForm
        t={{ btn_back_dash: 'Zurück', edit_course: 'Kurs bearbeiten', create_course: 'Kurs erstellen', success_msg: 'Gespeichert' }}
        setView={() => {}}
        user={{ id: USER_ID, name: 'Test Anbieter' }}
        initialData={{ ...baseCourse, ...courseOverrides, course_events: courseEvents }}
        fetchCourses={() => {}}
        showNotification={() => {}}
        setEditingCourse={() => {}}
        {...formOverrides}
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

describe('TeacherForm – Hinweis zu Suchbegriffen', () => {
    beforeEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        db.courses = [{ ...baseCourse }];
        db.course_events = [];
        db.course_locations = [];
        db.course_category_assignments = [];
        restoreCourseFormatAfterRelatedWrite = false;
    });

    it('erklärt die Suchlogik und enthält ein Beispiel für irrelevante Treffer', async () => {
        renderEditor([]);

        const keywordsInput = await screen.findByRole('textbox', { name: /Suchbegriffe für die Suche/i });
        expect(keywordsInput).toHaveAttribute('aria-describedby', 'course-keywords-hint');
        expect(screen.getByText(/Damit keine irrelevanten Kurse erscheinen/i)).toBeInTheDocument();
        expect(screen.getByText(/nicht die Kursbeschreibung/i)).toBeInTheDocument();
        expect(screen.getByText(/Fotokurs.*Kaffee und Gipfeli.*bei «Kaffee» erscheinen/i)).toBeInTheDocument();
    });
});

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

    it('sends newly added platform Termine with the inherited location through the admin API', async () => {
        const existingEvent = {
            id: 'event-1',
            course_id: COURSE_ID,
            start_date: '2026-10-05',
            end_date: '2026-10-09',
            location: 'Atelierstrasse 8, 8000 Zürich',
            canton: 'Zürich',
            schedule_description: '',
            max_participants: 0
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, courseId: COURSE_ID })
        });
        vi.stubGlobal('fetch', fetchMock);

        renderEditor([existingEvent], {
            booking_type: 'platform',
            price: 120,
            status: 'draft'
        }, {
            user: { id: USER_ID, name: 'Test Anbieter', stripe_connect_onboarding_complete: true },
            isAdminImpersonating: true
        });

        const dateInputs = () => [...document.querySelectorAll('input[type="date"]')];
        await waitFor(() => expect(dateInputs()).toHaveLength(1));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Termin hinzufügen/i })); });
        expect(dateInputs()).toHaveLength(2);

        await act(async () => {
            fireEvent.change(dateInputs()[1], { target: { value: '2027-02-15' } });
            document.querySelector('form').noValidate = true;
            fireEvent.click(screen.getByTestId('save-course'));
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.validEvents).toHaveLength(2);
        expect(body.validEvents.map(event => event.start_date)).toEqual(['2026-10-05', '2027-02-15']);
        expect(body.validEvents[1]).toMatchObject({
            street: 'Atelierstrasse 8',
            city: '8000 Zürich',
            canton: 'Zürich'
        });
    });

    it('saves a lead course in Feste-Standorte mode without concrete Termine through the admin API', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, courseId: COURSE_ID })
        });
        vi.stubGlobal('fetch', fetchMock);

        renderEditor([], {
            booking_type: 'lead',
            course_locations: [{
                id: 'location-1',
                location_type: 'presence',
                street: 'Bahnhofstrasse 1',
                city: '8000 Zürich',
                canton: 'Zürich',
                sort_order: 0
            }]
        }, {
            isAdminImpersonating: true
        });

        await waitFor(() => expect(screen.getByText('Feste Standorte')).toBeInTheDocument());
        document.querySelector('form').noValidate = true;

        await act(async () => {
            fireEvent.click(screen.getByTestId('save-course'));
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.locationMode).toBe('locations');
        expect(body.validEvents).toEqual([]);
        expect(body.locations[0]).toMatchObject({
            street: 'Bahnhofstrasse 1',
            city: '8000 Zürich',
            canton: 'Zürich'
        });
        expect(window.alert).not.toHaveBeenCalled();
    });

    it('uses the just-selected Feste-Standorte mode when saving immediately', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, courseId: COURSE_ID })
        });
        vi.stubGlobal('fetch', fetchMock);

        renderEditor([{
            id: 'event-1',
            course_id: COURSE_ID,
            start_date: '2026-10-05',
            end_date: null,
            location: 'Bahnhofstrasse 1, 8000 Zürich',
            canton: 'Zürich',
            schedule_description: '',
            max_participants: 0
        }], {
            booking_type: 'lead',
            course_locations: [{
                id: 'location-1',
                location_type: 'presence',
                street: 'Bahnhofstrasse 1',
                city: '8000 Zürich',
                canton: 'Zürich',
                sort_order: 0
            }]
        }, {
            isAdminImpersonating: true
        });

        await waitFor(() => expect(screen.getByText('Feste Standorte')).toBeInTheDocument());
        document.querySelector('form').noValidate = true;

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Feste Standorte/i }));
            fireEvent.click(screen.getByTestId('save-course'));
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.locationMode).toBe('locations');
        expect(body.validEvents).toEqual([]);
        expect(window.alert).not.toHaveBeenCalled();
    });

    it('keeps a persisted private course format selected when the editor opens', async () => {
        renderEditor([], { privat_kursart: 'einfuehrungskurs' });

        await waitFor(() => {
            expect(screen.getByRole('radio', { name: /Einführung/i })).toBeChecked();
        });
        expect(screen.getByRole('radio', { name: /Wochenkurs/i })).not.toBeChecked();
    });

    it('does not block provider metadata edits because of a legacy location without canton', async () => {
        db.courses = [{ ...baseCourse, privat_kursart: 'wochenkurs' }];
        restoreCourseFormatAfterRelatedWrite = true;
        db.course_locations = [{
            id: 'location-legacy',
            course_id: COURSE_ID,
            location_type: 'presence',
            street: 'Bahnhofstrasse 1',
            city: '8000 Zürich',
            canton: null,
            sort_order: 0
        }];

        renderEditor([], {
            privat_kursart: 'wochenkurs',
            course_locations: db.course_locations
        }, {
            isAdminImpersonating: false
        });

        const introductionRadio = await screen.findByRole('radio', { name: /Einführung/i });
        document.querySelector('form').noValidate = true;

        await act(async () => {
            fireEvent.click(introductionRadio);
            fireEvent.click(screen.getByTestId('save-course'));
        });

        await waitFor(() => expect(db.courses[0].privat_kursart).toBe('einfuehrungskurs'));
        expect(window.alert).not.toHaveBeenCalledWith('Bitte wähle für jeden Präsenz-Standort einen Kanton aus.');
    });

    it('sends the newly selected private course format through the admin API', async () => {
        let savedCourse;
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ok: true,
                courseId: COURSE_ID,
                course: { id: COURSE_ID, privat_kursart: 'einfuehrungskurs' }
            })
        });
        vi.stubGlobal('fetch', fetchMock);

        renderEditor([], {
            privat_kursart: 'wochenkurs',
            course_locations: [{
                id: 'location-1',
                location_type: 'presence',
                street: 'Bahnhofstrasse 1',
                city: '8000 Zürich',
                canton: 'Zürich',
                sort_order: 0
            }]
        }, {
            isAdminImpersonating: true,
            onCourseSaved: (course) => { savedCourse = course; }
        });

        const introductionRadio = await screen.findByRole('radio', { name: /Einführung/i });
        expect(screen.getByRole('radio', { name: /Wochenkurs/i })).toBeChecked();

        document.querySelector('form').noValidate = true;
        await act(async () => {
            fireEvent.click(introductionRadio);
            fireEvent.click(screen.getByTestId('save-course'));
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.course.privat_kursart).toBe('einfuehrungskurs');
        expect(savedCourse).toMatchObject({ id: COURSE_ID, privat_kursart: 'einfuehrungskurs' });
        expect(window.alert).not.toHaveBeenCalled();
    });

    it('still requires a valid date after switching to Konkrete Termine', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        renderEditor([], {
            booking_type: 'lead',
            course_locations: [{
                id: 'location-1',
                location_type: 'presence',
                street: 'Bahnhofstrasse 1',
                city: '8000 Zürich',
                canton: 'Zürich',
                sort_order: 0
            }]
        }, {
            isAdminImpersonating: true
        });

        await waitFor(() => expect(screen.getByRole('button', { name: /Konkrete Termine/i })).toBeInTheDocument());
        document.querySelector('form').noValidate = true;

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Konkrete Termine/i }));
            fireEvent.click(screen.getByTestId('save-course'));
        });

        expect(window.alert).toHaveBeenCalledWith('Bitte gib mindestens einen Termin mit Datum an.');
        expect(fetchMock).not.toHaveBeenCalled();
        window.alert.mockClear();
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
        fireEvent.click(screen.getByRole('button', { name: /Kategorie vorschlagen/i }));

        const suggestionMessage = screen.getByPlaceholderText(/Kreativkurse für Erwachsene/i);
        fireEvent.change(suggestionMessage, { target: { value: 'Für diesen Kurs fehlt eine passende Kategorie rund um kreative Ferienangebote.' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Vorschlag senden & Entwurf speichern/i }));
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0][1];
        const body = JSON.parse(request.body);
        expect(body.type).toBe('category-suggestion');
        expect(body.courseId).toBe(COURSE_ID);
        expect(body.message).toContain('kreative Ferienangebote');
        expect(body.suggestion).toBeUndefined();
        expect(db.courses[0].status).toBe('draft');
    });
});
