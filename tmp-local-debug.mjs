import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
const logs = [];
p.on('console', m => logs.push(`${m.type()}: ${m.text().slice(0,140)}`));
p.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0,200)));
await p.goto('http://localhost:5455/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const wraps = [...document.querySelectorAll('.table-wrapper')];
  const prose = [...document.querySelectorAll('.prose-ratgeber')];
  return {
    proseAnzahl: prose.length,
    wrapAnzahl: wraps.length,
    details: wraps.map(w => ({ attrs: [...w.attributes].map(a => a.name).join(','), diff: w.scrollWidth - w.clientWidth })),
    h1: document.querySelector('h1')?.textContent?.trim().slice(0,60),
  };
});
console.log(JSON.stringify(r, null, 1));
console.log('--- Konsole ---');
console.log(logs.filter(l => !/ERR_NAME_NOT_RESOLVED|Failed to fetch|supabase|themeWorld/i.test(l)).slice(0,8).join('\n') || '(nichts relevantes)');
await b.close();
