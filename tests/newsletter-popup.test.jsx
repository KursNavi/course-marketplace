import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

import { NewsletterPopup } from '../src/components/NewsletterPopup';
import {
  NEWSLETTER_POPUP_STORAGE_KEY,
  POPUP_DELAY_MS,
  SNOOZE_DAYS,
  isConsentBannerOpen,
  shouldShowNewsletterPopup,
  snoozeNewsletterPopup,
  suppressNewsletterPopupForever,
  isAlreadySubscribed,
  subscribeToNewsletter,
} from '../src/lib/newsletter';

// Bewusst als feste Zahl, nicht aus der Quelle übernommen: so fällt ein
// versehentlich geänderter Wert im Test auf, statt stillschweigend mitzuwandern.
const DELAY = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function mockFetchResponse({ ok = true, status = 200, body = { success: true } } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(body),
  });
}

/** Timer bis kurz nach der 30-Sekunden-Marke vorspulen. */
async function advancePastDelay() {
  await act(async () => {
    vi.advanceTimersByTime(DELAY + 10);
  });
}

/**
 * Cookiebot nachbauen: ein sichtbarer Dialog mit der echten ID.
 * jsdom rechnet kein Layout, deshalb wird die Höhe direkt gemeldet.
 */
function mountCookieBanner() {
  const el = document.createElement('div');
  el.id = 'CybotCookiebotDialog';
  el.getBoundingClientRect = () => ({ height: 400, width: 800, top: 0, left: 0, bottom: 400, right: 800 });
  document.body.appendChild(el);
  return () => el.remove();
}

function typeEmail(value) {
  fireEvent.change(screen.getByLabelText('E-Mail-Adresse für Newsletter'), {
    target: { value },
  });
}

function submitForm() {
  return act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Newsletter abonnieren' }).closest('form'));
  });
}

describe('Newsletter-Popup — Sichtbarkeit über Besuche hinweg', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('wartet 30 Sekunden — die vereinbarte Wartezeit', () => {
    expect(POPUP_DELAY_MS).toBe(DELAY);
  });

  it('zeigt das Popup bei einem frischen Besucher', () => {
    expect(shouldShowNewsletterPopup()).toBe(true);
  });

  it('unterdrückt das Popup dauerhaft nach "Nicht mehr anzeigen"', () => {
    suppressNewsletterPopupForever();
    expect(window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY)).toBe('never');

    // Auch weit in der Zukunft (= späterer Besuch) bleibt es unterdrückt.
    expect(shouldShowNewsletterPopup(Date.now() + 3650 * DAY_MS)).toBe(false);
  });

  it('lässt das Popup nach einfachem Schliessen ruhen und danach wieder zu', () => {
    const now = Date.UTC(2026, 0, 1);
    snoozeNewsletterPopup(now);

    expect(shouldShowNewsletterPopup(now + 1000)).toBe(false);
    expect(shouldShowNewsletterPopup(now + (SNOOZE_DAYS - 1) * DAY_MS)).toBe(false);
    expect(shouldShowNewsletterPopup(now + (SNOOZE_DAYS + 1) * DAY_MS)).toBe(true);
  });

  it('behandelt einen kaputten Storage-Wert wie "noch nie gesehen"', () => {
    window.localStorage.setItem(NEWSLETTER_POPUP_STORAGE_KEY, 'kaputt');
    expect(shouldShowNewsletterPopup()).toBe(true);
  });
});

describe('Newsletter-Popup — Rücksicht auf den Cookie-Hinweis', () => {
  afterEach(() => {
    document.getElementById('CybotCookiebotDialog')?.remove();
    delete window.Cookiebot;
  });

  it('meldet "kein Banner", wenn Cookiebot gar nicht geladen ist (Vorschau, lokal)', () => {
    expect(isConsentBannerOpen()).toBe(false);
  });

  it('erkennt den sichtbaren Cookiebot-Dialog', () => {
    mountCookieBanner();
    expect(isConsentBannerOpen()).toBe(true);
  });

  it('ignoriert einen ausgeblendeten Cookiebot-Dialog', () => {
    const el = document.createElement('div');
    el.id = 'CybotCookiebotDialog';
    el.style.display = 'none';
    document.body.appendChild(el);
    expect(isConsentBannerOpen()).toBe(false);
  });

  // Regression: Cookiebot lädt auf JEDER Domain und meldet dort
  // hasResponse:false, zeigt sein Banner aber nur auf freigeschalteten Domains.
  // Wer sich auf hasResponse verlässt, blockiert das Popup auf Vorschau-Adressen
  // und lokal dauerhaft — obwohl gar nichts zu sehen ist.
  it('blockiert nicht, wenn Cookiebot geladen ist, aber kein Banner zeigt', () => {
    window.Cookiebot = { hasResponse: false };
    expect(isConsentBannerOpen()).toBe(false);
  });

  it('blockiert, sobald ein sichtbares Banner da ist — unabhängig von hasResponse', () => {
    window.Cookiebot = { hasResponse: true };
    mountCookieBanner();
    expect(isConsentBannerOpen()).toBe(true);
  });
});

describe('Newsletter — Duplikat-Erkennung', () => {
  it.each([
    [409, {}],
    [200, { already: true }],
    [400, { code: 'duplicate_parameter' }],
    [400, { message: 'Contact already exist' }],
    [400, { message: 'Du bist bereits angemeldet' }],
    [500, { code: '23505' }],
  ])('erkennt Status %i als "bereits angemeldet"', (status, payload) => {
    expect(isAlreadySubscribed(status, payload)).toBe(true);
  });

  it('meldet einen echten Fehler nicht als Duplikat', () => {
    expect(isAlreadySubscribed(500, { message: 'Server Error' })).toBe(false);
  });
});

describe('Newsletter — subscribeToNewsletter (auch vom Footer-Formular genutzt)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('liefert success bei einer erfolgreichen Anmeldung', async () => {
    vi.stubGlobal('fetch', mockFetchResponse());
    await expect(subscribeToNewsletter('a@b.ch')).resolves.toEqual({ status: 'success' });
  });

  it('liefert already, wenn der Kontakt schon existiert', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({
      ok: false,
      status: 400,
      body: { code: 'duplicate_parameter' },
    }));
    await expect(subscribeToNewsletter('a@b.ch')).resolves.toEqual({ status: 'already' });
  });

  it('liefert error, wenn die Antwort kein JSON ist (z. B. 404-HTML)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '<!doctype html><html></html>',
    }));
    await expect(subscribeToNewsletter('a@b.ch')).resolves.toEqual({ status: 'error' });
  });

  it('liefert error bei einem Netzwerkfehler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(subscribeToNewsletter('a@b.ch')).resolves.toEqual({ status: 'error' });
  });
});

describe('Newsletter-Popup — Komponente', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('erscheint nicht sofort, sondern erst nach 30 Sekunden', async () => {
    render(<NewsletterPopup />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(DELAY - 1000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    await advancePastDelay();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('wartet, solange der Cookie-Hinweis offen ist, und öffnet danach', async () => {
    const removeBanner = mountCookieBanner();
    render(<NewsletterPopup />);

    // Wartezeit ist um — aber der Cookie-Hinweis liegt noch über der Seite.
    await advancePastDelay();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Auch deutlich später bleibt es zu, solange das Banner steht.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // Besucher beantwortet den Cookie-Hinweis.
    removeBanner();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lässt das Warten auf den Cookie-Hinweis beim Verlassen der Seite fallen', async () => {
    mountCookieBanner();
    const { unmount } = render(<NewsletterPopup />);

    await advancePastDelay();
    unmount();

    // Banner verschwindet erst nach dem Verlassen — es darf nichts mehr aufgehen.
    document.getElementById('CybotCookiebotDialog').remove();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('erscheint gar nicht, wenn der Besucher "Nicht mehr anzeigen" gewählt hat', async () => {
    suppressNewsletterPopupForever();
    render(<NewsletterPopup />);

    await advancePastDelay();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('merkt sich "Nicht mehr anzeigen" dauerhaft', async () => {
    render(<NewsletterPopup />);
    await advancePastDelay();

    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr anzeigen' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY)).toBe('never');
    expect(shouldShowNewsletterPopup()).toBe(false);
  });

  it('setzt beim einfachen Schliessen nur eine Ruhezeit, keine Dauersperre', async () => {
    render(<NewsletterPopup />);
    await advancePastDelay();

    fireEvent.click(screen.getByRole('button', { name: 'Popup schliessen' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    const stored = window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY);
    expect(stored).not.toBe('never');
    expect(Number(stored)).toBeGreaterThan(Date.now());
  });

  it('meldet die E-Mail an, bestätigt und unterdrückt das Popup danach dauerhaft', async () => {
    const fetchMock = mockFetchResponse();
    vi.stubGlobal('fetch', fetchMock);

    render(<NewsletterPopup />);
    await advancePastDelay();

    typeEmail('test@kursnavi.ch');
    await submitForm();

    await waitFor(() => {
      expect(screen.getByText('Erfolgreich angemeldet!')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/subscribe', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'test@kursnavi.ch' }),
    }));
    expect(window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY)).toBe('never');
  });

  it('zeigt eine freundliche Meldung, wenn die Adresse bereits angemeldet ist', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ body: { success: true, already: true } }));

    render(<NewsletterPopup />);
    await advancePastDelay();

    typeEmail('test@kursnavi.ch');
    await submitForm();

    await waitFor(() => {
      expect(screen.getByText('Du bist bereits angemeldet.')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY)).toBe('never');
  });

  it('zeigt bei einem Serverfehler eine Fehlermeldung und sperrt das Popup nicht', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', mockFetchResponse({ ok: false, status: 500, body: { error: 'Server Error' } }));

    render(<NewsletterPopup />);
    await advancePastDelay();

    typeEmail('test@kursnavi.ch');
    await submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/nicht geklappt/i);
    });
    expect(window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY)).toBeNull();
  });

  it('schliesst bei Escape', async () => {
    render(<NewsletterPopup />);
    await advancePastDelay();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('gibt den Seiten-Scroll beim Schliessen wieder frei', async () => {
    render(<NewsletterPopup />);
    await advancePastDelay();

    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Popup schliessen' }));
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('startet keinen Timer mehr, wenn die Startseite vor Ablauf verlassen wird', async () => {
    const { unmount } = render(<NewsletterPopup />);
    unmount();

    await advancePastDelay();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
