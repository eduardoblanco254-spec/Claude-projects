// Vigilante de la PS5 Disc en Amazon.com (solo oferta vendida por Amazon) -> avisos por Bark.
//
// Uso (la clave de Bark va SIEMPRE por variable de entorno, nunca en el repo):
//   BARK_KEY=xxxxxxxx node watch.mjs            # bucle: revisa cada INTERVALO_S segundos
//   BARK_KEY=xxxxxxxx node watch.mjs --once     # una sola revision (para tareas programadas)
//   BARK_KEY=xxxxxxxx node watch.mjs --test     # manda una notificacion normal de prueba
//   node watch.mjs --once --dry                 # revisa sin mandar ningun aviso
//
// Variables opcionales: ASINS (lista separada por comas), INTERVALO_S (120), DURACION_S (6600),
// CHROMIUM_PATH, HTTPS_PROXY.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

const KEY = (process.env.BARK_KEY || '').trim();
// Las dos fichas de la PS5 Disc que vigilaba tambien el vigilante de la PC.
const ASINS = (process.env.ASINS || process.env.ASIN || 'B0FRGTYSL5,B0CL61F39H')
  .split(',').map(s => s.trim()).filter(Boolean);
const INTERVALO_S = Number(process.env.INTERVALO_S || 120);
const DURACION_S = Number(process.env.DURACION_S || 6600);
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const urlOferta = asin => `https://www.amazon.com/dp/${asin}?m=ATVPDKIKX0DER`; // m=... = solo Amazon.com
const args = new Set(process.argv.slice(2));
const SIN_AVISOS = args.has('--dry');

const hora = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const log = (...a) => console.log(`[${hora()}]`, ...a);

function bark(titulo, cuerpo, { urgente = false, url = urlOferta(ASINS[0]) } = {}) {
  if (SIN_AVISOS) { log(`(modo --dry, no se manda) ${titulo}`); return true; }
  if (!KEY) { log('Falta BARK_KEY: no se puede avisar'); return false; }
  const q = new URLSearchParams({ group: 'PS5', url, ...(urgente
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

// Dos formas independientes de ver si Amazon.com vende la consola nueva:
//  1) la ficha filtrada a Amazon.com tiene boton de comprar;
//  2) la lista completa de ofertas ("See All Buying Options") trae una oferta New vendida por Amazon.com.
// La 2 cubre el caso en que la oferta de Amazon esta en la lista pero no en la caja de compra.
// A veces la ficha llega sin cargar (o con la pagina intermedia "Continue shopping"):
// se reintenta una vez para no contar como "sin stock" una ficha que no se pudo leer.
async function abrirFicha(page, url) {
  for (let intento = 0; intento < 2; intento++) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    if (await page.$('#productTitle')) return true;
    const seguir = page.locator('button:has-text("Continue shopping"), a:has-text("Continue shopping")');
    if (await seguir.count()) {
      await seguir.first().click().catch(() => {});
      await page.waitForTimeout(3000);
    }
  }
  return !!(await page.$('#productTitle'));
}

async function revisar(page, asin) {
  const fichaOk = await abrirFicha(page, urlOferta(asin));
  const ficha = await page.evaluate(() => ({
    titulo: (document.querySelector('#productTitle')?.innerText || '').replace(/\s+/g, ' ').trim(),
    comprar: !!document.querySelector('#add-to-cart-button, #buy-now-button'),
  }));

  let lista = null;
  try {
    await page.goto(`https://www.amazon.com/dp/${asin}?aod=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#aod-offer-list, #aod-pinned-offer', { timeout: 15000 });
    await page.waitForTimeout(2000);
    lista = await page.evaluate(() => [...document.querySelectorAll('#aod-pinned-offer, #aod-offer')].map(el => {
      const txt = s => (el.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim();
      return { condicion: txt('#aod-offer-heading'), vende: txt('#aod-offer-soldBy') };
    }));
  } catch { /* si la lista no carga, queda la revision de la ficha */ }
  const amazonEnLista = !!lista?.some(o => /^new/i.test(o.condicion) && /amazon\.com/i.test(o.vende));
  const comprar = fichaOk && ficha.comprar;
  return {
    titulo: ficha.titulo, fichaOk, comprar, lista, amazonEnLista,
    bloqueado: !fichaOk && !lista, // no se pudo leer ninguna de las dos
    disponible: comprar || amazonEnLista,
  };
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
  const hubo = Object.fromEntries(ASINS.map(a => [a, 0]));
  let bloqueosSeguidos = 0, avisoBloqueo = false;
  try {
    do {
      for (const asin of ASINS) {
        try {
          const r = await revisar(page, asin);
          const nombre = r.titulo || asin;
          if (r.bloqueado) {
            bloqueosSeguidos++;
            log(`${asin}: Amazon bloqueo la consulta (${bloqueosSeguidos} seguidas)`);
            if (bloqueosSeguidos >= 5 && !avisoBloqueo) {
              avisoBloqueo = bark('Vigilante PS5: Amazon me bloquea', 'No puedo revisar el stock. Revisa la sesion.');
            }
            continue;
          }
          bloqueosSeguidos = 0; avisoBloqueo = false;
          const detalle = `caja de compra: ${r.fichaOk ? (r.comprar ? 'SI' : 'no') : 'no cargo'}, lista: ${
            r.lista ? `${r.amazonEnLista ? 'SI' : 'no'} (${r.lista.length} ofertas)` : 'no cargo'}`;
          if (r.disponible) {
            hubo[asin]++;
            log(`${asin} DISPONIBLE: ${nombre} | ${detalle}`);
            bark(hubo[asin] === 1 ? 'PS5 NUEVA en Amazon!' : 'PS5 SIGUE en Amazon!',
              `${nombre} vendida por Amazon.com. Corre!`, { urgente: true, url: urlOferta(asin) });
          } else {
            hubo[asin] = 0;
            log(`${asin} sin stock de Amazon: ${nombre} | ${detalle}`);
          }
        } catch (e) { log(`${asin}: error en la revision:`, e.message.split('\n')[0]); }
      }
      if (args.has('--once')) break;
      await new Promise(res => setTimeout(res, INTERVALO_S * 1000));
    } while (Date.now() < fin);
  } finally { await browser.close(); }
}
main();
