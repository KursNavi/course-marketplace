import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto(process.argv[2] + '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const prose = document.querySelector('.prose-ratgeber');
  const w = document.querySelector('.table-wrapper');
  // Manuell anwenden, wie es der Effekt tun wuerde
  w.setAttribute('data-scrollable', 'true');
  w.setAttribute('tabindex', '0');
  const stil = getComputedStyle(w);
  return {
    manuellGesetzt: w.hasAttribute('data-scrollable'),
    randNachManuell: stil.borderTopWidth,   // greift das CSS?
    proseKlassen: prose.className,
    // Wie oft wurde der Inhalt ersetzt? Indiz: gibt es cta-box-Buttons (anderer Effekt)?
    ctaButtons: document.querySelectorAll('.cta-box-button').length,
    ctaBoxen: document.querySelectorAll('.cta-box').length,
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
