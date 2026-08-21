import { chromium } from 'playwright';
const BASE = process.argv[2], OUT = process.argv[3];
const PATHS = [
  ['Yoga/Breathwork', '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork'],
  ['Yoga/Yoga-Stile',  '/bereich/privat-hobby/yoga-achtsamkeit/yoga-stile-finden'],
  ['Sport/Weiterbildung', '/bereich/beruflich/sport-fitness-berufsausbildung/weiterbildung'],
  ['Ratgeber/Steuer',  '/ratgeber/beruflich/finanzierung/steuer-hack-weiterbildung'],
];
const b = await chromium.launch();
let fail = 0;
for (const [w, label] of [[390, 'mobil-390'], [1440, 'desktop-1440']]) {
  console.log(`\n########## ${label} ##########`);
  for (const [name, path] of PATHS) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 100)));
    await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1800);

    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const wraps = [...document.querySelectorAll('.table-wrapper')];
      return {
        seitenOverflow: de.scrollWidth > de.clientWidth,
        scrollW: de.scrollWidth, clientW: de.clientWidth,
        tabellen: document.querySelectorAll('table').length,
        ungewrappt: [...document.querySelectorAll('table')]
          .filter(t => !t.parentElement?.classList.contains('table-wrapper')).length,
        wraps: wraps.map(x => ({
          markiert: x.hasAttribute('data-scrollable'),
          tabindex: x.getAttribute('tabindex'),
          role: x.getAttribute('role'),
          aria: x.getAttribute('aria-label'),
          scrollbar: x.scrollWidth - x.clientWidth,
          // Erreichbarkeit: laesst sich bis ans Ende scrollen?
          erreichbar: (() => { x.scrollLeft = 99999; const ok = Math.abs(x.scrollLeft - (x.scrollWidth - x.clientWidth)) <= 2; x.scrollLeft = 0; return ok; })(),
          thCount: x.querySelectorAll('th').length,
        })),
      };
    });

    const checks = [
      ['kein Seiten-Overflow', !r.seitenOverflow],
      ['alle Tabellen im Container', r.ungewrappt === 0],
      ['keine Runtime-Fehler', errs.length === 0],
    ];
    r.wraps.forEach((x, i) => {
      if (w < 768 && x.scrollbar > 2) {
        checks.push([`T${i+1} als scrollbar markiert`, x.markiert]);
        checks.push([`T${i+1} tastaturerreichbar (tabindex)`, x.tabindex === '0']);
        checks.push([`T${i+1} als Bereich angekuendigt`, x.role === 'region' && !!x.aria]);
        checks.push([`T${i+1} vollstaendig scrollbar`, x.erreichbar]);
      }
      if (w >= 768 && x.scrollbar <= 2) {
        checks.push([`T${i+1} Desktop: keine Zusatzattribute`, !x.markiert && !x.tabindex]);
      }
      checks.push([`T${i+1} Kopfzellen erhalten`, x.thCount > 0]);
    });

    console.log(`\n--- ${name}  (Tabellen: ${r.tabellen}, Seite ${r.scrollW}/${r.clientW})`);
    for (const [n, ok] of checks) { if (!ok) fail++; console.log(`    ${ok ? 'OK  ' : 'FAIL'}  ${n}`); }
    if (errs.length) console.log('    errors:', errs.slice(0, 2));
    if (w === 390 && name === 'Yoga/Breathwork') await p.screenshot({ path: `${OUT}/tabelle-mobil.png` });
    await p.close();
  }
}
await b.close();
console.log(fail === 0 ? '\nALLE CHECKS BESTANDEN' : `\n${fail} CHECK(S) FEHLGESCHLAGEN`);
