import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Regression: ein einziger Speichervorgang legte zwei Kurse an.
//
// Das Speichern schreibt zuerst die Kurszeile und danach Termine, Standorte und
// Kategorien. Scheiterte einer dieser Folgeschritte, kehrte der Handler früh
// zurück — die Kurszeile blieb aber bestehen. Die frisch vergebene ID lebte nur
// in der lokalen Variable `activeCourseId`, also startete der nächste
// Speicherversuch wieder bei `initialData?.id` (leer) und legte über den
// INSERT-Zweig einen ZWEITEN Kurs an statt den ersten zu aktualisieren.
//
// Beobachtet im Preview: Kurs 927 (0 Termine, abgebrochener Lauf) und Kurs 928
// (3 Termine, zweiter Lauf) — feldgleich, 12 Sekunden auseinander.
//
// Dieser Test treibt die echte TeacherForm: erster Speicherversuch scheitert am
// Termin-Insert, zweiter gelingt. Danach darf es genau EINEN Kurs geben.
// ---------------------------------------------------------------------------

const db = {
    courses: [],
    course_events: [],
    course_locations: [],
    course_category_assignments: []
};
let nextId = 500;

// Lässt den nächsten course_events-Insert einmalig scheitern — stellvertretend
// für jeden Folgeschritt, der nach der angelegten Kurszeile abbrechen kann.
let failNextEventInsert = false;

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
        db[state.table] = table.filter(row => !matches(row, state.filters));
        return { data: null, error: null };
    }
    if (state.op === 'update') {
        table.forEach(row => {
            if (matches(row, state.filters)) Object.assign(row, state.payload);
        });
        return { data: null, error: null };
    }
    if (state.op === 'insert') {
        if (state.table === 'course_events' && failNextEventInsert) {
            failNextEventInsert = false;
            return { data: null, error: { message: 'Termin konnte nicht gespeichert werden (Testfehler)' } };
        }
        const rows = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = rows.map(row => ({ id: row.id ?? nextId++, ...row }));
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

const USER_ID = 'user-1';

// Ein NEUER Kurs: alle Pflichtfelder vorbelegt, aber ohne `id` — genau der
// Zustand, in dem der Speicherpfad den INSERT-Zweig nimmt.
const newCourseData = {
    user_id: USER_ID,
    title: 'test',
    description: 'test',
    keywords: 'test',
    booking_type: 'lead',
    status: 'draft',
    category_type: 'privat',
    category_area: 'Kreativ',
    category_specialty: 'Textil',
    category_focus: '',
    image_url: 'https://example.test/course.jpg',
    languages: ['Deutsch'],
    delivery_types: ['presence']
};

const notifications = [];

const renderNewCourseEditor = () => render(
    <TeacherForm
        t={{ btn_back_dash: 'Zurück', edit_course: 'Kurs bearbeiten', create_course: 'Kurs erstellen', success_msg: 'Gespeichert' }}
        setView={() => {}}
        user={{ id: USER_ID, name: 'Test Anbieter' }}
        initialData={newCourseData}
        fetchCourses={() => {}}
        showNotification={(msg) => notifications.push(msg)}
        setEditingCourse={() => {}}
    />
);

// Die Termin-Labels sind nicht über htmlFor verdrahtet — den Input daher über
// den Wrapper des Labels auflösen statt über die DOM-Reihenfolge zu raten.
const startDateInputs = () => screen
    .queryAllByText('Startdatum')
    .map(label => label.parentElement.querySelector('input'))
    .filter(Boolean);

// Schaltet den Editor auf "Konkrete Termine" und trägt ein Startdatum ein —
// so kommt der Speicherpfad überhaupt erst an den Termin-Schritt.
const enterOneEventDate = async () => {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Konkrete Termine/i }));
    });
    await waitFor(() => expect(startDateInputs().length).toBeGreaterThan(0));
    await act(async () => {
        fireEvent.change(startDateInputs()[0], { target: { value: '2027-05-04' } });
    });
    expect(startDateInputs()[0].value).toBe('2027-05-04');
};

const save = async () => {
    await act(async () => {
        // Wie in den Playwright-Specs: der JS-Validator entscheidet, nicht die
        // Constraint-Validierung des Browsers (die requestSubmit blockieren würde).
        document.querySelector('form').noValidate = true;
        fireEvent.click(screen.getByTestId('save-course'));
    });
};

describe('TeacherForm – ein Speichervorgang legt nie zwei Kurse an', () => {
    beforeEach(() => {
        cleanup();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        db.courses = [];
        db.course_events = [];
        db.course_locations = [];
        db.course_category_assignments = [];
        notifications.length = 0;
        nextId = 500;
        failNextEventInsert = false;
        try { sessionStorage.clear(); } catch { /* jsdom ohne sessionStorage */ }
    });

    it('aktualisiert nach einem abgebrochenen Folgeschritt den vorhandenen Kurs statt einen zweiten anzulegen', async () => {
        renderNewCourseEditor();
        await waitFor(() => expect(screen.getByTestId('save-course')).toBeInTheDocument());
        await enterOneEventDate();

        // --- Erster Speicherversuch: Kurs wird angelegt, Termin-Insert scheitert ---
        failNextEventInsert = true;
        await save();

        await waitFor(() => expect(db.courses).toHaveLength(1));
        const firstCourseId = db.courses[0].id;

        // Der abgebrochene Lauf hinterlässt den Kurs ohne Termine — exakt das
        // Muster von Kurs 927 im Preview.
        expect(db.course_events).toHaveLength(0);
        expect(notifications.join(' | ')).toMatch(/Fehler beim Erstellen eines Termins/);

        // --- Zweiter Speicherversuch: derselbe Kurs, jetzt vollständig ---
        await save();

        await waitFor(() => expect(db.course_events.length).toBeGreaterThan(0));

        // Kern der Regression: es bleibt bei GENAU einem Kurs, und zwar demselben.
        expect(db.courses).toHaveLength(1);
        expect(db.courses[0].id).toBe(firstCourseId);

        // Die Termine hängen am ersten (und einzigen) Kurs.
        expect(db.course_events.every(ev => ev.course_id === firstCourseId)).toBe(true);
    });

    it('legt bei einem störungsfreien Speichern genau einen Kurs an', async () => {
        renderNewCourseEditor();
        await waitFor(() => expect(screen.getByTestId('save-course')).toBeInTheDocument());
        await enterOneEventDate();

        await save();

        await waitFor(() => expect(db.courses).toHaveLength(1));
        expect(window.alert).not.toHaveBeenCalled();
        expect(db.course_events.length).toBeGreaterThan(0);
        expect(db.course_events.every(ev => ev.course_id === db.courses[0].id)).toBe(true);
    });
});
