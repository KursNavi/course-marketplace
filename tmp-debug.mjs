import { chromium } from 'playwright';
const BASE = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'networkidle', timeout: 60000 });

for (const wait of [0, 1000, 3000]) {
  await p.waitForTimeout(wait ? 1000 : 0);
  const r = await p.evaluate(() => {
    const w = document.querySelector('.table-wrapper');
    if (!w) return { da: false };
    const prose = document.querySelector('.prose-ratgeber');
    return {
      da: true,
      scrollW: w.scrollWidth, clientW: w.clientWidth,
      diff: w.scrollWidth - w.clientWidth,
      attrs: [...w.attributes].map(a => a.name).join(','),
      proseVorhanden: !!prose,
      wrapperInProse: !!prose && prose.contains(w),
    };
  });
  console.log(`nach ~${wait}ms:`, JSON.stringify(r));
}
await b.close();
