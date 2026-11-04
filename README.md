# Smart-Input Dragon

Prototipo del ecosistema de automatización payroll de Dragon Business Partners S.A.C.
(Proyecto de Investigación Aplicada — ADEX, Equipo 26).

- **Portal del cliente** (ES / EN / 中文): descarga del formato, registro y carga de novedades con validación.
- **Administrador**: descarga de novedades y Comprobantes Históricos para Buk, carga del reporte de planilla de Buk y del R01 de PLAME, y cruce de netos a pagar.
- **Tablero de control**: estado de las 3 empresas y autorización de emisión solo con el 100 % cuadrado.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (diseño y lógica). |
| `functions/api/[[route]].js` | API en Cloudflare Pages Functions: inicio de sesión y datos compartidos. |

## Configuración en Cloudflare (una sola vez)

1. **Workers & Pages → KV → Create namespace** con el nombre `smart-input-data`.
2. En el proyecto **smart-input-dragon → Settings → Bindings → Add → KV namespace**:
   variable `DATA`, namespace `smart-input-data`.
3. En **Settings → Variables and Secrets → Add**: tipo *Secret*, nombre `SESSION_SECRET`,
   valor: cualquier texto largo.
4. **Deployments → Retry deployment** (o subir un cambio) para que tome la configuración.

Sin el binding `DATA`, la página funciona en *modo local* (los datos quedan solo en el navegador).

Los datos de prueba son ficticios. No subir planillas ni datos reales.
