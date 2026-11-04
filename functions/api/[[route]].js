/**
 * Smart-Input Dragon — API (Cloudflare Pages Functions)
 *
 * Rutas:
 *   GET  /api/ping                      -> estado del servicio
 *   POST /api/login   {u, p}            -> {token, user}
 *   GET  /api/cierre?per=AAAA-MM        -> documentos del cierre (admin: todas las empresas; cliente: la suya)
 *   PUT  /api/cierre/EMPRESA?per=...    -> guarda el documento de una empresa
 *
 * Requiere en Cloudflare:
 *   - Binding KV llamado DATA
 *   - Secreto SESSION_SECRET (texto largo cualquiera)
 */

const EMPRESAS = ['ALFA', 'BETA', 'GAMMA', 'FLOWX'];
// Empresas con datos reales: solo se habilitan cuando las contraseñas son privadas (variable ACCOUNTS_JSON).
const REALES = ['FLOWX'];

// Contraseñas guardadas como hash SHA-256 de "sid:<usuario>:<contraseña>".
// Para cambiarlas en producción, define la variable ACCOUNTS_JSON con este mismo formato.
const DEFAULT_ACCOUNTS = [
  { u: 'admin', h: '10fba9964cab7924d85d57cd38d256741873cfa6464f0d313663eb61f3326869', rol: 'admin', nombre: 'Analista de planillas DBP' },
  { u: 'alfa', h: 'ff6d41e0578316b0c7b8ab865e24493efc4e9d120da2f888aca1ba2ea847e580', rol: 'cliente', emp: 'ALFA', nombre: 'Alfa Tech Perú S.A.C.' },
  { u: 'beta', h: '41a76a080060221b706192f3b69bfd98df42a1433c9be2acb872f88bdb73b177', rol: 'cliente', emp: 'BETA', nombre: 'Beta Logistics Perú S.A.C.' },
  { u: 'gamma', h: '6612feabae8fd601e95433bca34281c092bc13155b39ec895d033d459457debc', rol: 'cliente', emp: 'GAMMA', nombre: 'Gamma Foods Perú S.A.C.' }
];

const enc = new TextEncoder();
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uText = s => b64u(enc.encode(s));
const fromB64u = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function cuentas(env) {
  if (!env.ACCOUNTS_JSON) return DEFAULT_ACCOUNTS;
  try { const a = JSON.parse(env.ACCOUNTS_JSON); return Array.isArray(a) ? a : []; } catch (e) { return []; } // si está mal escrito, nadie entra (no vuelve a las cuentas de prueba)
}
const secreto = env => env.SESSION_SECRET || 'cambia-este-secreto-en-cloudflare';

async function firmar(env, user) {
  const body = b64uText(JSON.stringify({ u: user.u, exp: Date.now() + 12 * 3600 * 1000 }));
  return body + '.' + await hmac(secreto(env), body);
}
async function sesion(request, env) {
  const auth = request.headers.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [body, sig] = tok.split('.');
  if (!body || !sig || sig !== await hmac(secreto(env), body)) return null;
  let p; try { p = JSON.parse(fromB64u(body)); } catch (e) { return null; }
  if (!p.exp || p.exp < Date.now()) return null;
  return cuentas(env).find(a => a.u === p.u) || null;
}
const publico = a => ({ u: a.u, rol: a.rol, emp: a.emp || null, nombre: a.nombre });
const clave = (per, emp) => `cierre:${per}:${emp}`;
const perOk = per => /^\d{4}-\d{2}$/.test(per || '');

export async function onRequest(context) {
  const { request, env, params } = context;
  const route = Array.isArray(params.route) ? params.route : [params.route].filter(Boolean);
  const url = new URL(request.url);
  const m = request.method;

  if (route[0] === 'ping') return json({ ok: true, kv: !!env.DATA, secreto: !!env.SESSION_SECRET, cuentasPrivadas: !env.ACCOUNTS_JSON ? false : cuentas(env).length ? true : 'formato inválido' });
  if (!env.DATA) return json({ error: 'Falta configurar el binding KV "DATA" en Cloudflare.' }, 503);

  if (route[0] === 'login' && m === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return json({ error: 'Solicitud inválida' }, 400); }
    const u = String(b.u || '').trim().toLowerCase();
    const a = cuentas(env).find(x => x.u === u);
    if (!a || a.h !== await sha256hex(`sid:${u}:${String(b.p || '')}`)) return json({ error: 'Usuario o contraseña incorrectos' }, 401);
    return json({ token: await firmar(env, a), user: publico(a) });
  }

  if (route[0] === 'cierre') {
    const user = await sesion(request, env);
    if (!user) return json({ error: 'Sesión vencida. Vuelve a iniciar sesión.' }, 401);
    const per = url.searchParams.get('per');
    if (!perOk(per)) return json({ error: 'Periodo inválido' }, 400);

    if (m === 'GET' && !route[1]) {
      const emps = (user.rol === 'admin' ? EMPRESAS : [user.emp]).filter(e => env.ACCOUNTS_JSON || !REALES.includes(e));
      const docs = {};
      for (const e of emps) docs[e] = (await env.DATA.get(clave(per, e), 'json')) || {};
      return json({ docs, user: publico(user) });
    }

    if (m === 'PUT' && route[1]) {
      const emp = String(route[1]).toUpperCase();
      if (!EMPRESAS.includes(emp)) return json({ error: 'Empresa no existe' }, 404);
      if (REALES.includes(emp) && !env.ACCOUNTS_JSON) return json({ error: 'Para usar datos reales primero configura contraseñas privadas (ACCOUNTS_JSON) en Cloudflare.' }, 403);
      let doc; try { doc = await request.json(); } catch (e) { return json({ error: 'Solicitud inválida' }, 400); }
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return json({ error: 'Documento inválido' }, 400);
      const raw = JSON.stringify(doc);
      if (raw.length > 400000) return json({ error: 'Documento demasiado grande' }, 413);
      const actual = (await env.DATA.get(clave(per, emp), 'json')) || {};

      let nuevo;
      if (user.rol === 'admin') nuevo = doc;
      else {
        // El cliente solo puede enviar las novedades de SU empresa y mientras la emisión no esté autorizada.
        if (user.emp !== emp) return json({ error: 'No tienes acceso a esta empresa' }, 403);
        if (actual.aprob) return json({ error: 'La emisión ya fue autorizada: las novedades están cerradas' }, 409);
        if (!doc.novedades || !Array.isArray(doc.novedades.rows)) return json({ error: 'Faltan las novedades' }, 400);
        nuevo = Object.assign({}, actual, { novedades: Object.assign({}, doc.novedades, { usuario: user.u, recibido: new Date().toISOString() }) });
      }
      await env.DATA.put(clave(per, emp), JSON.stringify(nuevo));
      return json({ ok: true, doc: nuevo });
    }
  }
  return json({ error: 'Ruta no encontrada' }, 404);
}
