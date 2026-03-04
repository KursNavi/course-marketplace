# PR Scope (Dev Only, No Prod/Main Setup Changes)

Ziel: Nur Änderungen mergen, die Dev-Sicherheit/Dev-Operabilität verbessern, ohne Domain-/Routing-Setup (`main informational page`, `dev platform`) anzufassen.

## In Scope (empfohlen)

- `.gitignore`
- `api/admin.js`
- `api/create-checkout-session.js`
- `api/create-package-checkout.js`
- `api/create-capture-service-checkout.js`
- `api/stripe-management.js`
- `api/webhook.js`
- `api/provider.js`
- `src/App.jsx`
- `src/components/AdminPanel.jsx`
- `src/lib/adminConfig.js` (Delete)
- `package.json`
- `docs/security-retest.md`
- `docs/dev-release-checklist.md`
- `scripts/security-retest.mjs`
- `scripts/finalize-yoga-cleanup-dev.mjs`
- `scripts/apply-yoga-migrations.mjs`

## Out of Scope (nicht in diesen PR)

Nur mergen, wenn fachlich explizit gewollt:

- `api/dispute-booking.js`
- `api/refund-booking.js`
- `src/components/CategoryLocationPage.jsx`
- `src/components/Dashboard.jsx`
- `src/components/DetailView.jsx`
- `src/components/ProviderProfileEditor.jsx`
- `src/components/TeacherForm.jsx`
- `tests/refund-logic.test.mjs`

## Sauberer Add-Flow

```bash
git add .gitignore package.json
git add api/admin.js api/create-checkout-session.js api/create-package-checkout.js api/create-capture-service-checkout.js api/stripe-management.js api/webhook.js api/provider.js
git add src/App.jsx src/components/AdminPanel.jsx
git add docs/security-retest.md docs/dev-release-checklist.md
git add scripts/security-retest.mjs scripts/finalize-yoga-cleanup-dev.mjs scripts/apply-yoga-migrations.mjs
git add -u src/lib/adminConfig.js
```

Dann prüfen:

```bash
git status --short
git diff --cached --name-only
```

## Guardrail

- Kein `vercel --prod`
- Keine Änderungen an `vercel.json`/Domain-Aliases in diesem PR
