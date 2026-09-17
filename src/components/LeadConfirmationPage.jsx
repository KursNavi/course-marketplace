import React, { useEffect } from 'react';
import { CheckCircle, Info, Search } from 'lucide-react';
import { readLeadConfirmationParams } from '../lib/leadConfirmation';

function goToSearch(setView) {
  window.history.pushState({ view: 'search' }, document.title, '/search');
  if (typeof setView === 'function') setView('search');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export default function LeadConfirmationPage({ setView }) {
  const { reference, responseDeadline } = readLeadConfirmationParams(window.location.search);
  const formattedDeadline = responseDeadline
    ? new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(responseDeadline))
    : null;
  const isValidConfirmation = Boolean(reference);

  useEffect(() => {
    const previousTitle = document.title;
    const existingRobotsTags = Array.from(document.head.querySelectorAll('meta[name="robots"]'));
    const previousRobots = existingRobotsTags.map((tag) => ({
      tag,
      content: tag.getAttribute('content'),
    }));

    // index.html contains the site-wide default. Replace every existing tag
    // while this route is mounted so crawlers cannot see conflicting policies.
    existingRobotsTags.forEach((tag) => tag.remove());
    const robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    robotsTag.setAttribute('content', 'noindex,nofollow');
    document.head.appendChild(robotsTag);
    document.title = `${isValidConfirmation ? 'Anfrage erfolgreich übermittelt' : 'Anfragebestätigung'} | KursNavi`;
    window.scrollTo({ top: 0, behavior: 'auto' });

    return () => {
      robotsTag.remove();
      previousRobots.forEach(({ tag, content }) => {
        if (content === null) tag.removeAttribute('content');
        else tag.setAttribute('content', content);
        document.head.appendChild(tag);
      });
      document.title = previousTitle;
    };
  }, [isValidConfirmation]);

  return (
    <>
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <section className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 text-center" aria-labelledby="lead-confirmation-title">
          {isValidConfirmation ? (
            <>
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-9 h-9" aria-hidden="true" />
              </div>
              <h1 id="lead-confirmation-title" className="text-2xl font-bold text-dark mb-3 font-heading">
                Anfrage erfolgreich übermittelt
              </h1>
              <p className="text-gray-600 mb-5">
                Deine Anfrage wurde an den Anbieter weitergeleitet.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left space-y-2">
                <p className="text-sm text-gray-700">
                  <strong>Referenz:</strong> <span className="break-all">{reference}</span>
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Antwort erwartet:</strong>{' '}
                  {formattedDeadline || 'innerhalb von 2 Werktagen'}
                </p>
                <p className="text-sm text-gray-700">
                  Notiere dir bitte die Referenz. Bei Rückfragen kannst du dich an{' '}
                  <a href="mailto:info@kursnavi.ch" className="font-semibold text-primary hover:underline">info@kursnavi.ch</a>{' '}
                  wenden.
                </p>
              </div>
              <button
                type="button"
                onClick={() => goToSearch(setView)}
                className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition flex items-center justify-center"
              >
                <Search className="w-4 h-4 mr-2" aria-hidden="true" /> Weitere Kurse entdecken
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-5">
                <Info className="w-9 h-9" aria-hidden="true" />
              </div>
              <h1 id="lead-confirmation-title" className="text-2xl font-bold text-dark mb-3 font-heading">
                Bestätigung nicht verfügbar
              </h1>
              <p className="text-gray-600 mb-6">
                Dieser Bestätigungslink ist unvollständig oder nicht mehr gültig. Bitte sende deine Anfrage erneut über die Kursübersicht.
              </p>
              <button
                type="button"
                onClick={() => goToSearch(setView)}
                className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition flex items-center justify-center"
              >
                <Search className="w-4 h-4 mr-2" aria-hidden="true" /> Zur Suche
              </button>
            </>
          )}
        </section>
      </main>
    </>
  );
}
