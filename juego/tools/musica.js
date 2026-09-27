// Renderiza canciones sin tiempo real con Chromium (Playwright) y guarda WAV + niveles.
// node tools/musica.js pradera [fiebre]
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [nombre, fiebre] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + `?prueba=musica&cancion=${nombre}&seg=34${fiebre ? '&fiebre=1' : ''}`);
  await p.waitForSelector('#out', { state: 'attached', timeout: 120000 });
  const d = JSON.parse(await p.$eval('#out', (e) => e.textContent));
  await b.close();
  const dir = path.resolve(__dirname, '../musica_prueba'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${nombre}${fiebre ? '_fiebre' : ''}.wav`), Buffer.from(d.wav, 'base64'));
  const r = d.rms;
  console.log(`${nombre}${fiebre ? ' (fiebre)' : ''}: pico ${d.pico.toFixed(2)} · rms ${Math.min(...r.slice(4)).toFixed(3)}–${Math.max(...r).toFixed(3)} · ${r.map((x) => x.toFixed(2)).join(' ')}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
