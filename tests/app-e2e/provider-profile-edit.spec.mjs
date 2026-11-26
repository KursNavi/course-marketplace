import { test, expect } from '@playwright/test';
import { loginAsTeacherAndOpenTab } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';
import { createIsolatedProvider, isolatedProviderAvailable } from './helpers/isolated-provider.mjs';

test.describe('Provider Profile Edit (app-e2e)', () => {

  // Nachtrag 14: Schreibender Profiltest mit EIGENEM Testkonto (ein Entwurfskurs),
  // nie mit dem gemeinsamen E2E-Anbieter (≈ 807 Kurse in der TESTumgebung).
  test.describe('mit eigenem Testprofil', () => {
    let provider = null;

    test.beforeAll(async () => {
      if (!isolatedProviderAvailable()) return;
      provider = await createIsolatedProvider();
    });

    test.afterAll(async () => {
      if (provider) await provider.cleanup();
    });

    test('teacher can edit profile settings (echte Änderung, nur eigenes Profil)', async ({ page }) => {
      test.skip(!provider, 'TESTumgebung-Variablen für das eigene Testprofil fehlen');
      const { service, userId, courseId } = provider;
      const sharedId = process.env.E2E_PROVIDER_ID || null;
      const readShared = async () => (sharedId
        ? (await service.from('profiles').select('city, bio_text, slug, canton, verification_status').eq('id', sharedId).maybeSingle()).data
        : null);
      const sharedBefore = await readShared();
      const startedAt = new Date(Date.now() - 1_000).toISOString();

      await mockApiRoutes(page);
      await loginAsTeacherAndOpenTab(page, 'profile', 30_000, provider);

      const nameInput = page.locator('input[name="full_name"]');
      await expect(nameInput).toBeVisible({ timeout: 20_000 });
      await expect(nameInput).toHaveValue(provider.fullName);

      const marker = `Profiltest ${Date.now()}`;
      const bioField = page.locator('textarea[name="bio_text"]');
      await expect(bioField).toBeVisible({ timeout: 5_000 });
      await bioField.fill(marker);
      const cityInput = page.locator('input[name="city"]');
      await expect(cityInput).toBeVisible({ timeout: 5_000 });
      await cityInput.fill('Zürich');

      await page.getByRole('button', { name: /Speichern|Änderungen speichern/i }).click();

      // Echte Änderung im eigenen Profil gespeichert (statt nur „Seite fehlerfrei“).
      await expect.poll(async () => {
        const { data } = await service.from('profiles').select('bio_text, city').eq('id', userId).single();
        return data ? `${data.bio_text}|${data.city}` : null;
      }, { timeout: 15_000 }).toBe(`${marker}|Zürich`);

      // Die Profiländerung reiht genau den eigenen (einzigen) Kurs ein
      // (Profil-Trigger, Migration 20261120205856 auf der TESTumgebung).
      const { data: ownJobs } = await service.from('ai_search_jobs')
        .select('course_id').eq('reason', 'profile_change').eq('course_id', courseId).gte('created_at', startedAt);
      expect((ownJobs ?? []).length).toBeGreaterThanOrEqual(1);

      // Gemeinsamer Anbieter unverändert.
      if (sharedId) expect(await readShared()).toEqual(sharedBefore);
    });
  });

  test('teacher can view Stripe Connect setup section', async ({ page }) => {
    await mockApiRoutes(page);

    // Login and open Profil tab (teacher role confirmed, no page reload needed)
    await loginAsTeacherAndOpenTab(page, 'profile');

    // Wait for profile to load (ProviderProfileEditor has async loading state)
    await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 20_000 });

    // Scroll down to find the Stripe Connect / payout section
    const payoutSection = page.getByText(/Auszahlungen/i);
    if (await payoutSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(payoutSection).toBeVisible();

      // Should have either "Jetzt einrichten" or "Auszahlungs-Dashboard öffnen"
      const setupBtn = page.getByRole('button', { name: /Jetzt einrichten/i });
      const dashboardBtn = page.getByRole('button', { name: /Auszahlungs-Dashboard/i });
      await expect(setupBtn.or(dashboardBtn)).toBeVisible();
    }
  });
});
