# Prompts para Claude Code — Ñongatu 2.0: rediseño completo + Ventas y Gastos

**Este documento reemplaza al anterior.** La diferencia clave: primero se rediseña la base visual
de TODO el sistema (para que lo viejo y lo nuevo coincidan), y recién después se agregan los
módulos nuevos, que nacen ya con el diseño definitivo. Así no queda nada desprolijo ni mezclado.

Está escrito para el código real del repositorio `nongatu/Nongatu`:
- React 18 + Vite + Supabase (`@supabase/supabase-js`), deploy en Netlify.
- Estilos propios con variables CSS en `src/index.css` (sin Tailwind).
- Navegación por estado en `src/App.jsx` (mapa de páginas) + `src/components/Layout.jsx`.
- Ya existe `src/components/SearchSelect.jsx` (buscador), `src/utils/helpers.js` (formato `gs()`),
  permisos por usuario en `Usuarios.jsx`, PDFs por ventana de impresión (`window.print()`) y
  exportación CSV en `Reportes.jsx`.
- Tablas actuales en `schema.sql`: especies, categorias, usuarios, clientes, animales,
  movimientos, cobros, cobro_detalles, pagos, recibos.

**Regla de oro (igual que siempre):** la base de datos solo se toca para AGREGAR. Nada de lo
cargado en Supabase se borra ni se modifica. Casi todo este trabajo es frontend.

Pegá los prompts **en orden, uno por vez**, probá después de cada uno, y recién pasá al siguiente.

---

## Paso previo A — Reglas permanentes (CLAUDE.md) y rama de trabajo

```
Agregá al archivo CLAUDE.md del proyecto (crealo si no existe) esta sección, sin borrar nada de lo que ya tenga:

## Reglas — Rediseño Ñongatu 2.0 + módulos Ventas y Gastos
- NUNCA ejecutar ni proponer DROP, TRUNCATE ni DELETE sobre tablas o datos existentes de Supabase.
- Cambios de base de datos SOLO aditivos: CREATE TABLE nuevas y ALTER TABLE ... ADD COLUMN con default seguro. Mostrar el SQL completo y esperar mi confirmación antes de aplicar.
- NO romper la lógica existente de Animales, Cobros de pastaje, Recibos, Créditos, Login ni permisos. El rediseño es visual y de componentes; la lógica de negocio actual se conserva salvo que una tarea pida lo contrario.
- Toda decisión visual sale de las variables y clases de src/index.css (fuente única de diseño). Prohibido hardcodear colores sueltos en los componentes: si falta un color/espaciado, se agrega como variable.
- Mantener y respetar el sistema de permisos existente (user.permisos, rol Administrador). Los módulos nuevos agregan sus propios permisos.
- Textos siempre en español, montos con el helper gs() de src/utils/helpers.js (ej: 23.040.000 Gs.).
- La maqueta docs/nongatu-demo-ventas-gastos.html es la referencia de contenido y estructura de los módulos nuevos, pero el diseño final debe ser el nuevo sistema visual, aplicado igual en TODO el programa.
- Trabajar siempre en la rama `redisenio-v2`. Commit al final de cada tarea con mensaje claro en español.
- Después de cada tarea, verificar que `npm run build` pase sin errores.

Después creá la rama redisenio-v2 a partir de main y confirmame que está lista.
```

---

## PROMPT 1 — Análisis e inventario visual (solo lectura)

```
Sin modificar nada todavía, hacé un análisis completo del proyecto y presentame:

1. Un inventario de todas las pantallas y sus componentes (Dashboard, Clientes, Animales, Cobros con sus pestañas, Reportes, Configuración, Usuarios, Perfil, Login) y qué clases CSS de src/index.css usa cada una.
2. Un inventario de patrones repetidos que hoy están duplicados y deberían ser componentes reutilizables: tarjetas de resumen, tablas con acciones, formularios, badges de estado, botones, filtros, la franja azul de totales, los modales o confirmaciones si existen.
3. Cómo funciona hoy la generación de PDFs (ventana emergente + window.print en Cobros.jsx y Reportes.jsx) y la exportación CSV de Reportes.jsx.
4. Leé docs/nongatu-demo-ventas-gastos.html (maqueta de los módulos nuevos: Ventas, Gastos, Ventas fiadas en Cobros, reportes ampliados, dashboard financiero).

Con todo eso, proponeme un sistema de diseño unificado para TODO el programa: paleta (partiendo del azul actual del sidebar y los acentos verdes del logo), tipografía y tamaños, espaciados, bordes y sombras, y la lista de componentes base a crear. Objetivos que el diseño debe cumplir sí o sí:
- Sidebar colapsable en escritorio (modo solo iconos) y el contenido que se expande a todo el ancho.
- Dashboard que entre completo en la pantalla de una notebook (sin scroll vertical en escritorio).
- Modales flotantes centrados como patrón estándar para ver detalles, registrar acciones y descargar.
- Checkboxes circulares para las tareas.
- Aspecto profesional y consistente: mismas tarjetas, mismos botones, mismas tablas en todos los módulos, viejos y nuevos.

Todavía no implementes nada: mostrame la propuesta y esperá mi confirmación.
```

---

## PROMPT 2 — Sistema de diseño y componentes base

```
Implementá el sistema de diseño aprobado. Esta etapa NO cambia ninguna lógica, solo la base visual y los componentes reutilizables:

1. Reescribí src/index.css de forma ordenada: bloque :root con todos los tokens (colores, tipografía, espaciados, radios, sombras, alturas), luego layout, luego componentes. Mantené los nombres de clases que ya usan los componentes existentes cuando sea posible, para que el reskin sea automático; documentá arriba de cada bloque qué es.

2. Sidebar colapsable en escritorio: botón para colapsar/expandir en la parte superior del sidebar; colapsado queda de ~68px mostrando solo iconos (SVG inline simples, sin librerías nuevas) con tooltip al pasar el mouse; el estado se guarda en localStorage y .main-content se adapta al ancho disponible con una transición suave. En móvil se mantiene el comportamiento actual de overlay con el botón hamburguesa. Agregá el ícono correspondiente a cada ítem del NAV en Layout.jsx.

3. Creá en src/components/ui/ estos componentes reutilizables, con el nuevo estilo:
   - Modal.jsx: modal flotante centrado con overlay oscuro, título, botón X, cierre con ESC y clic afuera, tamaños sm/md/lg, y zona de pie para botones. Va a ser el patrón estándar de todo el sistema.
   - Toast.jsx: avisos de éxito/error arriba a la derecha (reemplaza alerts sueltos).
   - StatCard.jsx: tarjeta de resumen con etiqueta, valor, detalle y variante de color.
   - Badge.jsx: pills de estado (pagado, pendiente, fiado, contado, transferencia, categorías).
   - DataTable.jsx: tabla estándar con encabezado, hover, columnas numéricas alineadas a la derecha, franja de totales al pie (la franja azul que ya usa Animales) y estado vacío.
   - ConfirmDialog.jsx: confirmación centrada para eliminar (reemplaza window.confirm si se usa).
   - Checkbox circular (clase CSS .check-circle): redondo, con tilde al marcar, para las tareas del dashboard.

4. Mejorá src/components/SearchSelect.jsx para convertirlo en el autocompletador estándar de clientes: debe buscar por nombre, RUC o cédula (el llamador arma searchText con los tres), mostrar en cada opción el nombre y debajo el RUC/cédula en gris, navegarse con flechas y Enter, y aceptar una prop opcional onCreateNew que agrega al final la opción "+ Crear cliente nuevo…". No rompas los usos actuales del componente.

5. Verificá que todas las pantallas existentes sigan funcionando y se vean razonablemente bien con la nueva base (el pulido fino pantalla por pantalla viene en las próximas etapas). npm run build sin errores y commit.
```

---

## PROMPT 3 — Rediseño de Clientes y Animales (sin tocar lógica ni datos)

```
Aplicá el rediseño completo a Clientes y Animales usando los componentes de src/components/ui/. La lógica y las consultas a Supabase quedan exactamente iguales.

CLIENTES (src/components/Clientes.jsx):
1. Formulario de alta/edición con el nuevo estilo y el buscador general arriba de la tabla.
2. Tabla con DataTable y badges.
3. Nuevo: al hacer clic en el nombre de un cliente se abre un Modal centrado "Ficha del cliente" con sus datos y pestañas internas: Datos, Animales en pastura (resumen), e Historial de cobros. Más adelante se le suma la pestaña Ventas. Todo de solo lectura, con botón Editar que lleva al formulario.

ANIMALES (src/components/Animales.jsx):
1. Mismo reskin: formulario, botones Salida/Baja/Eliminar/Guardar con la nueva paleta, pestañas Animales activos / Bajas y Salidas con el estilo de pestañas nuevo, tabla con DataTable manteniendo TODAS las columnas y la franja azul de totales con el desglose por categoría y el total con IVA tal como está hoy.
2. El selector de cliente del formulario pasa a usar el SearchSelect mejorado: se escribe el nombre o el RUC y aparece el cliente.
3. Las confirmaciones de eliminar/baja pasan a ConfirmDialog.

No cambies ningún cálculo ni ningún campo de la base. npm run build y commit.
```

---

## PROMPT 4 — Rediseño de Cobros, Reportes, Configuración, Perfil y Login

```
Continuá el rediseño con el resto de las pantallas existentes, sin tocar lógica ni datos:

COBROS (src/components/Cobros.jsx):
1. Tarjetas superiores con StatCard, pestañas Pagos / Recibos / Créditos con el estilo nuevo, tablas con DataTable y badges.
2. "Ver detalle" de un pago y "Ver PDF" de un recibo se abren primero en un Modal centrado con la información del registro y ahí adentro el botón para imprimir/descargar (el mecanismo de ventana + window.print se mantiene, no lo cambies en esta etapa).
3. Los botones de asignar/reasignar créditos y eliminar usan Modal y ConfirmDialog.

REPORTES (src/components/Reportes.jsx):
- Solo reskin visual del formulario y de la vista del reporte en pantalla. La lógica de generación, el CSV y el PDF actual quedan como están (se mejoran en la etapa 11).

CONFIGURACIÓN, USUARIOS y PERFIL:
- Reskin de las pestañas General/Categorías/Usuarios, del CRUD de categorías, de la gestión de usuarios y permisos (checkboxes con el estilo nuevo) y de Mi Perfil.

LOGIN:
- Pantalla de acceso renovada: logo, tarjeta centrada, fondo con el azul del sistema. Misma lógica de autenticación.

npm run build y commit. Al final dame una lista de verificación manual para que yo pruebe que todo lo existente sigue funcionando igual.
```

---

## PROMPT 5 — Dashboard nuevo: vista completa sin scroll

```
Rediseñá el Dashboard (src/components/Dashboard.jsx) para que en escritorio entre COMPLETO en la pantalla, sin scroll vertical. Reglas:

1. Estructura con CSS Grid ocupando exactamente la altura disponible (100vh menos paddings): fila 1 un encabezado de bienvenida compacto (saludo con la frase del día que ya existe, fecha, y botones rápidos + Nueva venta, + Nuevo gasto, Cobros); fila 2 las tarjetas de resumen; fila 3 el área principal en dos columnas.
2. Columna principal: gráfico de resumen (el LineChart SVG propio que ya existe, adaptado al nuevo estilo) y la tarjeta de Animales en pastura compacta con los chips por categoría.
3. Columna derecha: Tareas pendientes SIEMPRE visibles, con checkbox circular (.check-circle) para marcar como hecha, el input para agregar tarea y el selector de visibilidad que ya existe; debajo, Actividad reciente / Cobros recientes.
4. Nada de scroll de página en escritorio: si una lista interna (actividad, tareas) tiene muchos elementos, esa tarjeta scrollea POR DENTRO, la página no. Tipografías y paddings compactos para que todo respire pero entre.
5. En pantallas menores a 1100px el grid se apila y ahí sí se permite scroll normal (móvil no cambia de comportamiento).
6. Dejá el grid preparado con espacio para las tarjetas financieras (Ingresos, Gastos, Resultado, Por cobrar) que se conectan en la etapa 11; mientras tanto mostrá las tarjetas actuales (Animales activos, Clientes, Total cobrado, Total pendiente) con StatCard.
7. Eliminá de Actividad reciente los placeholders "Venta de pepinillos — Módulo próximamente" y "Pago a proveedor — Módulo próximamente".

npm run build y commit. Con esto todo el sistema actual ya queda 100% con el diseño nuevo.
```

---

## PROMPT 6 — Base de datos (solo agregar; nada se borra)

```
Ahora sí, la base para Ventas y Gastos. Solo cambios aditivos según CLAUDE.md. Prepará una migración SQL (agregala también a schema.sql como documentación) con:

1. `productos`: id, nombre, unidad ('docena','kg','frasco','unidad','litro'), precio numeric, controla_stock boolean default true, stock_actual numeric default 0, stock_minimo numeric default 0 (para alertas), activo boolean default true, orden int, created_at.
2. `stock_movimientos`: id, producto_id FK, tipo ('entrada_produccion','venta','anulacion_venta','ajuste'), cantidad numeric (positiva o negativa según tipo), fecha, referencia_venta_id nullable, observacion, usuario, created_at. El stock_actual de productos se actualiza con cada movimiento: así el stock siempre tiene historial auditable y se puede corregir con ajustes sin perder rastro.
3. `categorias_gasto`: id, nombre, orden, activo.
4. `cuentas_pago`: id, nombre, tipo ('efectivo'|'banco'), activo. Base del futuro módulo Caja y Bancos.
5. `ventas`: id, numero serial correlativo, fecha, cliente_id FK nullable + cliente_nombre text (para "Consumidor final"), forma_pago ('efectivo'|'transferencia'|'fiado'), cuenta_id FK nullable (dónde entró la plata, solo contado), estado ('pagada'|'pendiente'|'anulada'), fecha_vencimiento nullable, observaciones, total numeric, usuario, created_at.
6. `venta_items`: id, venta_id FK, producto_id FK, cantidad, precio_unitario, subtotal.
7. `venta_cobros`: id, venta_id FK, fecha, monto, forma ('efectivo'|'transferencia'), cuenta_id FK, usuario, created_at (permite cobros parciales de fiados).
8. `gastos`: id, fecha, categoria_id FK, proveedor, descripcion, monto numeric, cuenta_id FK ("pagado desde"), nro_comprobante nullable, usuario, created_at.
9. En `clientes`: ALTER TABLE ... ADD COLUMN tipo text DEFAULT 'pastaje' ('pastaje'|'ventas'|'ambos'). Los clientes existentes quedan como pastaje sin tocar sus datos.
10. Seeds: productos Huevos (docena, 20000), Queso (kg, 40000), Pepinillos 500g (frasco, 20000), Carne (kg, 32000, controla_stock=false); categorías de gasto Proveedores, Insumos de producción, Ganadería y veterinaria, Combustible, Administrativos, Comerciales, Mantenimiento; cuentas Caja chica (efectivo) y Banco — Cuenta principal (banco).
11. Índices razonables (fecha, cliente_id, estado) y políticas RLS consistentes con las tablas existentes.

Mostrame el SQL completo. Cuando confirme, indicame pegarlo en el SQL Editor de Supabase y esperá mi confirmación de que corrió bien antes de seguir. Después actualizá los permisos disponibles en Usuarios.jsx agregando: ver_ventas, crear_ventas, ver_gastos, crear_gastos, ver_stock, exportar_excel. Commit.
```

---

## PROMPT 7 — Configuración: Productos, Categorías de gasto y tipo de cliente

```
Con el diseño nuevo ya establecido:

1. En Configuración agregá la pestaña "Productos": alta/edición (nombre, unidad, precio, ¿controla stock?, stock mínimo, orden) y tabla con stock actual visible. Eliminar = borrado lógico (activo=false) si el producto tiene ventas o movimientos; solo se borra de verdad si nunca se usó, con ConfirmDialog.
2. Pestaña "Categorías de gastos": CRUD simple con el mismo criterio.
3. En Clientes: selector "Tipo de cliente" (Pastaje / Ventas / Pastaje + Ventas) en el formulario y columna con Badge en la tabla. No modifiques los registros existentes: ya tienen 'pastaje' por default.
4. Respetá permisos: estas pestañas solo para Administrador, como el resto de Configuración.

npm run build y commit.
```

---

## PROMPT 8 — Módulo Ventas (con autocompletado y stock)

```
Creá el módulo Ventas (nuevo componente src/components/Ventas.jsx, ítem "Ventas" en el NAV de Layout.jsx entre Animales y Cobros, y su entrada en el mapa de páginas de App.jsx), siguiendo el contenido de la maqueta docs/nongatu-demo-ventas-gastos.html pero con el diseño nuevo:

1. Tarjetas: Ventas de hoy, Ventas del mes, Fiado pendiente, Producto más vendido del mes.
2. Formulario "Nueva venta": fecha (default hoy); CLIENTE con el SearchSelect mejorado — se escribe el nombre o el RUC y lo encuentra al instante entre los clientes de tipo Ventas o Ambos, con la opción fija "Consumidor final" y la opción "+ Crear cliente nuevo…" que abre un Modal con el formulario de cliente y al guardar lo deja seleccionado; renglones de producto (se pueden agregar varios) con cantidad y precio autocompletado desde productos pero editable; total general calculado en vivo con gs(); forma de pago (Contado-Efectivo, Contado-Transferencia → pide cuenta de cuentas_pago; Fiado → pide fecha de vencimiento y muestra el aviso de que quedará pendiente en Cobros); observaciones.
3. Al guardar: inserta venta + venta_items; si es contado queda 'pagada', si es fiado 'pendiente'. Por cada ítem cuyo producto controla stock, registra el movimiento tipo 'venta' en stock_movimientos y descuenta stock_actual. Si el stock queda negativo, avisar con Toast pero permitir (a veces venden antes de cargar la producción). Anular/eliminar una venta revierte el stock con movimientos 'anulacion_venta'.
4. Panel "Productos a la venta": chips con nombre, precio y stock actual; resaltar en naranja los que están por debajo del stock mínimo; botón "+ Producción" que abre un Modal para registrar una entrada de stock (producto, cantidad, fecha, observación) creando el movimiento 'entrada_produccion'.
5. Tabla "Ventas" con filtros (cliente, producto, forma de pago, rango de fechas), badges de pago y estado, franja de totales (Contado / Fiado / Total del período). Clic en una fila abre un Modal centrado "Detalle de venta" con los ítems, los cobros asociados si es fiada, y botones: Imprimir ticket (ventana imprimible con el mismo mecanismo de los recibos, con logo y formato simple) y Anular.
6. En la Ficha del cliente (Modal de Clientes) agregá la pestaña "Ventas" con su historial y su saldo fiado.
7. Permisos: ver_ventas para entrar, crear_ventas para registrar; los administradores todo.

npm run build, commit, y decime cómo probar el flujo completo.
```

---

## PROMPT 9 — Cobros: pestaña "Ventas fiadas"

```
Conectá los fiados con Cobros, sin tocar las pestañas existentes:

1. Cuarta pestaña "Ventas fiadas" en Cobros: lista solo ventas con estado 'pendiente' — n° de venta, cliente, detalle resumido, fecha, vencimiento (resaltar vencidas en rojo), total, cobrado, saldo.
2. Botón "Registrar cobro" abre un Modal: fecha, monto (default el saldo; permite parcial), forma efectivo/transferencia y cuenta. Inserta en venta_cobros; cuando el saldo llega a 0 la venta pasa a 'pagada' y sale de la lista, generando su recibo con el mecanismo y la numeración de recibos existente, indicando que corresponde a venta de productos.
3. Sumá a las tarjetas de Cobros una StatCard "Ventas fiadas" con el saldo total pendiente, sin alterar los cálculos de pastaje.
4. Las tarjetas del futuro dashboard necesitan estos datos: dejá las consultas en funciones reutilizables.

npm run build y commit.
```

---

## PROMPT 10 — Módulo Gastos

```
Creá el módulo Gastos (src/components/Gastos.jsx, ítem en el NAV después de Cobros, entrada en App.jsx):

1. Tarjetas: Gastos del mes, Mayor categoría del mes, Pagado desde Caja chica, Pagado desde Banco.
2. Formulario: fecha, categoría (categorias_gasto), proveedor, descripción, monto, "Pagado desde" (cuentas_pago), n° de comprobante opcional. Todo es al contado: no hay estados pendientes.
3. Tabla con filtros (categoría, proveedor, cuenta, fechas), badges y franja con el total del período. Clic en fila abre Modal de detalle con opción de editar o eliminar (ConfirmDialog; eliminar sí está permitido acá porque es un registro propio, pero pedí confirmación doble).
4. Panel "Gastos del mes por categoría" con barras horizontales.
5. Permisos: ver_gastos / crear_gastos.

npm run build y commit.
```

---

## PROMPT 11 — Reportes completos + PDF prolijo + Excel + Dashboard financiero

```
Etapa final de funcionalidades:

1. REPORTES: ampliá el selector con grupos y este contenido mínimo por reporte (todos con filtros de cliente y rango de fechas, subtotales y total general):
   - Ventas — detallado: fecha, n° venta, cliente, productos y cantidades, forma de pago, estado, total; subtotal por día.
   - Ventas — por producto: producto, cantidad vendida, monto, % del total.
   - Ventas — por cliente: cliente, cantidad de ventas, total comprado, saldo fiado pendiente.
   - Gastos — por categoría: categoría, cantidad de comprobantes, monto, % del total; y — por proveedor.
   - Finanzas — Ingresos vs gastos: tabla por mes con pastaje cobrado, ventas, total ingresos, gastos y resultado.
   - Finanzas — Cuentas por cobrar: cada fiado pendiente con días de atraso, más el pastaje pendiente.
   - Ganadería: los reportes actuales tal como están.

2. PDF: unificá una plantilla imprimible común (usada por recibos, tickets y reportes) con logo, título, rango de fechas, "Generado por [usuario] el [fecha y hora]", tablas limpias y pie de página, usando el mecanismo actual de ventana + window.print con estilos @media print prolijos (márgenes A4, sin cortar filas). El botón dice "Exportar PDF" y abre la vista de impresión donde se guarda como PDF.

3. EXCEL: instalá la librería xlsx (SheetJS) y agregá "Exportar Excel" a todos los reportes: archivo .xlsx real con encabezados, columnas numéricas como números (no texto), anchos razonables y una fila de totales. Mantené también el CSV actual. Respetá los permisos exportar_pdf / exportar_csv y el nuevo exportar_excel.

4. DASHBOARD: conectá las tarjetas financieras en el espacio reservado: Ingresos del mes (pastaje cobrado + ventas, con desglose), Gastos del mes, Resultado del mes, Por cobrar (fiados + pastaje pendiente, con desglose); mini-indicadores de Ventas de hoy y stock del producto principal; y el gráfico "Ventas del mes por producto". Actividad reciente pasa a mezclar eventos reales de ventas, gastos y cobros. TODO debe seguir entrando en pantalla completa sin scroll en escritorio: si hace falta, compactá.

npm run build y commit.
```

---

## PROMPT 12 — Verificación final y deploy

```
Revisión final antes de publicar:

1. Probá el flujo completo: crear producto → registrar producción (entrada de stock) → venta al contado escribiendo el RUC del cliente → venta fiada → cobrarla parcial y total desde Cobros con su recibo → registrar gastos → revisar dashboard (pantalla completa, sin scroll, tareas con círculo funcionando, sidebar colapsando y expandiendo) → generar cada reporte y exportarlo a PDF y a Excel → verificar la ficha del cliente con su pestaña de ventas.
2. Verificá que todo lo preexistente (animales, cobros de pastaje, recibos, créditos, usuarios, permisos, perfil, login) funcione igual que en main. Probá también en un ancho de móvil.
3. Confirmá que ninguna migración tocó datos existentes: los conteos de filas de las tablas viejas deben ser idénticos a los de antes.
4. npm run build sin errores ni warnings importantes.
5. Resumime en español: qué cambió, qué tablas nuevas hay, qué permisos nuevos hay que asignar a cada usuario en Gestión de usuarios, qué quedó pendiente, y los pasos exactos para merge de redisenio-v2 a main y deploy a Netlify. No hagas merge ni deploy sin mi confirmación.
```

---

## Recordatorios

- Respaldo de Supabase ANTES del Prompt 6 (Database → Backups, o exportar las tablas a CSV). Hasta ahí todo es frontend y no toca datos.
- Si algo sale mal, main y la base quedan intactas: la rama se descarta y listo.
- Salarios y Caja y Bancos siguen planificados para después: la tabla cuentas_pago y los campos de forma de pago ya dejan todo preparado.
