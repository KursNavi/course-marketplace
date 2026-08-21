import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto(process.argv[2] + '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const hatFiber = (el) => !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
  const prose = document.querySelector('.prose-ratgeber');
  const wrap = document.querySelector('.table-wrapper');
  const h1 = document.querySelector('h1');
  return {
    proseVonReact: hatFiber(prose),
    wrapperVonReact: hatFiber(wrap),
    h1VonReact: hatFiber(h1),
    rootVonReact: hatFiber(document.getElementById('root')),
    rootErstesKindVonReact: hatFiber(document.getElementById('root')?.firstElementChild),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
