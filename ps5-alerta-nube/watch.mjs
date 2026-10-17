// Vigilante de PS5 en Amazon -> avisos por Bark.
//
// Dos modos:
//   MODO=amazon (por defecto): avisa mientras Amazon.com venda la consola nueva (fichas Disc).
//   MODO=nuevas: avisa UNA vez por cada oferta nueva (de Amazon.com o de cualquier vendedor) que
//                aparezca en la lista de ofertas; no repite mientras siga la misma oferta.
//
// Uso (la clave de Bark va SIEMPRE por variable de entorno, nunca en el repo):
//   BARK_KEY=xxxxxxxx node watch.mjs            # bucle: revisa cada INTERVALO_S segundos
//   BARK_KEY=xxxxxxxx node watch.mjs --once     # una sola revision (para tareas programadas)
//   BARK_KEY=xxxxxxxx node watch.mjs --test     # manda una notificacion normal de prueba
//   node watch.mjs --once --dry                 # revisa sin mandar ningun aviso
//
// Variables opcionales: MODO, ASINS (lista separada por comas), ZIP (33166), INTERVALO_S (120),
// DURACION_S (6600), ESTADO_PATH (MODO=nuevas), CHROMIUM_PATH, HTTPS_PROXY.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = (process.env.BARK_KEY || '').trim();
const MODO = (process.env.MODO || 'amazon').trim();
// Las dos fichas de la PS5 Disc que vigilaba tambien el vigilante de la PC.
const ASINS = (process.env.ASINS || process.env.ASIN || 'B0FRGTYSL5,B0CL61F39H')
  .split(',').map(s => s.trim()).filter(Boolean);
// Codigo postal de entrega: la direccion de Eduardo esta en Miami (33166 = Doral, zona de couriers).
const ZIP = (process.env.ZIP || '33166').trim();
const INTERVALO_S = Number(process.env.INTERVALO_S || 120);
const DURACION_S = Number(process.env.DURACION_S || 6600);
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
// Ofertas nuevas ya avisadas (MODO=nuevas), para no repetir el aviso al relanzar el vigilante.
const ESTADO = process.env.ESTADO_PATH || join(dirname(fileURLToPath(import.meta.url)), 'estado-nuevas.json');
const urlOferta = asin => `https://www.amazon.com/dp/${asin}?m=ATVPDKIKX0DER`; // m=... = solo Amazon.com
const urlOfertas = asin => `https://www.amazon.com/dp/${asin}?aod=1`;
const args = new Set(process.argv.slice(2));
const SIN_AVISOS = args.has('--dry');

const hora = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const log = (...a) => console.log(`[${hora()}]`, ...a);

function bark(titulo, cuerpo, { urgente = false, url = urlOferta(ASINS[0]) } = {}) {
  if (SIN_AVISOS) { log(`(modo --dry, no se manda) ${titulo} | ${cuerpo}`); return true; }
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

const leerEstado = () => { try { return JSON.parse(readFileSync(ESTADO, 'utf8')); } catch { return {}; } };
function guardarEstado(estado) {
  try { writeFileSync(ESTADO, JSON.stringify(estado, null, 1)); }
  catch (e) { log('no pude guardar el estado:', e.message); }
}

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

// Amazon muestra disponibilidad segun la direccion de entrega: se fija la de Miami
// con el selector de ubicacion de la propia pagina (queda guardada en la sesion del navegador).
// Si se pulsa "Apply" antes de que el selector termine de cargar, Amazon no guarda nada:
// por eso se espera la respuesta de address-change y se verifica recargando la ficha.
async function ponerZip(page, zip) {
  const leerUbicacion = () => page.evaluate(() => document.querySelector('#glow-ingress-line2')?.innerText || '');
  for (let intento = 1; intento <= 3; intento++) {
    try {
      await abrirFicha(page, urlOferta(ASINS[0]));
      if ((await leerUbicacion()).includes(zip)) return true;
      await page.click('#nav-global-location-popover-link', { timeout: 10000 });
      await page.waitForSelector('#GLUXZipUpdateInput', { state: 'visible', timeout: 10000 });
      await page.waitForTimeout(1000);
      await page.fill('#GLUXZipUpdateInput', zip);
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/glow/address-change'), { timeout: 10000 }),
        page.click('#GLUXZipUpdate input, #GLUXZipUpdate', { timeout: 5000 }),
      ]);
      await page.waitForTimeout(1500);
      await abrirFicha(page, urlOferta(ASINS[0]));
      if ((await leerUbicacion()).includes(zip)) return true;
    } catch (e) { log(`intento ${intento} de poner el codigo postal ${zip} fallo:`, e.message.split('\n')[0]); }
  }
  return false;
}

// Lista completa de ofertas ("See All Buying Options"): condicion, vendedor y precio de cada una.
// Devuelve null si la lista no cargo.
async function leerOfertas(page, asin) {
  try {
    await page.goto(urlOfertas(asin), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#aod-offer-list, #aod-pinned-offer', { timeout: 15000 });
    await page.waitForTimeout(2000);
    return await page.evaluate(() => ({
      titulo: (document.querySelector('#productTitle')?.innerText || '').replace(/\s+/g, ' ').trim(),
      ubicacion: (document.querySelector('#glow-ingress-line2')?.innerText || '').replace(/[\s‌]+/g, ' ').trim(),
      ofertas: [...document.querySelectorAll('#aod-pinned-offer, #aod-offer')].map(el => {
        const txt = s => (el.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim();
        const todo = (el.innerText || '').replace(/\s+/g, ' ');
        return {
          condicion: txt('#aod-offer-heading'),
          vende: txt('#aod-offer-soldBy').replace(/^Sold by\s*/i, '').replace(/\s*Seller rating.*$/i, '').trim(),
          precio: /see price in cart|add to cart to see/i.test(todo) ? 'precio en el carrito'
            : ((todo.match(/\$\s?[\d,]+(?:\.\d{2})?/) || [''])[0] || 'precio no leido'),
        };
      }).filter(o => o.condicion || o.vende),
    }));
  } catch { return null; }
}

// MODO=amazon. Dos formas independientes de ver si Amazon.com vende la consola nueva:
//  1) la ficha filtrada a Amazon.com tiene boton de comprar;
//  2) la lista completa de ofertas trae una oferta New vendida por Amazon.com.
// La 2 cubre el caso en que la oferta de Amazon esta en la lista pero no en la caja de compra.
async function revisar(page, asin) {
  const fichaOk = await abrirFicha(page, urlOferta(asin));
  const ficha = await page.evaluate(() => ({
    titulo: (document.querySelector('#productTitle')?.innerText || '').replace(/\s+/g, ' ').trim(),
    comprar: !!document.querySelector('#add-to-cart-button, #buy-now-button'),
    ubicacion: (document.querySelector('#glow-ingress-line2')?.innerText || '')
      .replace(/[\s‌]+/g, ' ').trim(),
  }));
  const lista = (await leerOfertas(page, asin))?.ofertas || null;
  const amazonEnLista = !!lista?.some(o => /^new/i.test(o.condicion) && /amazon\.com/i.test(o.vende));
  const comprar = fichaOk && ficha.comprar;
  return {
    titulo: ficha.titulo, ubicacion: ficha.ubicacion, fichaOk, comprar, lista, amazonEnLista,
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
  if (ZIP) {
    log(await ponerZip(page, ZIP) ? `Entrega configurada al codigo postal ${ZIP}`
      : `No pude configurar la entrega a ${ZIP}; reviso con la ubicacion por defecto y reintento luego`);
  }
  log(`Modo ${MODO}: ${ASINS.join(', ')}`);
  const fin = Date.now() + DURACION_S * 1000;
  const hubo = Object.fromEntries(ASINS.map(a => [a, 0]));
  const estado = MODO === 'nuevas' ? leerEstado() : {};
  let bloqueosSeguidos = 0, avisoBloqueo = false;
  const fallaLectura = asin => {
    bloqueosSeguidos++;
    log(`${asin}: no pude leer la pagina de Amazon (${bloqueosSeguidos} seguidas)`);
    if (bloqueosSeguidos >= 5 && !avisoBloqueo) {
      avisoBloqueo = bark('Vigilante PS5: Amazon me bloquea', 'No puedo revisar el stock. Revisa la sesion.');
    }
  };
  try {
    do {
      for (const asin of ASINS) {
        try {
          if (MODO === 'nuevas') {
            const r = await leerOfertas(page, asin);
            if (!r) { fallaLectura(asin); continue; }
            bloqueosSeguidos = 0; avisoBloqueo = false;
            const nombre = r.titulo || asin;
            if (ZIP && r.ubicacion && !r.ubicacion.includes(ZIP)) {
              log(`${asin}: la entrega no esta en ${ZIP} ("${r.ubicacion}"), la vuelvo a poner`);
              await ponerZip(page, ZIP);
            }
            const nuevas = r.ofertas.filter(o => /^new/i.test(o.condicion));
            const clave = o => `${o.vende} | ${o.precio}`;
            const yaAvisadas = new Set(estado[asin] || []);
            const vigentes = [];
            for (const o of nuevas) {
              if (yaAvisadas.has(clave(o))) { vigentes.push(clave(o)); continue; }
              const deAmazon = /^amazon\.com$/i.test(o.vende);
              const ok = bark(deAmazon ? 'PS5 NUEVA de Amazon.com!' : 'PS5 nueva de otro vendedor',
                `${nombre}: ${o.vende}, ${o.precio}`,
                { urgente: deAmazon, url: deAmazon ? urlOferta(asin) : urlOfertas(asin) });
              if (ok) vigentes.push(clave(o)); // si el aviso fallo, se reintenta en la proxima revision
            }
            // Las ofertas que desaparecen se olvidan: si vuelven mas tarde, se avisa otra vez.
            estado[asin] = vigentes;
            if (!SIN_AVISOS || process.env.ESTADO_PATH) guardarEstado(estado); // --dry no toca el estado real
            log(`${asin} ${nuevas.length ? `${nuevas.length} oferta(s) nueva(s): ${nuevas.map(clave).join('; ')}`
              : 'sin ofertas nuevas'} | ${r.ofertas.length} ofertas en total | entrega: ${r.ubicacion || '?'}`);
            continue;
          }

          const r = await revisar(page, asin);
          const nombre = r.titulo || asin;
          if (r.bloqueado) { fallaLectura(asin); continue; }
          bloqueosSeguidos = 0; avisoBloqueo = false;
          const detalle = `caja de compra: ${r.fichaOk ? (r.comprar ? 'SI' : 'no') : 'no cargo'}, lista: ${
            r.lista ? `${r.amazonEnLista ? 'SI' : 'no'} (${r.lista.length} ofertas)` : 'no cargo'}, entrega: ${
            r.ubicacion || '?'}`;
          // Si Amazon olvido la direccion de Miami, se vuelve a poner para la siguiente revision.
          if (ZIP && r.fichaOk && !r.ubicacion.includes(ZIP)) {
            log(`${asin}: la entrega no esta en ${ZIP} ("${r.ubicacion}"), la vuelvo a poner`);
            await ponerZip(page, ZIP);
          }
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
