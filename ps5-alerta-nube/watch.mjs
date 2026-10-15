// Vigilante de la PS5 1TB en Amazon.com (solo oferta vendida por Amazon) -> avisos por Bark.
//
// Uso (la clave de Bark va SIEMPRE por variable de entorno, nunca en el repo):
//   BARK_KEY=xxxxxxxx node watch.mjs            # bucle: revisa cada INTERVALO_S segundos
//   BARK_KEY=xxxxxxxx node watch.mjs --once     # una sola revision (para tareas programadas)
//   BARK_KEY=xxxxxxxx node watch.mjs --test     # manda una notificacion normal de prueba
//
// Variables opcionales: ASIN, INTERVALO_S (120), DURACION_S (6600), CHROMIUM_PATH, HTTPS_PROXY.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

const KEY = (process.env.BARK_KEY || '').trim();
const ASIN = process.env.ASIN || 'B0FRGTYSL5';
const INTERVALO_S = Number(process.env.INTERVALO_S || 120);
const DURACION_S = Number(process.env.DURACION_S || 6600);
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const URL_OFERTA = `https://www.amazon.com/dp/${ASIN}?m=ATVPDKIKX0DER`; // m=... = solo Amazon.com
const args = new Set(process.argv.slice(2));

const hora = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const log = (...a) => console.log(`[${hora()}]`, ...a);

function bark(titulo, cuerpo, { urgente = false } = {}) {
  if (!KEY) { log('Falta BARK_KEY: no se puede avisar'); return false; }
  const q = new URLSearchParams({ group: 'PS5', url: URL_OFERTA, ...(urgente
    ? { level: 'critical', volume: '10', call: '1', sound: 'alarm' }
    : { level: 'active' }) });
  const u = `https://api.day.app/${KEY}/${encodeURIComponent(titulo)}/${encodeURIComponent(cuerpo)}?${q}`;
  try {
    const r = execFileSync('curl', ['-sS', '-m', '20', u], { encoding: 'utf8' });
    const ok = /"code"\s*:\s*200/.test(r);
    log(`Bark ${ok ? 'OK' : 'FALLO'}: ${titulo}`);
    return ok;
  } catch (e) { log('Bark error:', e.message.split('\n')[0]); return false; }
}

async function revisar(page) {
  await page.goto(URL_OFERTA, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  return page.evaluate(() => {
    const txt = s => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim();
    const html = document.documentElement.innerHTML;
    const bloqueado = !document.querySelector('#productTitle') &&
      /captcha|robot check|api-services-support|automated access/i.test(html);
    const comprar = !!document.querySelector('#add-to-cart-button, #buy-now-button');
    return {
      bloqueado,
      titulo: txt('#productTitle'),
      disponible: comprar,
      vendedor: txt('#merchantInfoFeature_feature_div') || txt('#tabular-buybox'),
      caja: txt('#desktop_buybox').slice(0, 160),
    };
  });
}

async function main() {
  if (args.has('--test')) {
    process.exit(bark('Prueba: vigilante PS5 en la nube', 'Si ves esto, Bark funciona. Te aviso cuando haya PS5.') ? 0 : 1);
  }
  const launchOpts = {
    executablePath: CHROMIUM, headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  };
  if (process.env.HTTPS_PROXY) launchOpts.proxy = { server: process.env.HTTPS_PROXY };
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US', viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const fin = Date.now() + DURACION_S * 1000;
  let bloqueosSeguidos = 0, avisoBloqueo = false, hubo = 0;
  try {
    do {
      try {
        const r = await revisar(page);
        if (r.bloqueado) {
          bloqueosSeguidos++;
          log(`Amazon bloqueo la consulta (${bloqueosSeguidos} seguidas)`);
          if (bloqueosSeguidos >= 5 && !avisoBloqueo) {
            avisoBloqueo = bark('Vigilante PS5: Amazon me bloquea', 'No puedo revisar el stock. Revisa la sesion.');
          }
        } else {
          bloqueosSeguidos = 0; avisoBloqueo = false;
          if (r.disponible) {
            hubo++;
            log(`DISPONIBLE: ${r.titulo} | ${r.vendedor || r.caja}`);
            bark(hubo === 1 ? 'PS5 NUEVA en Amazon!' : 'PS5 SIGUE en Amazon!',
              `${r.titulo || 'PS5'} vendida por Amazon.com. Corre!`, { urgente: true });
          } else {
            hubo = 0;
            log(`sin stock de Amazon (${r.titulo || 'titulo no leido'})`);
          }
        }
      } catch (e) { log('error en la revision:', e.message.split('\n')[0]); }
      if (args.has('--once')) break;
      await new Promise(res => setTimeout(res, INTERVALO_S * 1000));
    } while (Date.now() < fin);
  } finally { await browser.close(); }
}
main();
