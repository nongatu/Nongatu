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

Ñongatu: sistema de gestión de pasturas/ganadería. Administra clientes que tienen animales a pastoreo, genera cobros mensuales (con IVA) por ese servicio, y además cubre ventas de productos propios y gastos. `schema.sql` (raíz del repo) es la fuente de verdad del modelo de datos real de Supabase — ante cualquier duda de columnas/tipos, releerlo ahí, no asumir.

## Modelo de datos (Supabase)

Todas las PK son `id integer` autoincremental (`nextval` de una secuencia). Fechas: `fecha`/`fecha_*` son `date`, `created_at`/`fecha_pago`/`fecha_registro`/`fecha_creacion` son `timestamp with time zone`. Módulo de pastaje/animales:

- **especies**: `nombre`.
- **categorias**: `especie_id`→especies, `nombre`, `cobrable` (bool, si el mes de esa categoría se cobra), `orden`.
- **clientes**: `nombre_razon_social`, `cedula`, `ruc`, `direccion`, `telefono`, `email`, `fecha_alta`, `ultima_modificacion`, `modificado_por`, `creado_por`→usuarios, `tipo` (default `'pastaje'`, agregado por la migración de ventas/gastos).
- **animales**: `cliente_id`→clientes, `categoria_id`→categorias, `cantidad`, `fecha_ingreso`, `precio`, `observaciones`, `estado` (`'activo'` por defecto; también hay bajas), `usuario_id`→usuarios, `fecha_inicio_cobro`, `cobrar_proporcional` (bool), `fecha_baja`.
- **movimientos**: historial de cambios de un animal — `animal_id`→animales, `cliente_id`→clientes, `tipo`, `categoria_anterior_id`/`categoria_nueva_id`→categorias, `cantidad`, `causa`, `observacion`, `precio_nuevo`, `fecha`, `usuario_id`→usuarios.
- **cobros**: `cliente_id`→clientes, `periodo` (varchar `'YYYY-MM'`, el **mes de servicio que factura el cobro** — es la clave para agrupar ingresos de pastaje por mes, no `pagos.fecha_pago`), `fecha_generacion`, `fecha_vencimiento`, `gravada`, `iva`, `total`, `estado` (`'pendiente' | 'parcial' | 'pagado'`).
- **cobro_detalles**: `cobro_id`→cobros, `categoria_id`→categorias, `cantidad`, `precio_unitario`, `subtotal`.
- **pagos**: `cobro_id`→cobros, `monto`, `tipo`, `fecha_pago` (fecha real en que se registró el pago — puede no coincidir con el `periodo` del cobro), `usuario_id`→usuarios, `medio_pago` (default `'efectivo'`), `credito_id`→creditos_cliente.
- **recibos**: `pago_id`→pagos, `numero`, `fecha`, `cliente_id`→clientes, `total`, `detalle` (jsonb), `cobro_id`→cobros.
- **creditos_cliente**: saldo a favor del cliente aplicable a cobros futuros — `cliente_id`→clientes, `monto`, `fecha_pago`, `periodo_aplicar`, `observacion`, `aplicado` (bool), `cobro_id`→cobros, `usuario_id`→usuarios, `medio_pago`.
- **usuarios**: `nombre_usuario` (unique), `password_hash` (texto plano, sin hash real), `rol` (default `'Usuario'`; `'Administrador'` = acceso total), `activo`, `permisos` (jsonb de flags), `foto_url`, `perfil` (jsonb).
- **tareas**: `texto`, `hecha` (bool), `visibilidad` (`'admin' | 'todos'`) — el checklist del Dashboard.

Módulo de Ventas y Gastos (migración `docs/migracion-ventas-gastos.sql`, 100% aditiva):

- **productos**: `nombre` (unique), `unidad` (`docena|kg|frasco|unidad|litro`), `precio`, `controla_stock` (bool), `stock_actual`, `stock_minimo`, `activo`, `orden`.
- **stock_movimientos**: auditoría de stock — `producto_id`→productos (NOT NULL), `tipo` (`entrada_produccion|venta|anulacion_venta|ajuste`), `cantidad` (+/-), `fecha`, `venta_id` (referencia suelta, sin FK real), `observacion`, `usuario` (varchar, no FK a usuarios).
- **categorias_gasto**: `nombre` (unique), `orden`, `activo`.
- **cuentas_pago**: de dónde sale/entra la plata (base de "Caja y Bancos") — `nombre` (unique), `tipo` (default `'efectivo'`), `activo`.
- **ventas**: `numero` (secuencia propia `ventas_numero_seq`), `fecha`, `cliente_id`→clientes (nullable, `null` = consumidor final), `cliente_nombre`, `forma_pago` (`efectivo|transferencia|fiado`), `cuenta_id`→cuentas_pago, `estado` (`'pagada'|'pendiente'|'anulada'`), `fecha_vencimiento` (solo fiado), `observaciones`, `total`, `usuario` (varchar).
- **venta_items**: `venta_id`→ventas (NOT NULL), `producto_id`→productos (NOT NULL), `cantidad`, `precio_unitario`, `subtotal`.
- **venta_cobros**: cobros parciales/totales de ventas fiadas — `venta_id`→ventas (NOT NULL), `fecha`, `monto`, `forma` (`efectivo|transferencia`), `cuenta_id`→cuentas_pago, `usuario` (varchar).
- **gastos**: todo al contado (sin cuentas por pagar) — `fecha`, `categoria_id`→categorias_gasto, `proveedor` (texto libre, legado), `proveedor_id`→proveedores, `descripcion` (NOT NULL), `monto`, `cuenta_id`→cuentas_pago, `nro_comprobante`, `usuario` (varchar).
- **proveedores**: padrón propio para Gastos — `nombre_razon_social`, `ruc`, `cedula`, `rubro`, `telefono`, `email`, `direccion`, `observaciones`, `activo`.

## Arquitectura

- **Stack**: React 18 + Vite, sin backend propio. Todo el acceso a datos es directo desde los componentes React al cliente de Supabase (`src/supabase.js`), usando la clave pública (anon key) hardcodeada en el archivo.
- **Sin router**: `App.jsx` maneja la navegación con un `useState('dashboard')` y un mapa `pages` que selecciona qué componente de `src/components/` renderizar. No hay React Router.
- **Autenticación custom**: no usa Supabase Auth. `Login.jsx` hace un `select` directo a la tabla `usuarios` comparando `password_hash` en texto plano (sin hashing real). La sesión se guarda en `localStorage` (`nongatu_user`) y se restaura en el `useEffect` de `App.jsx`.
- **Permisos**: cada usuario tiene un campo JSONB `permisos` (tabla `usuarios`) con flags booleanos (`ver_clientes`, `generar_cobros`, `exportar_pdf`, etc.). `Layout.jsx` (función `canSee`) filtra qué secciones del menú se muestran según esos permisos; el rol `'Administrador'` tiene acceso total.
- **Lógica de negocio en el frontend**: el cálculo de cobros (proporcional por fecha de inicio, separación de categorías cobrables, IVA = total/11) vive en `Cobros.jsx`, no en la base de datos ni en funciones de servidor.
- **Utilidades compartidas**: `src/utils/helpers.js` (formato de guaraníes `gs()`, manejo de fechas/períodos en formato `YYYY-MM`).
- **Deploy**: el repo vive en GitHub y Netlify tiene el deploy automático conectado (build en cada push). `netlify.toml` define build (`npm run build` → `dist`) y redirect SPA (`/* → /index.html`).
- **NUNCA commitear `node_modules/` ni `dist/`**: deben estar siempre en `.gitignore`. Si por error quedan trackeados (por un commit hecho fuera de Claude Code, un merge, etc.), Netlify falla el build con `vite: Permission denied` (el binario pierde el bit de ejecución al pasar por git en Windows). Antes de investigar un fallo de build en Netlify, revisar primero con `git ls-tree -r <rama> --name-only | grep -E "^(node_modules|dist)/"` si se coló alguno de los dos; si aparece, limpiar con `git rm -r --cached node_modules dist`, confirmar `.gitignore`, commitear y recién ahí buscar otra causa.

## Sistema de diseño "Ñongatu 2.0"
La referencia visual y funcional de TODO el sistema es docs/nongatu-rediseno-final.html. Copiar de ahí colores, tipografías, espaciados y componentes. La estética anterior (tarjetas con degradados fuertes, emojis en el menú, azul plano #1e3a8a) queda ELIMINADA.

### Tokens (definirlos como variables CSS en src/index.css y usarlos siempre)
- Tinta principal --navy-900: #12233f · --navy-700: #1c355c
- Sidebar: degradado vertical de --sb-top: #152a4d a --sb-bot: #1c46c8
- Verde marca --hoja: #22c55e (acentos) · --verde: #15803d (botón primario) · --verde-suave: #ecfdf3
- Rojo #dc2626 / #fef2f2 · Ámbar #b45309 / #fffbeb · Violeta #6d28d9 / #f5f3ff · Azul #1d4ed8 / #eff6ff
- Fondo #f3f5f9 · Tarjeta #fff con borde #e4e9f2 y sombra 0 1px 2px rgba(18,35,63,.06)
- Texto #1b2946 · Texto secundario #5d6b85 · Radio tarjetas 14px · botones/inputs 9-10px

### Tipografía (Google Fonts, importadas en index.css)
- Títulos y números grandes: 'Bricolage Grotesque' 600-700, letter-spacing negativo leve
- Todo lo demás: 'IBM Plex Sans' 400-600
- Números en tablas y montos: font-variant-numeric: tabular-nums (clase .num)

### Componentes
- Tarjetas KPI tintadas (no degradadas): fondo suave + borde del mismo tono + valor grande en Bricolage con el color fuerte (verde/rojo/violeta/ámbar según la métrica).
- Pills/badges redondeadas 10.5px 600 con fondo suave (verde=pagado, ámbar=pendiente, rojo=fiado/no, azul=info, violeta=transferencia, gris=neutro).
- Tablas: th en MAYÚSCULAS 10px letter-spacing .7px color #6a7896, filas con hover #f7f9fd, montos alineados a la derecha.
- Franja de totales al pie de tabla: degradado horizontal #152a4d→#1c46c8, texto blanco 12px 600, bordes inferiores redondeados.
- Modales SIEMPRE centrados y flotantes: fondo rgba(18,35,63,.45) con blur, tarjeta blanca radio 16px, header con título en Bricolage y botón ✕, pie con botones a la derecha; cierre con ESC y clic afuera.
- Checkbox circular .check-circle: círculo 19px borde #9db0d0, al marcarse se llena de --hoja con tilde blanco.
- Botones: primario verde #15803d, navy #1c355c, rojo #dc2626, azul #1d4ed8, "linea" (blanco con borde) para acciones secundarias; radio 10px, 600.

### Sidebar (escritorio)
232px, degradado --sb-top→--sb-bot, logo "ñongatu" en Bricolage con la "o" en --hoja, íconos SVG inline de trazo (stroke 1.7, sin emojis), ítem activo con fondo blanco translúcido y barrita verde a la izquierda, sección "Próximamente" (Salarios, Caja y Bancos deshabilitados con badge), tarjeta de usuario y Cerrar sesión abajo. Colapsable a 72px (solo íconos + tooltip), estado en localStorage — mantener la lógica de colapso y permisos (canSee) que ya existe.

### Móvil (≤760px)
El sidebar desaparece. Navegación con BARRA INFERIOR fija tipo app: Inicio, Clientes, Animales, Ventas y "Más" (los mismos SVG, label 10px, activo en azul con puntito verde). "Más" abre una hoja inferior (bottom sheet) con Cobros, Gastos, Reportes, Configuración, Salarios/Caja (pronto) y Cerrar sesión. Todo apilado verticalmente, tipografías y botones que NO se achican (targets táctiles ≥44px), formularios a una columna, respetar env(safe-area-inset-bottom).

### Reglas
- Español siempre; montos con gs() de src/utils/helpers.js.
- Cambios de BD solo aditivos; schema.sql es la fuente de verdad; migraciones nuevas solo las que estén en docs/.
- No romper lógica existente (pastaje, recibos, créditos, permisos, tareas).
- Ninguna pantalla se considera terminada solo por comparar capturas del usuario a simple vista: antes de decir que una pantalla "ya coincide" con docs/nongatu-rediseno-final.html, levantar el dev server, sacar una captura real (headless, ej. Playwright) de la pantalla y compararla lado a lado con una captura de la maqueta al mismo tamaño de viewport. Prestar atención en particular a que cada tarjeta/card tenga fondo, borde y padding visibles (clases combinadas correctamente, ej. dash-card + dash-card-flex) — un layout puede "verse bien" en la estructura y aun así faltarle el fondo blanco.

## Reglas — Módulos Ventas y Gastos (Ñongatu)
- NUNCA ejecutar ni proponer DROP, TRUNCATE ni DELETE sobre tablas o datos existentes de Supabase.
- Cambios de base de datos SOLO aditivos. La migración ya está escrita en docs/migracion-ventas-gastos.sql: no inventar otra ni modificar tablas existentes más allá de lo que ese archivo indica.
- NO romper la lógica existente de Animales, Cobros de pastaje, Recibos, Créditos, Tareas, Login ni permisos. Respetar el sistema de permisos (user.permisos, rol Administrador) en todo lo nuevo.
- Textos en español y montos con el helper gs() de src/utils/helpers.js (ej: 23.040.000 Gs.).
- Trabajar siempre directo en la rama `main` (no crear ni usar ramas de feature). Verificar que `npm run build` pase sin errores, hacer commit al final de cada tarea con mensaje claro en español, y SIEMPRE terminar con `git push` a `origin main` — ninguna tarea queda "terminada" sin ese push.
