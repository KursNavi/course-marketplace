import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, X, Check, Loader2, ArrowRight } from 'lucide-react';
import { trackNewsletter } from '../lib/analytics';
import {
  POPUP_DELAY_MS,
  shouldShowNewsletterPopup,
  snoozeNewsletterPopup,
  subscribeToNewsletter,
  suppressNewsletterPopupForever,
} from '../lib/newsletter';

/**
 * Newsletter-Popup auf der Startseite.
 *
 * Erscheint einmalig 60 Sekunden nach dem Öffnen der Startseite. Der Besucher
 * kann sich direkt anmelden, schliessen (Ruhezeit) oder "Nicht mehr anzeigen"
 * wählen — Letzteres wirkt auch bei späteren Besuchen (localStorage).
 *
 * Die Komponente wird nur gemountet, solange view === 'home' ist; der Timer
 * läuft also nicht weiter, wenn der Besucher die Startseite verlässt.
 */
export function NewsletterPopup({ delayMs = POPUP_DELAY_MS }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false); // steuert nur die Einblend-Animation
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | already | error
  const inputRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // 1. Timer: nach delayMs öffnen, sofern nicht unterdrückt.
  useEffect(() => {
    if (!shouldShowNewsletterPopup()) return undefined;

    const timer = setTimeout(() => {
      // Direkt vor dem Öffnen nochmals prüfen: der Besucher könnte sich in der
      // Zwischenzeit über das Footer-Formular in einem anderen Tab angemeldet haben.
      if (shouldShowNewsletterPopup()) setOpen(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  // 2. Beim Öffnen: Fokus setzen, Hintergrund-Scroll sperren, Einblenden starten.
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open]);

  const close = useCallback((mode) => {
    if (mode === 'never') {
      suppressNewsletterPopupForever();
    } else {
      snoozeNewsletterPopup();
    }
    setVisible(false);
    setOpen(false);
  }, []);

  // 3. Escape schliesst das Popup (Ruhezeit, nicht dauerhaft).
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close('snooze');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    const result = await subscribeToNewsletter(email);

    if (result.status === 'success' || result.status === 'already') {
      // Wer angemeldet ist, soll das Popup nie wieder sehen.
      suppressNewsletterPopupForever();
      if (result.status === 'success') trackNewsletter();
      setEmail('');
    }
    setStatus(result.status);
  };

  if (!open) return null;

  const isDone = status === 'success' || status === 'already';

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-dark/60 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={(e) => {
        // Klick auf den Hintergrund schliesst — Klicks im Dialog nicht.
        if (e.target === e.currentTarget) close('snooze');
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-popup-title"
        aria-describedby="newsletter-popup-text"
        className={`relative w-full max-w-md bg-dark rounded-2xl shadow-2xl overflow-hidden p-8 pt-10 transition-all duration-300 ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
        }`}
      >
        {/* Dekoration wie im Footer-Newsletter */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <button
          type="button"
          onClick={() => close('snooze')}
          aria-label="Popup schliessen"
          className="absolute top-3 right-3 z-10 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <h2 id="newsletter-popup-title" className="text-2xl font-bold text-white font-heading mb-2">
            Verpasse keinen spannenden Kurs
          </h2>
          <p id="newsletter-popup-text" className="text-gray-300 text-sm mb-6">
            Melde dich für unseren Newsletter an und erhalte handverlesene Kurs-Empfehlungen,
            exklusive Angebote und Neuigkeiten direkt in dein Postfach. Kostenlos und jederzeit
            abbestellbar.
          </p>

          {isDone ? (
            <div
              role="status"
              className={`px-4 py-3 rounded-xl flex items-center justify-center border ${
                status === 'success'
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'bg-blue-500/20 border-blue-500/50 text-blue-200'
              }`}
            >
              <Check className="w-5 h-5 mr-2 shrink-0" aria-hidden="true" />
              <span className="font-bold">
                {status === 'success'
                  ? 'Erfolgreich angemeldet!'
                  : 'Du bist bereits angemeldet.'}
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-grow">
                <Mail className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="email"
                  required
                  aria-label="E-Mail-Adresse für Newsletter"
                  placeholder="Deine E-Mail Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white/20 transition"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                aria-label="Newsletter abonnieren"
                className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition flex items-center disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {status === 'loading'
                  ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  : <ArrowRight className="w-5 h-5" aria-hidden="true" />}
              </button>
            </form>
          )}

          {status === 'error' && (
            <p role="alert" className="text-red-400 text-xs mt-2 ml-1">
              Hoppla, das hat nicht geklappt. Versuch es später noch einmal.
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-4 text-xs">
            <button
              type="button"
              onClick={() => close('snooze')}
              className="text-gray-400 hover:text-white underline underline-offset-2 transition"
            >
              {isDone ? 'Schliessen' : 'Vielleicht später'}
            </button>
            {!isDone && (
              <button
                type="button"
                onClick={() => close('never')}
                className="text-gray-400 hover:text-white underline underline-offset-2 transition"
              >
                Nicht mehr anzeigen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewsletterPopup;
