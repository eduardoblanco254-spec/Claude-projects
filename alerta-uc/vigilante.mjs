// Vigilante del portal Socrates (FACES - Universidad de Carabobo) -> alerta por Bark
// cuando se habilitan los ajustes de inscripcion o la inscripcion de asignaturas.
//
// Uso (usuario, clave y clave de Bark SIEMPRE por variables de entorno, nunca en el repo):
//   UC_USUARIO=... UC_CLAVE=... BARK_KEY=... node vigilante.mjs        # revisa cada INTERVALO_S
//   UC_USUARIO=... UC_CLAVE=... node vigilante.mjs --once --dry        # una revision, sin avisos
//
// Al detectar que se habilito, manda UNA alerta critica, cierra la sesion y se detiene,
// para no ocupar la cuenta justo cuando el alumno tiene que entrar.
// Variables opcionales: INTERVALO_S (60), DURACION_S (0 = sin limite), CHROMIUM_PATH, HTTPS_PROXY.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE = 'https://socrates.faces.uc.edu.ve';
// Cada pagina dice "En estos momento no hay periodo ... habilitado" mientras esta cerrada.
const PAGINAS = [
  { nombre: 'Ajustes de inscripcion', ruta: '/inscripcion/ajustes/alumno/asignaturas',
    cerrado: /no hay per[ií]odo de ajustes de inscripci[oó]n habilitado/i },
  { nombre: 'Inscripcion de asignaturas', ruta: '/inscripcion/alumno',
    cerrado: /no hay per[ií]odo de inscripci[oó]n habilitado/i },
];
const USUARIO = (process.env.UC_USUARIO || '').trim();
const CLAVE = process.env.UC_CLAVE || '';
const KEY = (process.env.BARK_KEY || '').trim();
const INTERVALO_S = Number(process.env.INTERVALO_S || 60);
const DURACION_S = Number(process.env.DURACION_S || 0);
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const args = new Set(process.argv.slice(2));
const SIN_AVISOS = args.has('--dry');

const hora = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const log = (...a) => console.log(`[${hora()}]`, ...a);

function bark(titulo, cuerpo, { urgente = false, url = BASE } = {}) {
  if (SIN_AVISOS) { log(`(modo --dry, no se manda) ${titulo} | ${cuerpo}`); return true; }
  if (!KEY) { log('Falta BARK_KEY: no se puede avisar'); return false; }
  const q = new URLSearchParams({ group: 'UC', url, ...(urgente
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

// En la nube se usa el Chromium de /opt/pw-browsers; en una PC, el Chrome o el Edge instalados.
async function abrirNavegador() {
  const base = { headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] };
  if (process.env.HTTPS_PROXY) base.proxy = { server: process.env.HTTPS_PROXY };
  if (existsSync(CHROMIUM)) return chromium.launch({ ...base, executablePath: CHROMIUM });
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ ...base, channel }); } catch { /* probar el siguiente */ }
  }
  throw new Error('No encontre Google Chrome ni Microsoft Edge. Instala Chrome o pon CHROMIUM_PATH.');
}

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.fill('#cedula', USUARIO);
  await page.fill('#password', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}),
    page.click('input[name=commit]'),
  ]);
  await page.waitForTimeout(1000);
  return !page.url().includes('/login');
}

const salir = page => page.goto(`${BASE}/login/logout`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

// Estados: cerrado | abierto | sin-sesion (no pudo entrar) | pagina-rara (error o mantenimiento).
async function revisar(page, p) {
  await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (page.url().includes('/login')) { // la sesion vencio: se vuelve a entrar
    if (!(await entrar(page))) return { estado: 'sin-sesion' };
    await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await page.waitForTimeout(1500);
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  // Solo cuenta como lectura valida si se ve la ficha del alumno (cedula y periodo).
  if (!/C[ée]dula/i.test(texto) || !/Per[ií]odo/i.test(texto)) return { estado: 'pagina-rara', texto: texto.slice(0, 160) };
  if (p.cerrado.test(texto) && !process.env.PRUEBA_ABIERTO) return { estado: 'cerrado' };
  const i = texto.indexOf('Turno');
  return { estado: 'abierto', resumen: texto.slice(i >= 0 ? i : 0, (i >= 0 ? i : 0) + 220) };
}

async function main() {
  if (!USUARIO || !CLAVE) { log('Faltan UC_USUARIO y UC_CLAVE'); process.exit(1); }
  const browser = await abrirNavegador();
  const ctx = await browser.newContext({
    locale: 'es-VE', viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  const fin = DURACION_S > 0 ? Date.now() + DURACION_S * 1000 : Infinity;
  let fallas = 0, avisoFallas = false;
  try {
    if (!(await entrar(page))) {
      log('No pude iniciar sesion en Socrates (usuario o clave incorrectos?)');
      bark('Vigilante UC: no pude entrar a Socrates', 'Revisa la cedula y la clave temporal.');
      return;
    }
    log('Sesion iniciada en Socrates');
    do {
      for (const p of PAGINAS) {
        let r;
        try { r = await revisar(page, p); } catch (e) { r = { estado: 'pagina-rara', texto: e.message.split('\n')[0] }; }
        if (r.estado === 'cerrado') { fallas = 0; avisoFallas = false; log(`${p.nombre}: cerrado`); continue; }
        if (r.estado === 'sin-sesion') {
          log(`${p.nombre}: no pude volver a entrar a Socrates`);
          bark('Vigilante UC: no pude entrar a Socrates', 'La sesion se cerro y no pude volver a entrar. Revisa la clave.');
          return;
        }
        if (r.estado === 'pagina-rara') {
          fallas++;
          log(`${p.nombre}: no pude leer la pagina (${fallas} seguidas): ${r.texto}`);
          if (fallas >= 5 && !avisoFallas) {
            avisoFallas = bark('Vigilante UC: Socrates no responde bien', 'Sigo intentando, pero revisa si el portal esta caido.');
          }
          continue;
        }
        // Se habilito: una sola alerta critica, se cierra la sesion y se detiene el vigilante.
        log(`${p.nombre}: ABIERTO | ${r.resumen}`);
        bark(`YA ABRIO: ${p.nombre}`, 'Entra ya a Socrates a hacer tu horario.', { urgente: true, url: BASE + p.ruta });
        if (!SIN_AVISOS) { log('Cierro la sesion y me detengo para que entres tu.'); return; }
      }
      if (args.has('--once')) break;
      await new Promise(res => setTimeout(res, INTERVALO_S * 1000));
    } while (Date.now() < fin);
  } finally {
    await salir(page);
    await browser.close();
  }
}
main();
