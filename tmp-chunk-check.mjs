import { chromium } from 'playwright';
const BASE = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
const chunks = [];
p.on('response', async res => {
  const u = res.url();
  if (u.endsWith('.js') && res.status() === 200) {
    try { const t = await res.text(); chunks.push({ u: u.split('/').pop(), hatCode: t.includes('data-scrollable'), hatSzenario: t.includes('Atemarbeit') || t.includes('table-wrapper') }); } catch {}
  }
});
await p.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
console.log('Geladene Chunks:');
chunks.forEach(c => console.log(`  ${c.u.padEnd(34)} data-scrollable=${c.hatCode ? 'JA ' : 'nein'}  table-wrapper/Inhalt=${c.hatSzenario ? 'ja' : 'nein'}`));
console.log('\nIrgendein Chunk mit data-scrollable:', chunks.some(c => c.hatCode));
await b.close();
