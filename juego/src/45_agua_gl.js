// 45_agua_gl.js — composición final con WebGL: mundo pixel art (vecino más cercano) arriba del agua,
// agua realista a resolución de pantalla (reflejo suave y deformado por olas, espejo según la profundidad,
// destellos del sol/luna, columnas de luz de hogueras, ondas de lluvia, espuma en la orilla) y la capa de
// interfaz encima. Si no hay WebGL, G.aguaGL.ok = false y el juego usa el agua 2D de agua.js.
(function (G) {
  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `
  precision highp float;
  uniform sampler2D uM, uU;
  uniform vec2 uRes, uTam, uShake;
  uniform float uT, uWY, uOsc, uViento, uCam, uNL, uNO;
  uniform vec3 uAgua, uCielo, uSol, uSolC;
  uniform vec4 uL[10];
  uniform vec4 uO[24];
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
  vec3 pix(vec2 b){ return texture2D(uM, (floor(b) + 0.5) / uTam).rgb; }
  vec3 lin(vec2 b){ b.y = clamp(b.y, 0.5, uWY - 0.5); return texture2D(uM, b / uTam).rgb; }
  float olas(vec2 q){ return noise(q) * 0.5 + noise(q * 2.03 + vec2(uT * 0.31, -uT * 0.42)) * 0.3 + noise(q * 4.1 - vec2(uT * 0.53, uT * 0.21)) * 0.2; }
  void main(){
    vec2 fc = gl_FragCoord.xy;
    vec2 b = vec2((fc.x + uShake.x) / uRes.x * uTam.x, (uRes.y - fc.y + uShake.y) / uRes.y * uTam.y);
    vec3 col;
    if (b.y < uWY) {
      col = pix(b);
    } else {
      float d = b.y - uWY, prof = d / (uTam.y - uWY);
      float wx = b.x + uCam;
      float yy = 17.0 * sqrt(prof);                             // perspectiva: filas de olas más juntas al fondo
      vec2 q = vec2(wx * 0.055, yy - uT * 0.9);
      float n = olas(q), m = olas(q + vec2(17.3, 5.1));
      float amp = (0.25 + 0.75 * uViento) * (0.35 + prof * 1.3);
      float dx = (n - 0.5) * amp * 5.5, dy = (m - 0.5) * amp * 2.6;
      // reflejo desenfocado según profundidad
      float ry = uWY - d * 0.985 - 1.0 + dy, rx = b.x + dx, r = 0.5 + prof * 2.4 + uViento * 0.6;
      vec3 refl = lin(vec2(rx, ry)) * 0.36 + (lin(vec2(rx - r, ry + r * 0.4)) + lin(vec2(rx + r, ry - r * 0.4))) * 0.22
                + (lin(vec2(rx - r * 2.2, ry)) + lin(vec2(rx + r * 2.2, ry))) * 0.1;
      float fres = mix(0.9, 0.38, pow(prof, 0.55));
      vec3 hondo = mix(uAgua * 1.2, uAgua * 0.45, prof);
      col = mix(hondo, refl * vec3(0.9, 0.96, 1.0), fres * 0.92);
      // crestas que reflejan el cielo
      float cresta = smoothstep(0.58, 0.82, n);
      col += uCielo * cresta * 0.10 * (1.0 - uOsc * 0.6) * (0.5 + prof);
      // destellos del sol o la luna
      if (uSol.z > 0.0) {
        float s = exp(-pow((b.x + dx * 2.0 - uSol.x) / (8.0 + d * 0.8), 2.0));
        float g = pow(max(0.0, olas(q * 1.7 + 3.0) - 0.52) * 2.4, 3.0);
        col += uSolC * s * g * 1.6 * uSol.z;
      }
      // columnas de luz de hogueras y faroles
      for (int i = 0; i < 10; i++) {
        if (float(i) >= uNL) break;
        vec4 L = uL[i];
        float w = exp(-pow((b.x + dx * 1.7 - L.x) / (L.w * (0.55 + prof * 0.9)), 2.0));
        float br = smoothstep(0.35, 0.75, noise(vec2(d * 0.5 - uT * 2.6, L.x * 0.13 + floor(d * 0.25) * 0.37)));
        col += vec3(1.0, 0.6, 0.28) * w * br * pow(1.0 - prof, 0.7) * L.z * 0.95;
      }
      // ondas de lluvia (anillos achatados por la perspectiva)
      for (int i = 0; i < 24; i++) {
        if (float(i) >= uNO) break;
        vec4 o = uO[i];
        vec2 dv = vec2(b.x - o.x, (b.y - o.y) * (3.4 - prof * 1.6));
        float rr = length(dv), R = o.z * 16.0;
        col += vec3(0.28, 0.3, 0.34) * exp(-pow((rr - R) * 1.1, 2.0)) * (1.0 - o.z / 0.8) * o.w * (1.0 - uOsc * 0.4);
      }
      // espuma en la orilla y sombra hacia el fondo
      float esp = smoothstep(2.2, 0.0, d) * (0.35 + 0.65 * noise(vec2(wx * 0.25, uT * 1.6)));
      col = mix(col, vec3(0.86, 0.88, 0.82) * (1.0 - uOsc * 0.65), esp * 0.4);
      col *= 1.0 - prof * 0.18;
    }
    vec4 u = texture2D(uU, (floor(b) + 0.5) / uTam);
    col = mix(col, u.rgb, u.a);
    gl_FragColor = vec4(col, 1.0);
  }`;

  const A = G.aguaGL = { ok: false };
  let gl, prog, texM, texU, loc = {};

  A.iniciar = (canvas) => {
    try {
      gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
      if (!gl) return false;
      const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const bufV = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufV);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const ap = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      const tex = (unidad) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      texM = tex(0); texU = tex(1);
      for (const n of ['uM', 'uU', 'uRes', 'uTam', 'uShake', 'uT', 'uWY', 'uOsc', 'uViento', 'uCam', 'uNL', 'uNO', 'uAgua', 'uCielo', 'uSol', 'uSolC', 'uL', 'uO']) loc[n] = gl.getUniformLocation(prog, n);
      gl.uniform1i(loc.uM, 0); gl.uniform1i(loc.uU, 1);
      A.ok = true;
    } catch (e) { console.warn('WebGL no disponible, se usa el agua 2D:', e.message); A.ok = false; }
    return A.ok;
  };

  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  // p: { osc, viento, agua, cielo, sol:{x,y,vis,col}, luces:[{x,y,fuerza,ancho}], ondas:[{x,y,edad,fuerza}], temblor:[dx,dy] }
  A.presentar = (mundo, ui, p) => {
    const c = gl.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texM);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mundo);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texU);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ui);
    gl.uniform2f(loc.uRes, c.width, c.height); gl.uniform2f(loc.uTam, G.W, G.H);
    gl.uniform2f(loc.uShake, p.temblor ? p.temblor[0] : 0, p.temblor ? p.temblor[1] : 0);
    gl.uniform1f(loc.uT, G.t); gl.uniform1f(loc.uWY, p.sinAgua ? G.H + 1 : G.WY); gl.uniform1f(loc.uOsc, p.osc); gl.uniform1f(loc.uViento, p.viento);
    gl.uniform1f(loc.uCam, G.camX);
    gl.uniform3fv(loc.uAgua, rgb(p.agua)); gl.uniform3fv(loc.uCielo, rgb(p.cielo));
    const s = p.sol || { x: 0, y: 0, vis: 0, col: '#FFFFFF' };
    gl.uniform3f(loc.uSol, s.x, s.y, s.vis); gl.uniform3fv(loc.uSolC, rgb(s.col));
    const L = new Float32Array(40), nl = Math.min(10, p.luces.length);
    for (let i = 0; i < nl; i++) { const l = p.luces[i]; L.set([l.x, l.y, l.fuerza, l.ancho], i * 4); }
    gl.uniform4fv(loc.uL, L); gl.uniform1f(loc.uNL, nl);
    const O = new Float32Array(96), no = Math.min(24, p.ondas.length);
    for (let i = 0; i < no; i++) { const o = p.ondas[i]; O.set([o.x, o.y, o.edad, o.fuerza], i * 4); }
    gl.uniform4fv(loc.uO, O); gl.uniform1f(loc.uNO, no);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
})(window.G);
