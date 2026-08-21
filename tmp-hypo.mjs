import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto(process.argv[2] + '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2000);
const vorher = await p.evaluate(() => {
  const w = document.querySelector('.table-wrapper');
  return { attrs: [...w.attributes].map(a=>a.name).join(','), wrapperBreite: w.clientWidth, tabelleBreite: w.querySelector('table').getBoundingClientRect().width };
});
console.log('vor Resize :', JSON.stringify(vorher));
// Fenster aendern -> ResizeObserver des WRAPPERS feuert
await p.setViewportSize({ width: 380, height: 900 });
await p.waitForTimeout(1200);
const nachher = await p.evaluate(() => {
  const w = document.querySelector('.table-wrapper');
  return { attrs: [...w.attributes].map(a=>a.name).join(','), wrapperBreite: w.clientWidth, tabelleBreite: w.querySelector('table').getBoundingClientRect().width };
});
console.log('nach Resize:', JSON.stringify(nachher));
await b.close();
