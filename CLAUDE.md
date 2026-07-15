# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de comportamiento

- Respondé siempre en español.
- Sé conciso: respuestas cortas, directas, sin explicaciones largas ni resúmenes innecesarios.
- Usá pocos tokens: evitá repetir código o contexto que ya está a la vista, no narres cada paso.

## Comandos

- `npm run dev` — servidor de desarrollo (Vite)
- `npm run build` — build de producción (carpeta `dist`)
- `npm run preview` — sirve el build de producción localmente
- No hay tests ni linter configurados en este proyecto.

## Qué es este proyecto

Ñongatu: sistema de gestión de pasturas/ganadería. Administra clientes que tienen animales a pastoreo, y genera cobros mensuales (con IVA) por ese servicio. Ver `schema.sql` para el modelo de datos completo (especies, categorias, clientes, animales, movimientos, cobros, cobro_detalles, pagos, recibos, usuarios).

## Arquitectura

- **Stack**: React 18 + Vite, sin backend propio. Todo el acceso a datos es directo desde los componentes React al cliente de Supabase (`src/supabase.js`), usando la clave pública (anon key) hardcodeada en el archivo.
- **Sin router**: `App.jsx` maneja la navegación con un `useState('dashboard')` y un mapa `pages` que selecciona qué componente de `src/components/` renderizar. No hay React Router.
- **Autenticación custom**: no usa Supabase Auth. `Login.jsx` hace un `select` directo a la tabla `usuarios` comparando `password_hash` en texto plano (sin hashing real). La sesión se guarda en `localStorage` (`nongatu_user`) y se restaura en el `useEffect` de `App.jsx`.
- **Permisos**: cada usuario tiene un campo JSONB `permisos` (tabla `usuarios`) con flags booleanos (`ver_clientes`, `generar_cobros`, `exportar_pdf`, etc.). `Layout.jsx` (función `canSee`) filtra qué secciones del menú se muestran según esos permisos; el rol `'Administrador'` tiene acceso total.
- **Lógica de negocio en el frontend**: el cálculo de cobros (proporcional por fecha de inicio, separación de categorías cobrables, IVA = total/11) vive en `Cobros.jsx`, no en la base de datos ni en funciones de servidor.
- **Utilidades compartidas**: `src/utils/helpers.js` (formato de guaraníes `gs()`, manejo de fechas/períodos en formato `YYYY-MM`).
- **Deploy**: el repo vive en GitHub y Netlify tiene el deploy automático conectado (build en cada push). `netlify.toml` define build (`npm run build` → `dist`) y redirect SPA (`/* → /index.html`).
- **NUNCA commitear `node_modules/` ni `dist/`**: deben estar siempre en `.gitignore`. Si por error quedan trackeados (por un commit hecho fuera de Claude Code, un merge, etc.), Netlify falla el build con `vite: Permission denied` (el binario pierde el bit de ejecución al pasar por git en Windows). Antes de investigar un fallo de build en Netlify, revisar primero con `git ls-tree -r <rama> --name-only | grep -E "^(node_modules|dist)/"` si se coló alguno de los dos; si aparece, limpiar con `git rm -r --cached node_modules dist`, confirmar `.gitignore`, commitear y recién ahí buscar otra causa.

## Reglas — Módulos Ventas y Gastos (Ñongatu)
- NUNCA ejecutar ni proponer DROP, TRUNCATE ni DELETE sobre tablas o datos existentes de Supabase.
- Cambios de base de datos SOLO aditivos. La migración ya está escrita en docs/migracion-ventas-gastos.sql: no inventar otra ni modificar tablas existentes más allá de lo que ese archivo indica.
- EL DISEÑO ACTUAL NO SE CAMBIA: nada de fuentes nuevas, paletas nuevas ni rediseños. Todo lo nuevo usa las variables y clases existentes de src/index.css y los mismos patrones visuales (tarjetas de colores del dashboard, botones, badges, tablas, franja azul de totales). Si hace falta un estilo nuevo, se agrega a index.css siguiendo la estética actual.
- La referencia visual y funcional de todo lo nuevo es docs/nongatu-maqueta-definitiva.html.
- NO romper la lógica existente de Animales, Cobros de pastaje, Recibos, Créditos, Tareas, Login ni permisos. Respetar el sistema de permisos (user.permisos, rol Administrador) en todo lo nuevo.
- Textos en español y montos con el helper gs() de src/utils/helpers.js (ej: 23.040.000 Gs.).
- Trabajar siempre en la rama `ventas-gastos`. Commit al final de cada tarea con mensaje claro en español, y verificar que `npm run build` pase sin errores.
