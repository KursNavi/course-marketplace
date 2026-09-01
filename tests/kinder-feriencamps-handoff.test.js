import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateCtaConfig,
  validateSearchConfig,
  validateThemeWorldBase,
} from '../api/_lib/theme-world-validate.js';
import { adaptToLegacyBereichConfig, adaptToLegacySzenarioConfig } from '../src/lib/themeWorldAdapter.js';

const WORKSPACE_ROOT = resolve(process.cwd(), '..');
const HANDOFF_ROOT = resolve(WORKSPACE_ROOT, 'Themenwelten', 'Kinder-Feriencamps');
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(HANDOFF_ROOT, relativePath), 'utf8'));

describe('Kinder-Feriencamps Handoff', () => {
  const handoff = readJson('Uebergabe/theme-world-package.json');
  const scenarioSources = readJson('Uebergabe/scenario-sources.json');
  const sourceMap = readJson('Input/03 Research/article-source-map.json');

  it('verwendet einen echten Kursart-Suchraum ohne Bereichs-Platzhalter', () => {
    const { theme_world: themeWorld } = handoff;
    expect(themeWorld.area_slug).toBeNull();
    expect(themeWorld.search_config).toMatchObject({ kursart: 'feriencamp', type_key: 'kinder_jugend' });
    expect(JSON.stringify(handoff)).not.toContain('__offen_kursart_filter__');
    expect(validateSearchConfig(themeWorld.search_config)).toEqual([]);
    expect(validateThemeWorldBase(themeWorld).valid).toBe(true);
    expect(validateCtaConfig(handoff.scenarios[0].cta_config)).toEqual([]);
  });

  it('reicht kursart durch Landing-, Regions- und Szenario-Links weiter', () => {
    const legacy = adaptToLegacyBereichConfig({
      themeWorld: handoff.theme_world,
      regions: handoff.regions,
    });
    const scenario = adaptToLegacySzenarioConfig(handoff.scenarios[0], handoff.theme_world.search_config);

    expect(legacy.areaSlug).toBeNull();
    expect(legacy.kursart).toBe('feriencamp');
    expect(legacy.regionalDiscovery.regions[0].params.kursart).toBe('feriencamp');
    expect(scenario.searchParams).toEqual({ kursart: 'feriencamp' });
  });

  it('hält Szenarioquellen, Mapping und Paket in derselben Reihenfolge', () => {
    const packageSources = handoff.scenarios[0].sources;
    expect(packageSources).toHaveLength(6);
    expect(scenarioSources.scenarios[0].sources).toEqual(packageSources);
    expect(sourceMap.scenarios[0].sources.map((source) => source.source_id)).toEqual([
      'S001', 'S004', 'S006', 'S010', 'S008', 'S009',
    ]);

    const sourceCsv = readFileSync(resolve(HANDOFF_ROOT, 'Input/03 Research/sources.csv'), 'utf8');
    for (const sourceId of sourceMap.scenarios[0].sources.map((source) => source.source_id)) {
      expect(sourceCsv).toMatch(new RegExp(`(?:^|\\n)"?${sourceId}"?,`));
    }
  });

  it('hält die reviewbare Copy und das Paket für Artikel und Trust identisch', () => {
    const scenarioMarkdown = readFileSync(
      resolve(HANDOFF_ROOT, 'Inhalt/09 Szenarioartikel/kinder-feriencamp-finden.md'),
      'utf8',
    );
    const html = scenarioMarkdown.match(/```html\r?\n([\s\S]*?)```/)?.[1].trim();
    expect(handoff.scenarios[0].content_html).toBe(html);

    const trustMarkdown = readFileSync(resolve(HANDOFF_ROOT, 'Inhalt/08 Trust & Hinweise/README.md'), 'utf8');
    for (const item of handoff.trust_items) {
      expect(trustMarkdown).toContain(item.name);
      expect(trustMarkdown).toContain(item.description_de);
    }
  });

  it('dokumentiert den Export mit dem wirksamen Status- und Anbieterbezug', () => {
    const csv = readFileSync(resolve(HANDOFF_ROOT, 'Input/01 Angebot/02-kurse.csv'), 'utf8');
    expect(csv.startsWith('course_id,status,user_id,title')).toBe(true);
    // Beschreibungen dürfen Zeilenumbrüche enthalten; der Datensatzbeginn ist
    // deshalb robuster als die Zahl physischer CSV-Zeilen.
    expect(csv.match(/(?:^|\r?\n)\d+,published,/g)).toHaveLength(56);
  });
});
