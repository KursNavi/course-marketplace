import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
const konsole = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') konsole.push(`${m.type()}: ${m.text().slice(0,200)}`); });
p.on('pageerror', e => konsole.push('PAGEERROR: ' + String(e).slice(0,220)));
await p.goto(process.argv[2] + '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3500);
console.log('--- Konsole (gefiltert) ---');
console.log(konsole.filter(l => !/cookie banner|Analytics|DevTools|Download the React/i.test(l)).slice(0,10).join('\n') || '(keine)');
const r = await p.evaluate(() => ({
  reactRoot: !!document.getElementById('root'),
  rootHatKinder: (document.getElementById('root')?.children.length) ?? 0,
  ctaBoxen: document.querySelectorAll('.cta-box').length,
  ctaButtons: document.querySelectorAll('.cta-box-button').length,
}));
console.log('--- Zustand ---'); console.log(JSON.stringify(r));
// Gegenprobe: Rendert der Ratgeber-Artikel (kein Prerender) seine Effekte?
await p.goto(process.argv[2] + '/ratgeber/beruflich/finanzierung/steuer-hack-weiterbildung', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
const r2 = await p.evaluate(() => {
  const w = document.querySelector('.table-wrapper');
  return { attrs: w ? [...w.attributes].map(a=>a.name).join(',') : 'kein wrapper' };
});
console.log('--- Ratgeber zum Vergleich ---'); console.log(JSON.stringify(r2));
await b.close();
