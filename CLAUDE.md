# Smart-Input Dragon — instrucciones para Claude

Prototipo del ecosistema de automatización payroll de Dragon Business Partners S.A.C.
(Proyecto de Investigación Aplicada, ADEX, Equipo 26: Gaby Limaylla y Stephany Briceño).
Publicado en https://smart-input-dragon.pages.dev (Cloudflare Pages, despliegue automático desde `main`).

## Cómo responder a Gaby
- En español, directo y práctico. Si escribe de forma coloquial, muestra primero la versión ejecutiva de su mensaje.
- Ella no programa: explica en pasos de pantalla (qué botón tocar), nunca con jerga.

## Estructura
| Archivo | Contenido |
|---|---|
| `index.html` | Página completa: CSS, `window.__CFG__` (empresas, maestro de trabajadores, periodo) y la app en JS. SheetJS desde cdnjs. |
| `functions/api/[[route]].js` | API (Pages Functions): `/api/ping`, `/api/login`, `/api/cierre` (GET/PUT). Login con hash SHA-256 `sid:<usuario>:<clave>` y token HMAC con `SESSION_SECRET`. Datos en KV `DATA`, clave `cierre:<AAAA-MM>:<EMPRESA>`. |
| `README.md` | Configuración de Cloudflare. |

Modos de datos en la página (`Store`): `api` (Cloudflare, compartido), `db` (artifact de claude.ai), `local` (solo navegador).

## Flujo funcional (no romper)
1. **Cliente** (alfa/beta/gamma; idioma ZH/EN/ES): descarga formato → registra o sube novedades (días, faltas, HE 25/35 en horas, bono, movilidad, alta/baja con fecha dd/mm/aaaa, sueldo de altas) → el archivo se **rechaza** si falta un dato obligatorio, hay fecha inválida o falta un trabajador → envía. El servidor solo le deja escribir `novedades` de su empresa y bloquea si ya hay `aprob`.
2. **Admin** (`admin`): descarga novedades y **Comprobantes Históricos** (hoja `Lineas`: Número de Documento, Código de Ficha, Mes AAAA-MM-01, Código Ítem, Monto, Descripción; sin montos en 0; altas excluidas hasta tener ficha).
3. **Validación cruzada**: sube reporte de planilla de Buk y R01 de PLAME; cruza **neto a pagar** por DNI. 0.00 = cuadra; ≤ 0.01 = redondeo tolerado; > 0.01 o sin par = analizar. Muestra dif. de ingresos y descuentos si existen. Reporte xlsx con hojas Resumen, Diferencias y Detalle.
4. **Tablero**: estado de las 3 empresas; autorizar emisión **solo con el 100 % cuadrado**.

## Cómo trabajar un cambio
1. Editar `index.html` y/o la función. Mantener los textos del portal del cliente en ES, EN y ZH.
2. Probar localmente: `npx wrangler pages dev . --kv DATA --binding SESSION_SECRET=test` y, si hay Playwright, simular cliente y admin en contextos distintos. No subir la carpeta `.wrangler/`.
3. Commit en español y push a `main`. Cloudflare publica en 1–2 min. Verificar `https://smart-input-dragon.pages.dev/api/ping` → `{"ok":true,"kv":true,"secreto":true}`.
4. Decirle a Gaby que recargue con Ctrl + F5.

## Empresa con datos reales (Alfa)
- `ALFA` tiene `real: true` (se usa con los archivos reales de un cliente): su maestro **no** está en el repositorio; el admin lo carga desde el reporte de planilla de Buk y se guarda en KV (campo `maestro` del documento del cierre).
- El servidor solo habilita empresas reales si existe la variable `ACCOUNTS_JSON` (contraseñas privadas). Si está mal escrita, nadie entra.
- Formatos reales que debe leer: reporte de Buk en inglés (`Document Number`, `NET PAY`) y R01 del PDT PLAME en .xml (encabezado en dos filas: «Documento de Identidad / Número», «Neto a pagar»).
- Nunca subir al repositorio archivos, nombres, DNI ni contraseñas reales.

## Reglas
- Solo datos **ficticios** (el repositorio es público). Nunca planillas ni DNI reales.
- Parámetros 2026-10: RMV S/ 1,230; UIT S/ 5,500; AFP 10 %, prima 1.37 % (tope S/ 12,732.70), ONP 13 %, EsSalud 9 %.
- Los códigos de ítem de Buk y los códigos PLAME son referenciales: no presentarlos como oficiales.
- Si Cloudflare muestra "disconnected from your Git account": GitHub → Settings → Applications → Cloudflare Workers and Pages → Configure → incluir el repo → Save; luego hacer un push.
