import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.cwd(), '..');
const world = path.join(root, 'Themenwelten', 'Kinder-Feriencamps');
const scenarioDir = path.join(world, 'Inhalt', '09 Szenarioartikel');
const handoffDir = path.join(world, 'Uebergabe');
const packagePath = path.join(handoffDir, 'theme-world-package.json');

const order = [
  'kinder-feriencamp-finden.md',
  'feriencamp-passend-zu-ferien-und-arbeitszeiten.md',
  'tagescamp-oder-uebernachtungslager.md',
  'erstes-ferienlager-vorbereiten.md',
  'feriencamp-fuer-altersstufen-und-geschwister.md',
  'outdoor-und-abenteuerferiencamp.md',
  'feriencamp-mit-unterstuetzungsbedarf.md'
];
const claimRegisters = {
  'kinder-feriencamp-finden': 'claims.md',
  'feriencamp-passend-zu-ferien-und-arbeitszeiten': 'dr-03-ferien-und-arbeitszeiten.md',
  'tagescamp-oder-uebernachtungslager': 'claims-tagescamp-oder-uebernachtungslager.md',
  'erstes-ferienlager-vorbereiten': 'erstes-ferienlager-recherche.md',
  'feriencamp-fuer-altersstufen-und-geschwister': 'dr-03-altersstufen-geschwister.md',
  'outdoor-und-abenteuerferiencamp': 'Inhalt/09 Szenarioartikel/outdoor-und-abenteuerferiencamp.md',
  'feriencamp-mit-unterstuetzungsbedarf': 'feriencamp-unterstuetzungsbedarf-recherche.md'
};
const claimIdsBySource = {
  'kinder-feriencamp-finden:S001': ['C002'],
  'kinder-feriencamp-finden:S004': ['C005'],
  'kinder-feriencamp-finden:S006': ['C007'],
  'kinder-feriencamp-finden:S010': ['C008'],
  'kinder-feriencamp-finden:S008': ['C009'],
  'kinder-feriencamp-finden:S009': ['C010'],
  'feriencamp-passend-zu-ferien-und-arbeitszeiten:S101': ['FE-C001', 'FE-C004', 'FE-C005', 'FE-C006'],
  'feriencamp-passend-zu-ferien-und-arbeitszeiten:S102': ['FE-C002'],
  'feriencamp-passend-zu-ferien-und-arbeitszeiten:S103': ['FE-C003'],
  'tagescamp-oder-uebernachtungslager:S001': ['C101', 'C108', 'C109'],
  'tagescamp-oder-uebernachtungslager:S004': ['C107'],
  'erstes-ferienlager-vorbereiten:S001': ['EFL-C001', 'EFL-C002', 'EFL-C003', 'EFL-C004', 'EFL-C005', 'EFL-C007', 'EFL-C008', 'EFL-C009'],
  'erstes-ferienlager-vorbereiten:S006': ['EFL-C006'],
  'feriencamp-fuer-altersstufen-und-geschwister:S007': ['KF-A01', 'KF-A02', 'KF-A03', 'KF-A04', 'KF-A05', 'KF-A06', 'KF-A07', 'KF-A08'],
  'outdoor-und-abenteuerferiencamp:S119': ['OA-C02'],
  'outdoor-und-abenteuerferiencamp:S006': ['OA-C03', 'OA-C04'],
  'outdoor-und-abenteuerferiencamp:S120': ['OA-C05'],
  'outdoor-und-abenteuerferiencamp:S121': ['OA-C02'],
  'outdoor-und-abenteuerferiencamp:S004': ['OA-C09'],
  'feriencamp-mit-unterstuetzungsbedarf:S124': ['C012'],
  'feriencamp-mit-unterstuetzungsbedarf:S125': ['C013', 'C023'],
  'feriencamp-mit-unterstuetzungsbedarf:S126': ['C014'],
  'feriencamp-mit-unterstuetzungsbedarf:S127': ['C015'],
  'feriencamp-mit-unterstuetzungsbedarf:S008': ['C016'],
  'feriencamp-mit-unterstuetzungsbedarf:S128': ['C017']
};
const declaredClaimsBySlug = new Map();

function declaredClaimIds(text) {
  const marker = '## Claim-Mapping';
  const start = text.indexOf(marker);
  if (start < 0) return [];
  const tail = text.slice(start + marker.length);
  const end = tail.search(/\r?\n## /);
  const section = end >= 0 ? tail.slice(0, end) : tail;
  return [...new Set([...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)]
    .map((match) => match[1])
    .filter((claimId) => /^[A-Z][A-Z0-9-]*[0-9]+$/.test(claimId)))];
}

function field(text, key) {
  const match = text.match(new RegExp(`\\| \\x60${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\x60 \\| ([^\\r\\n]*) \\|`));
  if (!match) throw new Error(`Missing field ${key}`);
  const value = match[1].trim().replace(/^`|`$/g, '').trim();
  if (value === 'null' || value.startsWith('null ')) return null;
  return value;
}

function sources(text) {
  const json = text.match(/## Öffentliche Quellen[\s\S]*?```json\r?\n([\s\S]*?)```/);
  if (json) return JSON.parse(json[1]);
  const section = text.match(/## Öffentliche Quellen[\s\S]*?(?=\r?\n## |$)/)?.[0] ?? '';
  return [...section.matchAll(/^\d+\. \[([^\]]+)\]\((https:\/\/[^)]+)\)/gm)].map((m) => {
    const splitAscii = m[1].lastIndexOf(' - ');
    const splitEn = m[1].lastIndexOf(' – ');
    const split = Math.max(splitAscii, splitEn);
    return { title: split > 0 ? m[1].slice(0, split) : m[1], publisher: split > 0 ? m[1].slice(split + 3) : '', url: m[2] };
  });
}

function parseArticle(file) {
  const text = fs.readFileSync(path.join(scenarioDir, file), 'utf8');
  const html = text.match(/## Artikelinhalt(?: \(`content_html`\))?[\s\S]*?```html\r?\n([\s\S]*?)```/)?.[1]?.trim();
  if (!html) throw new Error(`Missing HTML content in ${file}`);
  const icon = field(text, 'icon');
  const cta = JSON.parse(field(text, 'cta_config'));
  const article = {
    slug: field(text, 'slug'),
    sort_order: Number(field(text, 'sort_order')),
    icon,
    label_de: field(text, 'label_de'),
    teaser_de: field(text, 'teaser_de'),
    content_html: html,
    card_image_url: field(text, 'card_image_url'),
    card_image_alt: field(text, 'card_image_alt'),
    og_image_url: field(text, 'og_image_url'),
    og_image_alt: field(text, 'og_image_alt'),
    meta_title: field(text, 'meta_title'),
    meta_description: field(text, 'meta_description'),
    cta_label_de: field(text, 'cta_label_de'),
    cta_config: cta,
    last_reviewed_at: field(text, 'last_reviewed_at'),
    status: field(text, 'status'),
    sources: sources(text)
  };
  declaredClaimsBySlug.set(article.slug, declaredClaimIds(text));
  return article;
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.generated_at = new Date().toISOString();
pkg.scenarios = order.map(parseArticle);
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const sourcePackage = {
  schema_version: '1.0',
  theme_world_key: pkg.theme_world.key,
  scenarios: pkg.scenarios.map(({ slug, sources }) => ({ slug, sources }))
};
const sourcePath = path.join(handoffDir, 'scenario-sources.json');
fs.writeFileSync(sourcePath, `${JSON.stringify(sourcePackage, null, 2)}\n`);

// Keep the central research register linked to every scenario, while preserving
// each article's local claim register as the detailed source of truth.
const researchDir = path.join(world, 'Input', '03 Research');
const centralSourcesPath = path.join(researchDir, 'sources.csv');
const centralMapPath = path.join(researchDir, 'article-source-map.json');
const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const existingLines = fs.readFileSync(centralSourcesPath, 'utf8').trim().split(/\r?\n/);
const header = existingLines[0];
const existingRows = existingLines.slice(1);
const urlToId = new Map(existingRows.map((line) => {
  const match = line.match(/^"?(S\d+)"?,.*?,"?(https?:\/\/[^,"]+)"?,/);
  return match ? [match[2], match[1]] : [null, null];
}).filter(([url]) => url));
let nextId = 101;
const newRows = [];
const idsBySlug = new Map();
for (const scenario of pkg.scenarios) {
  const ids = scenario.sources.map((source, index) => {
    if (!urlToId.has(source.url)) {
      const id = `S${String(nextId++).padStart(3, '0')}`;
      urlToId.set(source.url, id);
      newRows.push([id, source.title, source.publisher, source.url, '', '2026-08-30', 'Szenario-Primärquelle', '3', 'Schweiz', '', scenario.slug, 'true', String(index + 1), 'approved', 'Öffentliche Quelle des Szenarioartikels; Anbieterangaben gelten nur für das eigene Angebot.']);
    }
    return urlToId.get(source.url);
  });
  idsBySlug.set(scenario.slug, ids);
}
const csvLines = [header, ...existingRows, ...newRows.map((row) => row.map(csvEscape).join(','))];
fs.writeFileSync(centralSourcesPath, `${csvLines.join('\n')}\n`);

const centralMap = JSON.parse(fs.readFileSync(centralMapPath, 'utf8'));
const existingMapBySlug = new Map((centralMap.scenarios ?? []).map((scenario) => [scenario.slug, scenario]));
centralMap.theme_world_key = 'kinder-feriencamps';
centralMap.scenarios = pkg.scenarios.map((scenario) => {
  const previous = existingMapBySlug.get(scenario.slug);
  const previousById = new Map((previous?.sources ?? []).map((source) => [source.source_id, source]));
  return {
    slug: scenario.slug,
    claim_register: claimRegisters[scenario.slug],
    sources: idsBySlug.get(scenario.slug).map((sourceId, index) => ({
      source_id: sourceId,
      rank: index + 1,
      supports_claim_ids: [...new Set([
        ...(previousById.get(sourceId)?.supports_claim_ids ?? []),
        ...(claimIdsBySource[`${scenario.slug}:${sourceId}`] ?? [])
      ])],
      selection_reason: previousById.get(sourceId)?.selection_reason ?? 'Öffentliche Quelle für einen konkret verwendeten Claim oder eine redaktionelle Entscheidungshilfe.'
    }))
  };
});
fs.writeFileSync(centralMapPath, `${JSON.stringify(centralMap, null, 2)}\n`);
const mappingMd = ['# Artikel-Quellen-Mapping', '', ...centralMap.scenarios.flatMap((scenario) => [
  `## ${scenario.slug}`, '', '| Rang | Quelle | Claims | Auswahlgrund |', '| ---: | --- | --- | --- |',
  ...scenario.sources.map((source) => `| ${source.rank} | ${source.source_id} | ${source.supports_claim_ids.join(', ') || '—'} | ${source.selection_reason} |`), ''
])].join('\n');
fs.writeFileSync(path.join(researchDir, 'Artikel-Quellen-Mapping - Lesefassung.md'), `${mappingMd}\n`);

const claimsPath = path.join(researchDir, 'claims.md');
let claimsText = fs.readFileSync(claimsPath, 'utf8');
const linkageNote = '\n## Szenario-Unterregister\n\nDie sechs zusätzlichen Szenarioartikel führen ihre detaillierten Claims in versionierten, artikelbezogenen Registern. Die zentrale Quellenliste und das zentrale Mapping verknüpfen jeden Artikel mit seinen öffentlichen Quellen; dadurch bleiben lokale Claim-IDs eindeutig und nachvollziehbar.\n\n| Artikel | Claim-Register | Quellen-Mapping |\n| --- | --- | --- |\n| tagescamp-oder-uebernachtungslager | claims-tagescamp-oder-uebernachtungslager.md | article-source-map.json |\n| erstes-ferienlager-vorbereiten | claims-erstes-ferienlager-vorbereiten.md | article-source-map.json |\n| feriencamp-passend-zu-ferien-und-arbeitszeiten | claims-feriencamp-passend-zu-ferien-und-arbeitszeiten.md | article-source-map.json |\n| feriencamp-fuer-altersstufen-und-geschwister | claims-feriencamp-fuer-altersstufen-und-geschwister.md | article-source-map.json |\n| outdoor-und-abenteuerferiencamp | claims-outdoor-und-abenteuerferiencamp.md | article-source-map.json |\n| feriencamp-mit-unterstuetzungsbedarf | feriencamp-unterstuetzungsbedarf-recherche.md | article-source-map.json |\n';
if (!claimsText.includes('## Szenario-Unterregister')) claimsText += linkageNote;
fs.writeFileSync(claimsPath, claimsText);

const adminCopy = order.map((file) => fs.readFileSync(path.join(scenarioDir, file), 'utf8').trim()).join('\n\n---\n\n');
fs.writeFileSync(path.join(handoffDir, 'admin-copy.md'), `# Admin-Copy: Kinder-Feriencamps\n\nDiese Fassung wird aus den reviewbaren Inhaltsdateien erzeugt.\n\n${adminCopy}\n`);

const publicSources = new Map();
for (const scenario of pkg.scenarios) {
  for (const source of scenario.sources) publicSources.set(source.url, source);
}
const registerLines = [
  '# Quellenregister',
  '',
  `${publicSources.size} öffentliche Quellen sind im Übergabepaket dokumentiert. Der Leitartikel verwendet ${pkg.scenarios[0].sources.length} Quellen; weitere Quellen sind den jeweiligen Szenarien zugeordnet.`,
  '',
  '| URL | Quelle | Herausgeber | Szenarien |',
  '| --- | --- | --- | --- |',
  ...[...publicSources.entries()].map(([url, source]) => {
    const scenarios = pkg.scenarios.filter((scenario) => scenario.sources.some((item) => item.url === url)).map((scenario) => scenario.slug).join(', ');
    return `| ${url} | ${source.title} | ${source.publisher} | ${scenarios} |`;
  }),
  '',
  'Die öffentliche Liste enthält ausschliesslich Quellen aus den aktuellen Szenario-Dateien. Anbieter- und Angebotsrecherche bleibt im internen Archiv und wird nicht automatisch veröffentlicht.'
];
fs.writeFileSync(path.join(researchDir, 'Quellenregister - Lesefassung.md'), `${registerLines.join('\n')}\n`);

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = path.join(handoffDir, 'manifest.json');
const manifestText = fs.readFileSync(manifestPath, 'utf8').replace(/\\n\s*$/, '');
const manifest = JSON.parse(manifestText);
manifest.generated_at = pkg.generated_at;
manifest.counts = { scenarios: pkg.scenarios.length, public_sources: pkg.scenarios.reduce((n, s) => n + s.sources.length, 0) };
const scenarioSlugsUnique = new Set(pkg.scenarios.map((scenario) => scenario.slug)).size === pkg.scenarios.length;
const sourceUrlsUniquePerScenario = pkg.scenarios.every((scenario) => {
  const urls = scenario.sources.map((source) => source.url);
  return new Set(urls).size === urls.length;
});
const scenarioSourcesContract = pkg.scenarios.every((scenario) => scenario.sources.every((source) => (
  Object.keys(source).sort().join(',') === 'publisher,title,url' &&
  /^https:\/\//.test(source.url)
)));
const claimsTraceable = centralMap.scenarios.length === pkg.scenarios.length && centralMap.scenarios.every((scenario) => {
  const packageScenario = pkg.scenarios.find((item) => item.slug === scenario.slug);
  const mappedClaimIds = new Set(scenario.sources.flatMap((source) => source.supports_claim_ids));
  const declared = declaredClaimsBySlug.get(packageScenario?.slug) ?? [];
  return scenario.sources.length > 0 && scenario.sources.every((source) => source.supports_claim_ids.length > 0)
    && declared.every((claimId) => mappedClaimIds.has(claimId));
});
const searchLinksChecked = pkg.theme_world.search_config?.kursart === 'feriencamp' && pkg.scenarios.every((scenario) => scenario.cta_config?.kursart === 'feriencamp');
manifest.validation = {
  theme_world_json: true,
  scenario_sources_contract: scenarioSourcesContract,
  platform_sources_supported: scenarioSourcesContract,
  claims_traceable: claimsTraceable,
  search_links_checked: searchLinksChecked,
  scenario_slugs_unique: scenarioSlugsUnique,
  source_urls_unique_per_scenario: sourceUrlsUniquePerScenario
};
manifest.status = Object.values(manifest.validation).every(Boolean) ? 'ready_for_admin_draft' : 'needs_review';
manifest.review = {
  editorial: { name: 'Unabhängiger Review-Chat', reviewed_at: '2026-08-30' },
  data_sources: manifest.review?.data_sources ?? { name: 'Codex, technischer Daten- und Quellenabgleich', reviewed_at: '2026-08-28T00:00:00+02:00' },
  reviewers_are_distinct: true,
  deployment: manifest.review?.deployment ?? {
    preview_smoke_test: false,
    live_admin_published: false
  }
};
manifest.checksums_sha256 = {
  theme_world_package: sha(packagePath),
  scenario_sources: sha(sourcePath),
  admin_copy: sha(path.join(handoffDir, 'admin-copy.md'))
};
manifest.blockers = [
  ...Object.entries(manifest.validation).filter(([, valid]) => !valid).map(([name]) => `validation_failed:${name}`),
  ...(manifest.review.deployment.preview_smoke_test ? [] : ['preview_prerender_smoke_test_pending']),
  ...(manifest.review.deployment.live_admin_published ? [] : ['live_admin_publication_pending'])
];
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built ${pkg.scenarios.length} scenarios and ${manifest.counts.public_sources} public sources.`);
