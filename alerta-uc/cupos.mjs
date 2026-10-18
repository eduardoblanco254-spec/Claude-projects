// Vigila los cupos de una seccion en "Ajuste de Horario" de Socrates (FACES-UC) y avisa por Bark
// cuando esa seccion tenga cupos. Solo lee la pagina: no toca los selectores ni el boton Finalizar.
//
// Uso (credenciales y clave de Bark SIEMPRE por variables de entorno):
//   UC_USUARIO=... UC_CLAVE=... BARK_KEY=... MATERIA=AC4103 SECCION=31 node cupos.mjs
//   ... node cupos.mjs --once --dry     # una revision, sin avisos
// Variables opcionales: INTERVALO_S (60), DURACION_S (0 = sin limite), CHROMIUM_PATH, HTTPS_PROXY.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE = 'https://socrates.faces.uc.edu.ve';
// Pagina "Ajustar Horario" (la de los selectores de seccion). Solo se abre y se lee.
const RUTA = '/inscripcion/ajustes/alumno/ajustar_horario';
const USUARIO = (process.env.UC_USUARIO || '').trim();
const CLAVE = process.env.UC_CLAVE || '';
const KEY = (process.env.BARK_KEY || '').trim();
const MATERIA = (process.env.MATERIA || 'AC4103').trim();
const SECCION = (process.env.SECCION || '31').trim();
const INTERVALO_S = Number(process.env.INTERVALO_S || 60);
const DURACION_S = Number(process.env.DURACION_S || 0);
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const args = new Set(process.argv.slice(2));
const SIN_AVISOS = args.has('--dry');

const hora = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const log = (...a) => console.log(`[${hora()}]`, ...a);

function bark(titulo, cuerpo, { urgente = false } = {}) {
  if (SIN_AVISOS) { log(`(modo --dry, no se manda) ${titulo} | ${cuerpo}`); return true; }
  if (!KEY) { log('Falta BARK_KEY'); return false; }
  const q = new URLSearchParams({ group: 'UC', url: BASE + RUTA, ...(urgente
    ? { level: 'critical', volume: '10', call: '1', sound: 'alarm' } : { level: 'active' }) });
  try {
    const r = execFileSync('curl', ['-sS', '-m', '20',
      `https://api.day.app/${KEY}/${encodeURIComponent(titulo)}/${encodeURIComponent(cuerpo)}?${q}`], { encoding: 'utf8' });
    const ok = /"code"\s*:\s*200/.test(r);
    log(`Bark ${ok ? 'OK' : 'FALLO'}: ${titulo}`);
    return ok;
  } catch (e) { log('Bark error:', e.message.split('\n')[0]); return false; }
}

async function abrirNavegador() {
  const base = { headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] };
  if (process.env.HTTPS_PROXY) base.proxy = { server: process.env.HTTPS_PROXY };
  if (existsSync(CHROMIUM)) return chromium.launch({ ...base, executablePath: CHROMIUM });
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ ...base, channel }); } catch { /* probar el siguiente */ }
  }
  throw new Error('No encontre Google Chrome ni Microsoft Edge.');
}

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#cedula', USUARIO);
  await page.fill('#password', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    page.click('input[name=commit]'),
  ]);
  return !page.url().includes('/login');
}

// Devuelve { cupos } de la seccion buscada, o { error } si no se pudo leer.
async function leerCupos(page) {
  await page.goto(BASE + RUTA, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (page.url().includes('/login')) {
    if (!(await entrar(page))) return { error: 'no pude iniciar sesion' };
    await page.goto(BASE + RUTA, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForTimeout(1500);
  const filas = await page.evaluate(() => [...document.querySelectorAll('tr')]
    .filter(tr => tr.querySelector('select'))
    .map(tr => ({ texto: tr.innerText.replace(/\s+/g, ' '),
      opciones: [...tr.querySelectorAll('select option')].map(o => o.textContent.replace(/\s+/g, ' ').trim()) })));
  const fila = filas.find(f => f.texto.includes(MATERIA));
  if (!fila) return { error: `no encontre la materia ${MATERIA} en la pagina (${filas.length} filas con secciones)` };
  const op = fila.opciones.find(o => new RegExp(`^${SECCION}\\b`).test(o));
  if (!op) return { error: `no encontre la seccion ${SECCION}; opciones: ${fila.opciones.join(' / ')}` };
  const m = op.match(/Cupos:\s*(-?\d+)/i);
  if (!m) return { error: `no pude leer los cupos en "${op}"` };
  return { cupos: Number(m[1]), opciones: fila.opciones.join(' / ') };
}

// Elige la seccion en el selector solo para ver la vista previa del horario: el selector llama a
// cambioSeccion(), que reenvia el formulario a ajustar_horario (vista previa). Lo que guarda es
// "Finalizar" (cambio_seccion), que NUNCA se pulsa.
async function capturarVistaPrevia(page) {
  const destino = process.env.CAPTURA || new URL('./horario-con-cupo.png', import.meta.url).pathname;
  try {
    const sel = page.locator(`tr:has-text("${MATERIA}") select`);
    const valor = await sel.evaluate((s, sec) => [...s.options].find(o => new RegExp(`^${sec}\\b`).test(o.textContent.trim()))?.value, SECCION);
    if (valor) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }), sel.selectOption(valor)]);
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: destino, fullPage: true });
    log(`Captura de la vista previa: ${destino}`);
  } catch (e) { log('no pude tomar la captura:', e.message.split('\n')[0]); }
}

async function main() {
  if (!USUARIO || !CLAVE) { log('Faltan UC_USUARIO y UC_CLAVE'); process.exit(1); }
  const browser = await abrirNavegador();
  const ctx = await browser.newContext({ locale: 'es-VE', ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  const fin = DURACION_S > 0 ? Date.now() + DURACION_S * 1000 : Infinity;
  let fallas = 0, avisoFallas = false;
  log(`Vigilando ${MATERIA} seccion ${SECCION}`);
  try {
    do {
      let r;
      try { r = await leerCupos(page); } catch (e) { r = { error: e.message.split('\n')[0] }; }
      if (r.error) {
        fallas++;
        log(`no pude revisar (${fallas} seguidas): ${r.error}`);
        if (fallas >= 15 && !avisoFallas) {
          avisoFallas = bark('Vigilante de cupos: Socrates no responde', 'Sigo intentando. Revisa tu tambien.');
        }
      } else {
        fallas = 0; avisoFallas = false;
        log(`${MATERIA} seccion ${SECCION}: ${r.cupos} cupos | ${r.opciones}`);
        if (r.cupos > 0) {
          bark(`HAY CUPO: ${MATERIA} seccion ${SECCION}`, `${r.cupos} cupo(s). Entra ya a Ajuste de Horario.`, { urgente: true });
          await capturarVistaPrevia(page);
          if (!SIN_AVISOS) { log('Aviso enviado: cierro la sesion y me detengo.'); return; }
        }
      }
      if (args.has('--once')) break;
      await new Promise(res => setTimeout(res, INTERVALO_S * 1000));
    } while (Date.now() < fin);
  } finally {
    await page.goto(`${BASE}/login/logout`, { timeout: 30000 }).catch(() => {});
    await browser.close();
  }
}
main();
