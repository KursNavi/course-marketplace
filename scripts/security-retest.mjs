#!/usr/bin/env node
/* eslint-disable no-console */

const BASE_URL = (process.env.RETEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_BEARER = process.env.RETEST_ADMIN_BEARER || '';
const USER_BEARER = process.env.RETEST_USER_BEARER || '';

function headerForToken(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function http(method, path, { headers = {}, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, ok: res.ok, json };
}

const checks = [
  {
    id: 'admin-no-auth',
    title: 'Admin API ohne Auth blockiert',
    run: () => http('GET', '/api/admin?action=profiles&limit=1'),
    expect: (r) => r.status === 401,
  },
  {
    id: 'admin-secret-header-ignored',
    title: 'Legacy x-admin-secret reicht nicht mehr',
    run: () => http('GET', '/api/admin?action=profiles&limit=1', {
      headers: { 'x-admin-secret': 'KursNavi2025!' },
    }),
    expect: (r) => r.status === 401,
  },
  {
    id: 'taxonomy-no-auth',
    title: 'Taxonomy Admin API ohne Auth blockiert',
    run: () => http('GET', '/api/admin/taxonomy'),
    expect: (r) => r.status === 401,
  },
  {
    id: 'admin-user-forbidden',
    title: 'Nicht-Admin mit JWT erhält 403',
    skip: !USER_BEARER,
    run: () => http('GET', '/api/admin?action=profiles&limit=1', {
      headers: headerForToken(USER_BEARER),
    }),
    expect: (r) => r.status === 403,
  },
  {
    id: 'admin-admin-allowed',
    title: 'Admin mit JWT erhält 200',
    skip: !ADMIN_BEARER,
    run: () => http('GET', '/api/admin?action=profiles&limit=1', {
      headers: headerForToken(ADMIN_BEARER),
    }),
    expect: (r) => r.status === 200,
  },
  {
    id: 'stripe-mgmt-no-auth',
    title: 'Stripe-Management ohne JWT blockiert',
    run: () => http('POST', '/api/stripe-management', {
      body: { action: 'check_connect_status' },
    }),
    expect: (r) => r.status === 401,
  },
  {
    id: 'package-checkout-no-auth',
    title: 'Package-Checkout ohne JWT blockiert',
    run: () => http('POST', '/api/create-package-checkout', {
      body: { targetTier: 'pro' },
    }),
    expect: (r) => r.status === 401,
  },
  {
    id: 'capture-checkout-no-auth',
    title: 'Capture-Checkout ohne JWT blockiert',
    run: () => http('POST', '/api/create-capture-service-checkout', {
      body: { courses: [{ url: 'https://example.com/course-a' }] },
    }),
    expect: (r) => r.status === 401,
  },
  {
    id: 'course-checkout-no-auth',
    title: 'Course-Checkout ohne JWT blockiert',
    run: () => http('POST', '/api/create-checkout-session', {
      body: { courseId: 1 },
    }),
    expect: (r) => r.status === 401,
  },
];

async function main() {
  console.log(`Security Retest against ${BASE_URL}`);
  const results = [];

  for (const check of checks) {
    if (check.skip) {
      console.log(`- SKIP ${check.id}: ${check.title}`);
      results.push({ ...check, skipped: true, pass: true });
      continue;
    }

    try {
      const response = await check.run();
      const pass = check.expect(response);
      results.push({ ...check, response, pass, skipped: false });
      console.log(`${pass ? 'PASS' : 'FAIL'} ${check.id} -> status ${response.status}`);
      if (!pass && response.json) {
        console.log(`  response: ${JSON.stringify(response.json)}`);
      }
    } catch (err) {
      results.push({ ...check, pass: false, skipped: false, error: err.message });
      console.log(`FAIL ${check.id} -> ${err.message}`);
    }
  }

  const failed = results.filter((r) => !r.pass);
  const skipped = results.filter((r) => r.skipped).length;
  const passed = results.filter((r) => r.pass && !r.skipped).length;
  console.log(`\nSummary: passed=${passed} failed=${failed.length} skipped=${skipped}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
