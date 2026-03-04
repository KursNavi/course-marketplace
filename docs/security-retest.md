# Security Retest (Admin/Auth/Checkout)

## Quick Run

```bash
RETEST_BASE_URL=https://kursnavi.ch npm run retest:security
```

Windows PowerShell:

```powershell
$env:RETEST_BASE_URL="https://kursnavi.ch"
npm run retest:security
```

## Optional Authenticated Checks

Für die vollen Checks (403 für Nicht-Admin, 200 für Admin) zusätzlich:

- `RETEST_USER_BEARER` = gültiger JWT eines normalen Users
- `RETEST_ADMIN_BEARER` = gültiger JWT eines Admin-Users

PowerShell Beispiel:

```powershell
$env:RETEST_BASE_URL="https://kursnavi.ch"
$env:RETEST_USER_BEARER="<user_jwt>"
$env:RETEST_ADMIN_BEARER="<admin_jwt>"
npm run retest:security
```

## Was geprüft wird

- `/api/admin` ohne Auth -> `401`
- Legacy `x-admin-secret` ohne JWT -> `401`
- `/api/admin/taxonomy` ohne Auth -> `401`
- `/api/admin` mit Nicht-Admin JWT -> `403` (wenn Token gesetzt)
- `/api/admin` mit Admin JWT -> `200` (wenn Token gesetzt)
- Checkout/Stripe-Management Endpunkte ohne JWT -> `401`
