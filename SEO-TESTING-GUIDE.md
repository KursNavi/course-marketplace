# 🧪 KursNavi SEO Testing & Validation Guide

Dieser Guide führt dich durch alle notwendigen Tests, um sicherzustellen, dass die SEO-Implementierung korrekt funktioniert.

---

## 📋 **PRE-DEPLOYMENT CHECKLIST**

### ✅ **Schritt 1: Lokale Entwicklungsumgebung**

1. **Development Server starten**
   ```bash
   npm run dev
   # oder
   yarn dev
   ```

2. **Basis-Funktionalität prüfen**
   - [ ] Homepage lädt korrekt
   - [ ] Kursdetailseiten laden
   - [ ] Blog-Seiten laden
   - [ ] Kategorie-Seiten laden (z.B. `/courses/yoga/zurich/`)
   - [ ] Sprachenwechsel funktioniert

---

## 🔍 **PHASE 1: META-TAGS VALIDIERUNG**

### **Test 1: Homepage Meta-Tags**

**URL:** `http://localhost:5173/`

**Im Browser Developer Tools (F12 → Elements/Inspector):**

```html
<!-- Erwartete Tags im <head>: -->
<title>KursNavi - Der Schweizer Kursmarktplatz für Weiterbildung & Freizeit</title>
<meta name="description" content="Entdecke tausende Kurse in der Schweiz...">
<link rel="canonical" href="https://kursnavi.ch/">

<!-- Open Graph Tags -->
<meta property="og:title" content="KursNavi - Der Schweizer Kursmarktplatz">
<meta property="og:description" content="...">
<meta property="og:url" content="https://kursnavi.ch/">
<meta property="og:image" content="https://kursnavi.ch/og-default.svg">

<!-- hreflang Tags -->
<link rel="alternate" hreflang="de" href="https://kursnavi.ch/">
<link rel="alternate" hreflang="fr" href="https://kursnavi.ch/fr/">
<link rel="alternate" hreflang="it" href="https://kursnavi.ch/it/">
<link rel="alternate" hreflang="en" href="https://kursnavi.ch/en/">
<link rel="alternate" hreflang="x-default" href="https://kursnavi.ch/">
```

**Prüfen:**
- [ ] Alle Meta-Tags vorhanden
- [ ] OG-Image zeigt SVG-Logo
- [ ] 5 hreflang Tags (de, fr, it, en, x-default)

---

### **Test 2: Kursdetailseite Meta-Tags**

**URL:** `http://localhost:5173/courses/[category]/[location]/[id]-[title]`
**Beispiel:** `/courses/yoga-entspannung-mental/zurich/42-yoga-anfaenger`

**Erwartete Tags:**

```html
<title>Yoga für Anfänger in Zürich | KursNavi</title>
<meta name="description" content="Yoga für Anfänger in Zürich - Lerne die Grundlagen...">
<link rel="canonical" href="https://kursnavi.ch/courses/yoga-entspannung-mental/zurich/42-yoga-anfaenger">

<!-- OG Tags mit Kurs-Bild -->
<meta property="og:title" content="Yoga für Anfänger in Zürich">
<meta property="og:image" content="[Kurs-Bild-URL oder og-default.jpg]">

<!-- hreflang Tags -->
<link rel="alternate" hreflang="de" href="https://kursnavi.ch/courses/yoga.../42-yoga...">
<link rel="alternate" hreflang="fr" href="https://kursnavi.ch/fr/courses/yoga.../42-yoga...">
<!-- ... etc -->
```

**Prüfen:**
- [ ] Title enthält Kurstitel + Ort
- [ ] Description ist dynamisch (erste 155 Zeichen)
- [ ] Canonical URL stimmt
- [ ] OG-Image ist Kursbild (oder Default)
- [ ] hreflang Tags vorhanden

---

### **Test 3: Category/Location Landing Page**

**URL:** `/courses/[topic]/[location]/`
**Beispiel:** `/courses/yoga-entspannung-mental/zurich/`

**Erwartete Tags:**

```html
<title>Yoga in Zürich - [X] Kurse vergleichen | KursNavi</title>
<meta name="description" content="[X] Yoga-Kurse in Zürich ab CHF [avg]. Vergleiche [Y] Anbieter...">
<meta name="robots" content="index,follow"> <!-- nur wenn Kurse vorhanden -->
```

**Prüfen:**
- [ ] Title zeigt Anzahl Kurse
- [ ] Description zeigt Statistiken
- [ ] robots="noindex,follow" wenn keine Kurse
- [ ] robots="index,follow" wenn Kurse vorhanden

---

## 🏗️ **PHASE 2: STRUCTURED DATA VALIDIERUNG**

### **Google Rich Results Test**

**URL:** https://search.google.com/test/rich-results

#### **Test A: Kursdetailseite**

1. Gib die **LIVE URL** ein (nach Deployment)
2. Klicke auf "URL TESTEN"

**Erwartete Rich Results:**

✅ **Course Schema gefunden:**
```json
{
  "@type": ["Course", "EducationEvent"],
  "name": "Yoga für Anfänger",
  "description": "...",
  "provider": {
    "@type": "Organization",
    "name": "Yoga Studio Zürich"
  },
  "offers": {
    "availability": "https://schema.org/InStock",
    "price": 120,
    "priceCurrency": "CHF"
  }
}
```

✅ **BreadcrumbList Schema gefunden:**
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "position": 1, "name": "Home" },
    { "position": 2, "name": "Yoga" },
    { "position": 3, "name": "Yoga für Anfänger" }
  ]
}
```

**Checkliste:**
- [ ] Course Schema validiert ohne Fehler
- [ ] EducationEvent Schema validiert ohne Fehler
- [ ] BreadcrumbList Schema validiert ohne Fehler
- [ ] Keine Warnings oder Errors
- [ ] `availability` ist "InStock" oder "SoldOut"
- [ ] `startDate` ist gesetzt (falls course_events vorhanden)

---

#### **Test B: Homepage**

**Erwartete Rich Results:**

✅ **Organization Schema:**
```json
{
  "@type": "Organization",
  "name": "KursNavi",
  "url": "https://kursnavi.ch",
  "logo": "https://kursnavi.ch/og-default.svg"
}
```

**Checkliste:**
- [ ] Organization Schema validiert
- [ ] Logo URL korrekt
- [ ] Keine Errors

---

#### **Test C: Blog-Artikel**

**URL:** `/blog/[slug]`

**Erwartete Rich Results:**

✅ **Article Schema** (automatisch durch og:type="article")
✅ **BreadcrumbList Schema**

**Checkliste:**
- [ ] BreadcrumbList zeigt: Home → Magazin → [Artikel-Titel]
- [ ] article:published_time gesetzt
- [ ] Keine Errors

---

## 🌍 **PHASE 3: HREFLANG VALIDIERUNG**

### **hreflang Testing Tool**

**URL:** https://technicalseo.com/tools/hreflang/

#### **Test Prozedur:**

1. Gib **LIVE URL** ein (nach Deployment)
2. Tool crawlt alle hreflang Tags

**Erwartete Ausgabe:**

```
✓ Found 5 hreflang tags
✓ de: https://kursnavi.ch/courses/yoga/zurich/42-yoga
✓ fr: https://kursnavi.ch/fr/courses/yoga/zurich/42-yoga
✓ it: https://kursnavi.ch/it/courses/yoga/zurich/42-yoga
✓ en: https://kursnavi.ch/en/courses/yoga/zurich/42-yoga
✓ x-default: https://kursnavi.ch/courses/yoga/zurich/42-yoga

✓ No errors found
✓ All return links valid
```

**Checkliste:**
- [ ] 5 hreflang Tags pro Seite
- [ ] x-default ist gesetzt
- [ ] Keine Fehler (Return Links valid)
- [ ] URLs folgen korrektem Muster

**Test auf folgenden Seiten:**
- [ ] Homepage
- [ ] Kursdetailseite
- [ ] Category/Location Page
- [ ] Blog-Post (optional)

---

## 📱 **PHASE 4: SOCIAL SHARING TEST**

### **Facebook Debugger**

**URL:** https://developers.facebook.com/tools/debug/

#### **Test Prozedur:**

1. Gib **LIVE URL** ein (z.B. Kursdetailseite)
2. Klicke auf "Debuggen"
3. Falls Errors: Klicke auf "Scrape Again"

**Erwartete Preview:**

```
Title: Yoga für Anfänger in Zürich
Description: Yoga für Anfänger in Zürich - Lerne die...
Image: [Kurs-Bild oder og-default.svg]
```

**Checkliste:**
- [ ] Titel wird korrekt angezeigt
- [ ] Description zeigt dynamischen Text
- [ ] Bild wird geladen (nicht broken)
- [ ] Keine Warnings zu fehlenden Tags

---

### **Twitter Card Validator**

**URL:** https://cards-dev.twitter.com/validator

#### **Test Prozedur:**

1. Gib **LIVE URL** ein
2. Prüfe Card Preview

**Erwartete Card:**

```
Card Type: summary_large_image
Title: Yoga für Anfänger in Zürich
Description: [...]
Image: [Kurs-Bild]
```

**Checkliste:**
- [ ] Card Type ist "summary_large_image" (Kursseiten)
- [ ] Card Type ist "summary" (Listen-Seiten)
- [ ] Titel und Description korrekt
- [ ] Bild wird angezeigt

---

### **LinkedIn Post Inspector**

**URL:** https://www.linkedin.com/post-inspector/

**Test:**
- [ ] Gib LIVE URL ein
- [ ] Prüfe Preview
- [ ] Titel, Description, Image korrekt

---

### **WhatsApp Link Preview Test**

**Manuell testen:**

1. Sende eine LIVE URL an dich selbst in WhatsApp
2. Warte auf Preview-Generierung

**Erwartung:**
- [ ] Preview zeigt Titel + Bild
- [ ] Kein Fallback auf Favicon

---

## 🗺️ **PHASE 5: SITEMAP VALIDIERUNG**

### **Sitemap Zugriff**

**URL:** `https://kursnavi.ch/api/sitemap`

**Erwartete Struktur:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Statische Seiten -->
  <url>
    <loc>https://kursnavi.ch</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>https://kursnavi.ch/blog</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Kurse -->
  <url>
    <loc>https://kursnavi.ch/courses/yoga/zurich/42-yoga-anfaenger</loc>
    <lastmod>2026-01-20T...</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Blog-Posts -->
  <url>
    <loc>https://kursnavi.ch/blog/wie-waehle-ich-einen-kurs</loc>
    <lastmod>2026-01-15T...</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

</urlset>
```

**Checkliste:**
- [ ] Sitemap ist erreichbar (kein 404)
- [ ] Enthält statische Seiten
- [ ] Enthält alle Kurse
- [ ] Enthält Blog-Posts
- [ ] Keine 404-URLs in Sitemap
- [ ] lastmod Daten sind korrekt formatiert

---

### **XML Sitemap Validator**

**URL:** https://www.xml-sitemaps.com/validate-xml-sitemap.html

1. Gib Sitemap-URL ein: `https://kursnavi.ch/api/sitemap`
2. Klicke auf "Validate"

**Erwartete Ausgabe:**
```
✓ Sitemap is valid
✓ All URLs are accessible
✓ No duplicate URLs found
```

**Checkliste:**
- [ ] Keine XML-Syntax-Fehler
- [ ] Keine Duplikate
- [ ] Alle URLs HTTP 200

---

## 🤖 **PHASE 6: ROBOTS.TXT VALIDIERUNG**

### **robots.txt Zugriff**

**URL:** `https://kursnavi.ch/robots.txt`

**Erwarteter Inhalt:**

```
User-agent: *
Allow: /

Disallow: /dashboard
Disallow: /create-course
Disallow: /login
Disallow: /api/*

Allow: /api/sitemap

# Filter-Parameter blockiert
Disallow: /*?sort=*
Disallow: /*?filter=*
Disallow: /*?price_min=*

# Sinnvolle Filter erlaubt
Allow: /*?q=*
Allow: /*?loc=*
Allow: /*?type=*

Sitemap: https://kursnavi.ch/api/sitemap
```

**Checkliste:**
- [ ] robots.txt ist erreichbar
- [ ] Sitemap-URL ist korrekt
- [ ] Private Bereiche blockiert
- [ ] Filter-Parameter korrekt konfiguriert

---

### **Google Robots.txt Tester**

**URL:** https://www.google.com/webmasters/tools/robots-testing-tool
*(Benötigt Google Search Console)*

**Test:**
1. Gib robots.txt URL ein
2. Teste verschiedene URLs:
   - [ ] `/search` → ALLOWED
   - [ ] `/dashboard` → BLOCKED
   - [ ] `/search?sort=price` → BLOCKED
   - [ ] `/search?q=yoga&loc=zurich` → ALLOWED

---

## 🚀 **PHASE 7: GOOGLE SEARCH CONSOLE SETUP**

### **Nach dem Deployment:**

1. **Gehe zu:** https://search.google.com/search-console/

2. **Property hinzufügen:**
   - [ ] Wähle "URL-Präfix"
   - [ ] Gib `https://kursnavi.ch` ein
   - [ ] Verifiziere via DNS oder HTML-Tag

3. **Sitemap einreichen:**
   - [ ] Gehe zu "Sitemaps" im Menü
   - [ ] Füge hinzu: `https://kursnavi.ch/api/sitemap`
   - [ ] Klicke auf "Senden"

4. **URL-Inspection:**
   - [ ] Teste Homepage: `https://kursnavi.ch`
   - [ ] Teste Kursseite: `https://kursnavi.ch/courses/...`
   - [ ] Teste Blog-Post: `https://kursnavi.ch/blog/...`
   - [ ] Klicke jeweils auf "URL bei Google indexieren"

---

## 📊 **PHASE 8: PERFORMANCE TESTS**

### **Google PageSpeed Insights**

**URL:** https://pagespeed.web.dev/

**Test:**
1. Gib LIVE URL ein
2. Teste Mobile + Desktop

**Erwartete Metriken:**

**Mobile:**
- [ ] Performance Score > 80
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] FID/INP < 200ms

**Desktop:**
- [ ] Performance Score > 90
- [ ] LCP < 1.5s

**Checkliste:**
- [ ] Lazy Loading funktioniert (Images "below the fold")
- [ ] Keine Layout Shifts beim Laden
- [ ] Core Web Vitals "Good"

---

## ✅ **DEPLOYMENT CHECKLIST**

### **Pre-Launch:**
- [ ] Alle Tests in PHASE 1-4 bestanden
- [ ] Sitemap funktioniert
- [ ] robots.txt korrekt
- [ ] OG-Image (`og-default.svg`) deployed
- [ ] Keine broken Links in Schema

### **Post-Launch (Tag 1):**
- [ ] Google Search Console Setup
- [ ] Sitemap eingereicht
- [ ] URL Inspection für Top-Seiten
- [ ] Social Sharing Tests (Facebook, Twitter, LinkedIn)

### **Post-Launch (Woche 1):**
- [ ] Google Search Console → Coverage Report prüfen
- [ ] Rich Results im Search Appearance Check
- [ ] Indexierte Seiten zählen
- [ ] Fehler/Warnings beheben

### **Post-Launch (Monat 1):**
- [ ] Performance Report prüfen
- [ ] Top Queries analysieren
- [ ] CTR für Programmatic Pages tracken
- [ ] Internationale Traffic prüfen (hreflang Impact)

---

## 🐛 **TROUBLESHOOTING**

### **Problem: Schema validiert nicht**

**Lösung:**
1. Prüfe JavaScript Errors in Browser Console
2. Prüfe, ob `course_events` vorhanden sind
3. Validiere JSON manuell: https://jsonformatter.org/

---

### **Problem: OG-Image wird nicht geladen**

**Lösung:**
1. Prüfe, ob `og-default.svg` unter `/public/` liegt
2. Prüfe URL: `https://kursnavi.ch/og-default.svg`
3. Falls 404: Deploy erneut
4. Cache löschen: Facebook Debugger → "Scrape Again"

---

### **Problem: hreflang Tags fehlen**

**Lösung:**
1. Prüfe Browser Console für Errors
2. Prüfe, ob `useEffect` ausgeführt wird
3. Prüfe `<head>` im Browser Inspector
4. Hard-Refresh: `Ctrl+Shift+R`

---

### **Problem: Sitemap zeigt 404-Seiten**

**Lösung:**
1. Prüfe Supabase-Datenbank (nur aktive Kurse)
2. Prüfe `is_published` für Blog-Posts
3. Re-deploy `api/sitemap.js`

---

### **Problem: robots.txt blockiert wichtige Seiten**

**Lösung:**
1. Teste in Google Robots.txt Tester
2. Prüfe `Allow:` Rules vor `Disallow:` Rules
3. Order matters: Spezifischere Rules zuerst

---

## 📞 **SUPPORT & RESOURCES**

### **Hilfreiche Tools:**

- **Schema Validator:** https://validator.schema.org/
- **Meta Tags Debugger:** https://metatags.io/
- **OpenGraph Check:** https://www.opengraph.xyz/
- **hreflang Checker:** https://technicalseo.com/tools/hreflang/
- **Lighthouse:** Chrome DevTools → Lighthouse Tab

### **Google Dokumentation:**

- **Rich Results:** https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- **hreflang:** https://developers.google.com/search/docs/specialty/international/localized-versions
- **Sitemaps:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview

---

## 🎉 **SUCCESS CRITERIA**

Die SEO-Implementierung ist erfolgreich wenn:

- ✅ Alle Rich Results Tests bestanden (Course, BreadcrumbList, Organization)
- ✅ Alle hreflang Tags validieren ohne Fehler
- ✅ Social Sharing zeigt korrekte Previews (FB, Twitter, LinkedIn, WhatsApp)
- ✅ Sitemap wird von Google Search Console akzeptiert
- ✅ Keine Indexing-Errors in Search Console (nach 1 Woche)
- ✅ Core Web Vitals "Good" (Performance > 80)
- ✅ Kursseiten erscheinen in Rich Results (nach 2-4 Wochen)
- ✅ Breadcrumbs erscheinen in SERPs (nach 1-2 Wochen)

---

**Viel Erfolg beim Testing!** 🚀
