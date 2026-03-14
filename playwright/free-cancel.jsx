/* global window, document, structuredClone */
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import Dashboard from '../src/components/Dashboard.jsx';
import { supabase } from '../src/lib/supabase';

const noopQueryResult = Promise.resolve({ data: [], error: null });

supabase.auth.getUser = async () => ({
  data: { user: { id: 'user-free-booking' } },
  error: null
});

supabase.auth.getSession = async () => ({
  data: { session: { access_token: 'playwright-token' } },
  error: null
});

supabase.from = (table) => {
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return noopQueryResult;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    }
  };

  if (table === 'course_category_assignments') {
    builder.eq = () => Promise.resolve({ data: [], error: null });
  }

  return builder;
};

const initialBookings = [
  {
    id: 101,
    booking_id: 101,
    title: 'Testkurs Direktbuchung Termin',
    instructor_name: 'ICH',
    canton: 'Luzern',
    image_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80',
    booking_type: 'platform',
    booking_status: 'confirmed',
    auto_refund_until: '2099-03-21T20:53:00.000Z',
    is_paid: false,
    disputed_at: null,
    refunded_at: null,
    goodwill_status: null,
    goodwill_requested_at: null,
    goodwill_request_message: null,
    goodwill_decision_message: null,
    goodwill_refund_percent: null,
    goodwill_refund_amount_cents: null,
    delivered_at: null,
    price: 0,
    event: {
      start_date: '2099-03-28',
      location: 'Luzern',
      cancelled_at: null
    }
  }
];

window.__playwrightBookings = structuredClone(initialBookings);

window.fetch = async (url, options = {}) => {
  if (url === '/api/refund-booking') {
    const payload = JSON.parse(options.body || '{}');
    window.__refundRequest = {
      url,
      bookingId: payload.bookingId,
      headers: options.headers || {}
    };

    window.__playwrightBookings = window.__playwrightBookings.map((booking) =>
      booking.booking_id === payload.bookingId
        ? {
            ...booking,
            booking_status: 'refunded',
            refunded_at: new Date('2099-03-14T21:30:00.000Z').toISOString()
          }
        : booking
    );

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          message: 'Buchung storniert',
          credit_amount_chf: '0.00',
          new_balance_chf: '0.00',
          credit_added: false
        };
      }
    };
  }

  throw new Error(`Unexpected fetch to ${url}`);
};

function Harness() {
  const [user, setUser] = useState({
    id: 'user-free-booking',
    role: 'student',
    name: 'Bjorn Respondedek',
    email: 'bjorn@example.com',
    credit_balance_cents: 0
  });
  const [bookings, setBookings] = useState(structuredClone(window.__playwrightBookings));
  const [notification, setNotification] = useState(null);

  const t = useMemo(
    () => ({
      my_bookings: 'Meine Buchungen',
      booking_confirmed: 'Bestätigt',
      no_bookings_yet: 'Du hast noch keine Kurse gebucht.'
    }),
    []
  );

  return (
    <div className="min-h-screen bg-[#f6f0ea] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Playwright Harness</h1>
          {notification && (
            <div
              data-testid="notification"
              data-tone={notification.tone || 'success'}
              className={notification.tone === 'error' ? 'text-red-700' : 'text-green-700'}
            >
              {notification.message}
            </div>
          )}
        </div>

        <Dashboard
          user={user}
          setUser={setUser}
          t={t}
          setView={() => {}}
          courses={[]}
          teacherEarnings={[]}
          myBookings={bookings}
          savedCourses={[]}
          savedCourseIds={[]}
          onToggleSaveCourse={() => {}}
          handleDeleteCourse={() => {}}
          handleEditCourse={() => {}}
          handleUpdateCourseStatus={() => {}}
          handleCancelEvent={async () => {}}
          showNotification={(message, tone) => setNotification({ message, tone })}
          changeLanguage={() => {}}
          setSelectedCourse={() => {}}
          refreshBookings={async () => {
            setBookings(structuredClone(window.__playwrightBookings));
          }}
          refreshTeacherEarnings={async () => {}}
          isImpersonating={false}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Harness />);
