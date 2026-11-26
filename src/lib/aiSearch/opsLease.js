/**
 * Laufsperre mit Besitznachweis für den Betriebsrunner (Entwurf
 * 20261121225750_ai_search_ops_lease_v2).
 *
 * Prinzip:
 *  - Kurze Frist (Standard 120 s), vor JEDEM Arbeitsschritt geprüft und bei
 *    Bedarf verlängert (gate). Ein Schritt beginnt nur, wenn die verbleibende
 *    Frist für seine längste Dauer (Anfrage-Timeout + Reserve) reicht.
 *  - Verlängerung verweigert (abgelaufen, übernommen, Abbruch angefordert)
 *    → LeaseLostError: kein weiterer Schreib- oder Modellschritt.
 *  - Zusätzlich prüft JEDE Schreibfunktion in der Datenbank die Sperre in
 *    derselben Transaktion (SQLSTATE KNL01). Selbst ein überlanger Schritt
 *    kann nach Ablauf also nichts mehr schreiben.
 *  - Die Uhr der Datenbank ist massgeblich: aus db_now wird ein Versatz zur
 *    lokalen Uhr berechnet.
 */

export const LEASE_DEFAULTS = Object.freeze({
  leaseSec: 120,
  // Verlängern, sobald weniger als so viel Frist übrig ist.
  renewBelowMs: 75_000,
  // Reserve für Uhrversatz/Netz zusätzlich zur Schrittdauer.
  safetyMs: 10_000,
});

export class LeaseLostError extends Error {
  constructor(status, message) {
    super(message ?? `Laufsperre verloren (${status}) – kein weiterer Schritt.`);
    this.name = 'LeaseLostError';
    this.status = status;
    this.leaseLost = true;
    this.exitCode = 4;
  }
}

/** Erkennt den Datenbankfehler „Sperre ungültig“ der geschützten Funktionen. */
export function isLeaseLostDbError(error) {
  if (!error) return false;
  return error.code === 'KNL01' || /ai_search_ops_lease_lost/.test(String(error.message ?? ''));
}

export class LeaseSession {
  /**
   * @param {object} client
   * @param {{runId: number, holder: string, leaseUntil?: string|null,
   *          dbNow?: string|null, leaseSec?: number, renewBelowMs?: number,
   *          safetyMs?: number, now?: () => number}} init
   */
  constructor(client, init) {
    this.client = client;
    this.runId = init.runId;
    this.holder = init.holder;
    this.leaseSec = init.leaseSec ?? LEASE_DEFAULTS.leaseSec;
    this.renewBelowMs = init.renewBelowMs ?? LEASE_DEFAULTS.renewBelowMs;
    this.safetyMs = init.safetyMs ?? LEASE_DEFAULTS.safetyMs;
    this.now = init.now ?? Date.now;
    this.offsetMs = 0;
    // Ohne Angabe vorsichtig: Frist gilt ab jetzt (lokal) – erste gate()
    // verlängert ohnehin, sobald die Schwelle unterschritten ist.
    this.leaseUntilMs = init.leaseUntil ? Date.parse(init.leaseUntil) : this.now() + this.leaseSec * 1000;
    if (init.dbNow) this.offsetMs = Date.parse(init.dbNow) - this.now();
    this.renewals = 0;
    this.capped = false;
    this.lost = null;
    this.stopRequested = null;
    this.gates = 0;
  }

  /** Verbleibende Frist laut Datenbankuhr (geschätzt). */
  remainingMs() {
    return this.leaseUntilMs - (this.now() + this.offsetMs);
  }

  /** Lokaler Abbruchwunsch (z. B. SIGTERM): nächster gate() stoppt. */
  requestStop(reason) {
    if (!this.stopRequested) this.stopRequested = String(reason ?? 'Abbruch angefordert');
  }

  async renew() {
    const { data, error } = await this.client.rpc('ai_search_ops_lease_renew', {
      p_run_id: this.runId, p_holder: this.holder, p_lease_seconds: this.leaseSec,
    });
    if (error) {
      // Verlängerung nicht prüfbar → wie Verlust behandeln (sicherer Halt).
      this.lost = 'renew_error';
      throw new LeaseLostError('renew_error', `Verlängerung nicht prüfbar: ${error.code ?? '-'} ${error.message}`);
    }
    const status = data?.status ?? 'unknown';
    if (status !== 'renewed') {
      this.lost = status;
      throw new LeaseLostError(status);
    }
    if (data.db_now) this.offsetMs = Date.parse(data.db_now) - this.now();
    if (data.lease_until) this.leaseUntilMs = Date.parse(data.lease_until);
    this.capped = data.capped === true;
    this.renewals += 1;
    return data;
  }

  /**
   * Vor jedem Arbeitsschritt aufrufen. stepMs = längste mögliche Dauer des
   * Schritts (z. B. Anfrage-Timeout). Startet den Schritt nur, wenn die
   * Frist danach noch mit Reserve gilt; sonst Verlängerung bzw. Halt.
   */
  async gate(stepMs = 0) {
    this.gates += 1;
    if (this.lost) throw new LeaseLostError(this.lost);
    if (this.stopRequested) {
      this.lost = 'aborted';
      throw new LeaseLostError('aborted', `Abbruch angefordert (${this.stopRequested}) – kein weiterer Schritt.`);
    }
    const needed = stepMs + this.safetyMs;
    if (this.remainingMs() < Math.max(needed, this.renewBelowMs)) {
      await this.renew();
    }
    if (this.remainingMs() < needed) {
      // Gesamtgrenze erreicht (Verlängerung gekappt): lieber aufhören als
      // einen Schritt beginnen, der die Frist überdauern könnte.
      this.lost = 'max_reached';
      throw new LeaseLostError('max_reached', 'Gesamtlaufzeit der Sperre erreicht – kein weiterer Schritt.');
    }
  }

  fence() {
    return { p_run_id: this.runId, p_holder: this.holder };
  }

  /** Abschluss; Rückgabe der Datenbank ('released'|'expired'|…). */
  async release(outcome, summary) {
    const { data, error } = await this.client.rpc('ai_search_ops_lease_release', {
      p_run_id: this.runId, p_holder: this.holder, p_outcome: outcome, p_summary: summary,
    });
    if (error) return { status: 'error', error: error.message };
    return { status: data ?? 'unknown' };
  }
}
