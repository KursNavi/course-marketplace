# Briefing: Anbieter-Analytics Dashboard

## Ziel

Erweiterung des bestehenden Anbieter-Dashboards um ein Analytics-Modul mit Zeitverläufen, Kurs-Performance-Vergleich und actionable Insights. Das Feature ist gestaffelt nach Abo-Tier.

### Tier-Staffelung

| Feature | Basic | Pro | Premium / Enterprise |
|---------|-------|-----|----------------------|
| Totals letzte 12 Monate (Buchungen, Einnahmen, Kurse) | ✅ | ✅ | ✅ |
| Zeitverläufe (Monats-Charts) | ❌ | ✅ | ✅ |
| Kurs-Performance-Tabelle (sortierbar) | ❌ | ✅ | ✅ |
| Kurs-Vergleich (Side-by-Side) | ❌ | ❌ | ✅ |
| Empfehlungen & erweiterte Insights | ❌ | ❌ | ✅ |

---

## 1. Existierende Architektur

### Tech Stack
- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth) + Vercel Serverless Functions
- **Payments**: Stripe (Buchungen + Connect-Payouts)
- **Kein Router-Package**: Navigation über `window.history.pushState` + State (`view`/`dashView`)

### Dashboard-Struktur (`src/components/Dashboard.jsx`)

Das Dashboard ist ein Tab-basierter View innerhalb des Haupt-`App.jsx`:

```
Dashboard (props: user, courses, teacherEarnings, myBookings, ...)
├── Tab: "Übersicht" (dashView='overview')  ← HIER Analytics einbauen
│   ├── Plan-Status-Card (dark bg, zeigt Tier + Kurszahl)
│   ├── Service-Upsell-Card
│   ├── Stats Grid (3 Karten: Einnahmen, Buchungen, Kurse)
│   ├── Buchungs-Historie Tabelle
│   ├── Prio-Kurse Management
│   └── Kurse-Tabelle mit Aktionen
├── Tab: "Profil" (dashView='profile')
│   └── ProviderProfileEditor
└── Tab: "Abo" (dashView='subscription')
    └── SubscriptionSection (4-Tier Vergleichskarten)
```

**Dashboard Props** (von App.jsx übergeben):
```javascript
const Dashboard = ({
  user,              // { id, email, role, name, plan_tier }
  setUser,
  t,                 // Translation object
  setView,           // Navigation: setView('detail') etc.
  courses,           // ALLE Kurse der Plattform (Dashboard filtert nach user_id)
  teacherEarnings,   // Array: [{ id, courseTitle, studentName, price, payout, isPaidOut, date }]
  myBookings,        // Eigene Buchungen (als Student)
  savedCourses,
  savedCourseIds,
  onToggleSaveCourse,
  handleDeleteCourse,
  handleEditCourse,
  handleUpdateCourseStatus,
  showNotification,
  changeLanguage,
  setSelectedCourse,
  refreshBookings
}) => { ... }
```

**Interner State**:
```javascript
const [dashView, setDashView] = useState('overview'); // 'overview' | 'profile' | 'subscription'
const [userTier, setUserTier] = useState('basic');
```

### Datenfluss: teacherEarnings

Die Buchungsdaten werden in `App.jsx` geladen (Zeile ~714):

```javascript
// src/App.jsx - fetchTeacherEarnings()
const fetchTeacherEarnings = async (userId) => {
  // 1. Alle Kurse des Anbieters laden
  const { data: myCourses } = await supabase
    .from('courses')
    .select('id, title, price')
    .eq('user_id', userId);

  // 2. Alle Buchungen für diese Kurse laden
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, course_id, created_at, is_paid, profiles(full_name)')
    .in('course_id', courseIds);

  // 3. Mapping zu teacherEarnings Array
  setTeacherEarnings(bookings.map(booking => ({
    id: booking.id,
    courseTitle: course?.title || 'Unknown',
    studentName: booking.profiles?.full_name || 'Guest Student',
    price: course?.price || 0,
    payout: (course?.price || 0) * 0.85,  // ACHTUNG: Hardcoded 85% (15% Komm.)
    isPaidOut: booking.is_paid,
    date: new Date(booking.created_at).toLocaleDateString()
  })));
};
```

**Bekanntes Problem**: Die Payout-Berechnung nutzt hardcoded `0.85` statt den tatsächlichen Tier-basierten Kommissionssatz. Die echten Werte stehen in der `bookings`-Tabelle als `commission_percent` und `net_amount_cents`.

### Entitlements-System (`src/lib/entitlements.js`)

```javascript
export const TIER_ORDER = ['basic', 'pro', 'premium', 'enterprise'];

// Relevante Funktionen:
parseTier(raw)              // Normalisiert Tier-String → 'basic'|'pro'|'premium'|'enterprise'
isAtLeastTier(tier, min)    // Prüft ob tier >= min
getTierLabel(tier)          // 'Pro', 'Premium', etc.
getCommissionPercent(tier)  // basic=15, pro=12, premium=10, enterprise=8
getCourseLimit(tier)        // basic=3, pro=10, premium=30, enterprise=9999
getAllEntitlements(tier)     // Gibt alle Entitlements als Objekt zurück
```

**Neue Entitlement-Funktionen hinzufügen** (für Analytics):
```javascript
// VORSCHLAG - in entitlements.js ergänzen:
export function hasAnalyticsCharts(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

export function hasAnalyticsInsights(tier) {
  return ['premium', 'enterprise'].includes(parseTier(tier));
}
```

### Plan-Definitionen (`src/constants/plans.js`)

```javascript
export const PLANS = [
  { id: "basic",      priceAnnualCHF: 0,    commissionPct: 15, maxPrioCourses: 0     },
  { id: "pro",        priceAnnualCHF: 290,  commissionPct: 12, maxPrioCourses: 5     },
  { id: "premium",    priceAnnualCHF: 690,  commissionPct: 10, maxPrioCourses: 15    },
  { id: "enterprise", priceAnnualCHF: 1490, commissionPct: 8,  maxPrioCourses: Infinity }
];
```

### API-Pattern (`api/provider.js`)

Alle API-Endpunkte nutzen action-based Routing:

```javascript
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const action = req.query.action || req.body?.action;

  if (action === 'profile') { /* GET */ }
  if (action === 'directory') { /* GET */ }
  if (action === 'validate-slug') { /* POST */ }
}
```

### Supabase Client (`src/lib/supabase.js`)

```javascript
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Preisformatierung (`src/lib/formatPrice.js`)

```javascript
formatPriceCHF(price) // "1'234.50" (Schweizer Format)
```

---

## 2. Existierendes Datenmodell

### Tabelle: `courses`
```
id (UUID), user_id (UUID), title, description, price (NUMERIC),
category_type, category_area, category_specialty, category_focus,
canton, city, delivery_type (ARRAY), language (ARRAY),
booking_type ('platform'|'platform_flex'|'lead'),
status ('draft'|'published'|null), is_prio (BOOLEAN),
image_url, created_at, updated_at
```

### Tabelle: `bookings`
```
id (UUID), course_id (UUID), event_id (UUID nullable),
student_id (UUID), student_email, student_name,
booking_type ('platform'|'platform_flex'|'lead'),
status ('pending'|'completed'|'refunded'),
stripe_payment_intent_id, amount_cents (INT),
commission_percent (INT), net_amount_cents (INT),
is_paid (BOOLEAN), paid_at (TIMESTAMPTZ),
auto_refund_until (TIMESTAMPTZ), created_at
```

### Tabelle: `profiles`
```
id (UUID), full_name, email, role ('teacher'|'student'),
package_tier ('basic'|'pro'|'premium'|'enterprise'),
slug, city, canton, ...
```

### Tabelle: `course_events`
```
id (UUID), course_id (UUID), canton, location,
max_participants (INT), start_date, end_date
```

---

## 3. Neue Datenbank-Tabelle: `course_views`

Für View-Tracking (Impressions + Detail-Views) wird eine neue Tabelle benötigt:

```sql
-- Migration: supabase/migrations/YYYYMMDD_create_course_views.sql
CREATE TABLE IF NOT EXISTS course_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL CHECK (view_type IN ('impression', 'detail')),
  viewer_id UUID,  -- NULL für anonyme Besucher
  source TEXT DEFAULT 'search',  -- 'search', 'category', 'home', 'direct', 'provider_profile'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes für Performance
CREATE INDEX idx_course_views_course_id ON course_views(course_id);
CREATE INDEX idx_course_views_created_at ON course_views(created_at);
CREATE INDEX idx_course_views_course_date ON course_views(course_id, created_at);

-- RLS: Jeder kann Views erstellen (auch anonym), aber nur Kursbesitzer können lesen
ALTER TABLE course_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views"
  ON course_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Course owners can read their views"
  ON course_views FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );
```

### Aggregierte View: `course_analytics_monthly` (Performance)

Für schnelle Abfragen eine materialized View oder eine einfache DB-Funktion:

```sql
-- RPC-Funktion für Analytics-Daten eines Anbieters
CREATE OR REPLACE FUNCTION get_provider_analytics(provider_id UUID, months_back INT DEFAULT 12)
RETURNS TABLE (
  month TEXT,
  total_bookings BIGINT,
  total_revenue_cents BIGINT,
  total_net_cents BIGINT,
  total_views BIGINT,
  total_detail_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT generate_series(
      date_trunc('month', now() - (months_back || ' months')::interval),
      date_trunc('month', now()),
      '1 month'::interval
    ) AS month_start
  ),
  monthly_bookings AS (
    SELECT
      date_trunc('month', b.created_at) AS m,
      COUNT(*) AS bookings,
      COALESCE(SUM(b.amount_cents), 0) AS revenue,
      COALESCE(SUM(b.net_amount_cents), 0) AS net
    FROM bookings b
    JOIN courses c ON c.id = b.course_id
    WHERE c.user_id = provider_id
      AND b.created_at >= now() - (months_back || ' months')::interval
      AND b.status != 'refunded'
    GROUP BY date_trunc('month', b.created_at)
  ),
  monthly_views AS (
    SELECT
      date_trunc('month', v.created_at) AS m,
      COUNT(*) FILTER (WHERE v.view_type = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE v.view_type = 'detail') AS details
    FROM course_views v
    JOIN courses c ON c.id = v.course_id
    WHERE c.user_id = provider_id
      AND v.created_at >= now() - (months_back || ' months')::interval
    GROUP BY date_trunc('month', v.created_at)
  )
  SELECT
    to_char(dr.month_start, 'YYYY-MM') AS month,
    COALESCE(mb.bookings, 0),
    COALESCE(mb.revenue, 0),
    COALESCE(mb.net, 0),
    COALESCE(mv.impressions, 0),
    COALESCE(mv.details, 0)
  FROM date_range dr
  LEFT JOIN monthly_bookings mb ON mb.m = dr.month_start
  LEFT JOIN monthly_views mv ON mv.m = dr.month_start
  ORDER BY dr.month_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Kurs-Performance RPC:

```sql
CREATE OR REPLACE FUNCTION get_course_performance(provider_id UUID, months_back INT DEFAULT 12)
RETURNS TABLE (
  course_id UUID,
  course_title TEXT,
  total_bookings BIGINT,
  total_revenue_cents BIGINT,
  total_views BIGINT,
  total_detail_views BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    COUNT(DISTINCT b.id) AS total_bookings,
    COALESCE(SUM(b.amount_cents), 0) AS total_revenue_cents,
    COUNT(DISTINCT v_imp.id) AS total_views,
    COUNT(DISTINCT v_det.id) AS total_detail_views,
    CASE
      WHEN COUNT(DISTINCT v_det.id) > 0
      THEN ROUND(COUNT(DISTINCT b.id)::numeric / COUNT(DISTINCT v_det.id) * 100, 1)
      ELSE 0
    END AS conversion_rate
  FROM courses c
  LEFT JOIN bookings b ON b.course_id = c.id
    AND b.created_at >= now() - (months_back || ' months')::interval
    AND b.status != 'refunded'
  LEFT JOIN course_views v_imp ON v_imp.course_id = c.id
    AND v_imp.view_type = 'impression'
    AND v_imp.created_at >= now() - (months_back || ' months')::interval
  LEFT JOIN course_views v_det ON v_det.course_id = c.id
    AND v_det.view_type = 'detail'
    AND v_det.created_at >= now() - (months_back || ' months')::interval
  WHERE c.user_id = provider_id
    AND (c.status = 'published' OR c.status IS NULL)
  GROUP BY c.id, c.title
  ORDER BY total_bookings DESC, total_revenue_cents DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. View-Tracking implementieren

### 4a. Impressions tracken (`src/components/SearchPageView.jsx`)

Wenn Kurskarten in den Suchergebnissen gerendert werden, eine Impression loggen. Nutze IntersectionObserver oder einfaches On-Render:

```javascript
// Beim Rendern einer Kurskarte (throttled, max 1x pro Kurs pro Session)
const trackImpression = async (courseId) => {
  const key = `imp_${courseId}`;
  if (sessionStorage.getItem(key)) return; // Schon getrackt
  sessionStorage.setItem(key, '1');

  await supabase.from('course_views').insert({
    course_id: courseId,
    view_type: 'impression',
    viewer_id: user?.id || null,
    source: 'search'
  });
};
```

### 4b. Detail-Views tracken (`src/components/DetailView.jsx`)

```javascript
// Im useEffect der DetailView Komponente
useEffect(() => {
  if (!course?.id) return;
  const key = `det_${course.id}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');

  supabase.from('course_views').insert({
    course_id: course.id,
    view_type: 'detail',
    viewer_id: user?.id || null,
    source: document.referrer.includes('/search') ? 'search' : 'direct'
  });
}, [course?.id]);
```

---

## 5. UI-Spezifikation: Analytics Tab

### Neuer Tab im Dashboard

Füge einen neuen Tab `"analytics"` zum bestehenden Tab-System hinzu:

```javascript
// In Dashboard.jsx - Tab-Leiste erweitern
<button onClick={() => setDashView('analytics')}
  className={`px-4 py-2 rounded-full text-sm font-bold transition
    ${dashView === 'analytics' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
  Analytics
</button>
```

### Neue Komponente: `AnalyticsDashboard`

Erstelle `src/components/AnalyticsDashboard.jsx`:

```
AnalyticsDashboard (props: user, userTier, courses, teacherEarnings)
├── [ALLE TIERS] Summary Cards (letzte 12 Monate)
│   ├── Buchungen (12 Mo.)
│   ├── Einnahmen Brutto (12 Mo.)
│   ├── Einnahmen Netto (12 Mo.)
│   ├── Kursaufrufe (12 Mo.)
│   └── Conversion Rate (Detail→Buchung)
│
├── [PRO+] Zeitverläufe Section
│   ├── Buchungen pro Monat (Bar-Chart)
│   ├── Einnahmen pro Monat (Line-Chart)
│   └── Views pro Monat (Line-Chart)
│   └── Dropdown: Zeitraum wählen (3Mo/6Mo/12Mo)
│
├── [PRO+] Kurs-Performance Tabelle
│   ├── Spalten: Kurs | Views | Detail-Views | Buchungen | Umsatz | Conv.Rate
│   ├── Sortierbar nach jeder Spalte
│   └── Status-Badge (published/draft/paused)
│
├── [PREMIUM+] Kurs-Vergleich
│   ├── 2-3 Kurse auswählen und nebeneinander vergleichen
│   └── Metriken: Views, Buchungen, Umsatz, Conversion
│
├── [PREMIUM+] Insights & Empfehlungen
│   ├── "Dein bestperformender Kurs ist X"
│   ├── "Kurs Y hat viele Views aber wenige Buchungen - Preis anpassen?"
│   ├── "Du hast noch N Prio-Slots frei"
│   └── "Kurse mit Bildern erhalten X% mehr Klicks"
│
└── [ALLE TIERS] Upgrade-Teaser (wenn nicht Premium+)
    └── "Schalte erweiterte Analytics frei mit Pro/Premium"
```

### Charts: Reine CSS/SVG-Lösung (keine Library)

Um Abhängigkeiten minimal zu halten, nutze einfache CSS-Bars und SVG-Linien:

```javascript
// Einfacher Bar-Chart mit CSS
const BarChart = ({ data, maxValue }) => (
  <div className="flex items-end gap-1 h-40">
    {data.map((item, i) => (
      <div key={i} className="flex-1 flex flex-col items-center">
        <div
          className="w-full bg-primary rounded-t transition-all"
          style={{ height: `${(item.value / maxValue) * 100}%` }}
        />
        <span className="text-[10px] text-gray-400 mt-1">{item.label}</span>
      </div>
    ))}
  </div>
);
```

### Locked-Feature UI-Pattern

Für gesperrte Features (z.B. Charts bei Basic):
```javascript
{isAtLeastTier(userTier, 'pro') ? (
  <MonthlyChart data={monthlyData} />
) : (
  <div className="relative">
    <div className="filter blur-sm pointer-events-none opacity-50">
      <MonthlyChart data={demoData} />  {/* Platzhalter mit Fake-Daten */}
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow-lg text-center">
        <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="font-bold">Zeitverläufe ab Pro</p>
        <button onClick={() => setDashView('subscription')}
          className="mt-2 text-primary font-bold text-sm">
          Jetzt upgraden
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 6. Daten laden

### Option A: Direkt im Frontend (empfohlen für MVP)

Die Analytics-Daten können direkt im Frontend via Supabase RPC geladen werden:

```javascript
// In AnalyticsDashboard.jsx
useEffect(() => {
  if (!user?.id) return;

  const loadAnalytics = async () => {
    setLoading(true);

    // 1. Monatliche Aggregate
    const { data: monthly } = await supabase.rpc('get_provider_analytics', {
      provider_id: user.id,
      months_back: 12
    });

    // 2. Kurs-Performance (nur Pro+)
    let coursePerf = [];
    if (isAtLeastTier(userTier, 'pro')) {
      const { data } = await supabase.rpc('get_course_performance', {
        provider_id: user.id,
        months_back: 12
      });
      coursePerf = data || [];
    }

    setMonthlyData(monthly || []);
    setCoursePerformance(coursePerf);
    setLoading(false);
  };

  loadAnalytics();
}, [user?.id, userTier]);
```

### Option B: API-Endpunkt (für Caching / spätere Erweiterung)

Falls Performance ein Problem wird, einen API-Endpunkt hinzufügen:

```javascript
// api/analytics.js
export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const action = req.query.action || req.body?.action;

  // Auth prüfen
  const authHeader = req.headers.authorization;
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (action === 'monthly') {
    const { data } = await supabase.rpc('get_provider_analytics', {
      provider_id: user.id, months_back: parseInt(req.query.months) || 12
    });
    return res.json({ data });
  }

  if (action === 'course-performance') {
    const { data } = await supabase.rpc('get_course_performance', {
      provider_id: user.id, months_back: parseInt(req.query.months) || 12
    });
    return res.json({ data });
  }
}
```

---

## 7. Entitlements erweitern

In `src/lib/entitlements.js` hinzufügen:

```javascript
/**
 * Check if tier has access to analytics time series charts
 * Pro+ required
 */
export function hasAnalyticsCharts(tier) {
  return ['pro', 'premium', 'enterprise'].includes(parseTier(tier));
}

/**
 * Check if tier has access to advanced analytics insights
 * Premium+ required
 */
export function hasAnalyticsInsights(tier) {
  return ['premium', 'enterprise'].includes(parseTier(tier));
}
```

Auch in `getAllEntitlements()` ergänzen:
```javascript
hasAnalyticsCharts: hasAnalyticsCharts(t),
hasAnalyticsInsights: hasAnalyticsInsights(t),
```

---

## 8. Implementierungsreihenfolge

### Schritt 1: Datenbank
1. Migration erstellen: `supabase/migrations/YYYYMMDD_create_course_views.sql`
2. Migration erstellen: `supabase/migrations/YYYYMMDD_add_analytics_functions.sql`
3. Beide Funktionen (`get_provider_analytics`, `get_course_performance`) deployen

### Schritt 2: View-Tracking
1. In `src/components/DetailView.jsx`: Detail-View-Tracking im useEffect hinzufügen
2. In `src/components/SearchPageView.jsx` (oder wo Kurskarten gerendert werden): Impression-Tracking
3. Session-basiertes Deduplication via `sessionStorage`

### Schritt 3: Entitlements
1. `hasAnalyticsCharts()` und `hasAnalyticsInsights()` in `src/lib/entitlements.js` hinzufügen
2. `getAllEntitlements()` erweitern

### Schritt 4: Analytics-Komponente
1. Neue Datei `src/components/AnalyticsDashboard.jsx` erstellen
2. Summary Cards (alle Tiers)
3. Bar/Line Charts (Pro+, sonst Blur-Lock)
4. Kurs-Performance Tabelle (Pro+)
5. Insights Section (Premium+)
6. Upgrade-Teaser

### Schritt 5: Dashboard Integration
1. In `src/components/Dashboard.jsx`:
   - Import der neuen Komponente
   - Neuen Tab "Analytics" in die Tab-Leiste einfügen
   - `dashView === 'analytics'` Conditional Rendering hinzufügen
2. AnalyticsDashboard Props: `user`, `userTier`, `courses`, `teacherEarnings`

### Schritt 6: Optional - API-Endpunkt
1. `api/analytics.js` erstellen (falls direkte Supabase-Calls zu langsam sind)

---

## 9. Testplan

1. **Datenbank**: RPC-Funktionen manuell in Supabase SQL Editor testen
2. **View-Tracking**: Kurs in Suche anzeigen → Detail öffnen → Prüfen ob `course_views` Einträge hat
3. **Basic-Tier**: Nur Summary Cards sichtbar, Charts/Tabelle gelockt mit Blur
4. **Pro-Tier**: Charts und Kurs-Performance sichtbar, Insights gelockt
5. **Premium/Enterprise**: Alle Features sichtbar inkl. Insights
6. **Leerer State**: Anbieter ohne Buchungen sieht "Noch keine Daten" statt leere Charts
7. **Mobile**: Responsive Layout prüfen (Cards stacken, Tabelle horizontal scrollbar)
8. **Performance**: Analytics-Tab sollte in <2s laden, auch bei Anbietern mit vielen Kursen

---

## 10. Wichtige Hinweise für die Implementierung

- **Kein npm install nötig**: Charts mit reinem CSS/SVG, keine Chart-Library
- **Lucide Icons**: Bereits importiert in Dashboard.jsx - nutze `BarChart3`, `TrendingUp`, `Eye`, `Target` etc.
- **Sprache**: UI-Texte auf Deutsch (Plattform ist primär deutschsprachig)
- **formatPriceCHF()**: Immer für CHF-Beträge nutzen (aus `src/lib/formatPrice.js`)
- **Styling**: TailwindCSS, konsistent mit bestehendem Design (rounded-xl, shadow-sm, border-gray-200)
- **Farbschema**: Primary = Orange (#F97316), Dark = fast-schwarz, Beige für Tabellenheader
- **RLS beachten**: `course_views` braucht INSERT für alle (auch anonym), SELECT nur für Kursbesitzer
- **Payout-Bug**: Die existierende `fetchTeacherEarnings()` in App.jsx nutzt hardcoded 85% Payout. Die RPC-Funktion sollte stattdessen `net_amount_cents` und `commission_percent` aus der `bookings`-Tabelle nutzen
