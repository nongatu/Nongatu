-- =====================================================================
-- ÑONGATU — MIGRACIÓN: MÓDULOS DE VENTAS Y GASTOS
-- =====================================================================
-- 100% ADITIVA: solo crea tablas nuevas y agrega UNA columna con valor
-- por defecto en `clientes`. NO borra, NO modifica y NO toca ningún
-- dato existente (especies, categorias, usuarios, clientes, animales,
-- movimientos, cobros, cobro_detalles, pagos, recibos y tareas quedan
-- exactamente igual).
--
-- Cómo aplicarla: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar más de una vez sin duplicar nada (es idempotente).
-- Sigue las convenciones del schema.sql actual del proyecto (SERIAL,
-- VARCHAR, TIMESTAMPTZ, sin políticas RLS, igual que las tablas de hoy).
-- =====================================================================


-- ---------------------------------------------------------------
-- 1. PRODUCTOS A LA VENTA (huevos, queso, pepinillos, carne, ...)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  unidad VARCHAR(20) NOT NULL DEFAULT 'unidad',      -- docena | kg | frasco | unidad | litro
  precio NUMERIC(12,0) NOT NULL DEFAULT 0,           -- guaraníes, sin decimales
  controla_stock BOOLEAN NOT NULL DEFAULT TRUE,
  stock_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,     -- para la alerta de stock bajo
  activo BOOLEAN NOT NULL DEFAULT TRUE,              -- borrado lógico
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 2. MOVIMIENTOS DE STOCK (el stock nunca se edita a mano:
--    cada cambio queda registrado y es auditable)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo VARCHAR(30) NOT NULL,                         -- entrada_produccion | venta | anulacion_venta | ajuste
  cantidad NUMERIC(12,2) NOT NULL,                   -- positiva suma, negativa resta
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  venta_id INTEGER,                                  -- referencia opcional a la venta que lo generó
  observacion TEXT,
  usuario VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 3. CATEGORÍAS DE GASTO
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_gasto (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------
-- 4. CUENTAS DE PAGO (de dónde sale / a dónde entra la plata;
--    base del futuro módulo "Caja y Bancos")
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuentas_pago (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL DEFAULT 'efectivo',      -- efectivo | banco
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------
-- 5. VENTAS (cabecera) — numeración correlativa propia
-- ---------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS ventas_numero_seq START 1;

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL DEFAULT nextval('ventas_numero_seq'),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente_id INTEGER REFERENCES clientes(id),        -- NULL = Consumidor final
  cliente_nombre VARCHAR(255) NOT NULL DEFAULT 'Consumidor final',
  forma_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo',-- efectivo | transferencia | fiado
  cuenta_id INTEGER REFERENCES cuentas_pago(id),     -- solo contado: dónde entró la plata
  estado VARCHAR(20) NOT NULL DEFAULT 'pagada',      -- pagada | pendiente | anulada
  fecha_vencimiento DATE,                            -- solo fiado
  observaciones TEXT,
  total NUMERIC(14,0) NOT NULL DEFAULT 0,
  usuario VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 6. ÍTEMS DE CADA VENTA (una venta puede tener varios productos)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_items (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,0) NOT NULL,
  subtotal NUMERIC(14,0) NOT NULL
);

-- ---------------------------------------------------------------
-- 7. COBROS DE VENTAS FIADAS (permite cobros parciales)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_cobros (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(14,0) NOT NULL,
  forma VARCHAR(20) NOT NULL DEFAULT 'efectivo',     -- efectivo | transferencia
  cuenta_id INTEGER REFERENCES cuentas_pago(id),
  usuario VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 8. GASTOS (todo al contado: sin cuentas por pagar)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria_id INTEGER REFERENCES categorias_gasto(id),
  proveedor VARCHAR(255),
  descripcion TEXT NOT NULL,
  monto NUMERIC(14,0) NOT NULL,
  cuenta_id INTEGER REFERENCES cuentas_pago(id),     -- "pagado desde"
  nro_comprobante VARCHAR(50),
  usuario VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 9. TIPO DE CLIENTE — única modificación a una tabla existente:
--    SOLO AGREGA una columna con valor por defecto. Todos los
--    clientes actuales quedan como 'pastaje' sin tocar sus datos.
-- ---------------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'pastaje';
  -- valores: pastaje | ventas | ambos

-- ---------------------------------------------------------------
-- 10. ÍNDICES
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ventas_fecha        ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente      ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado       ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta   ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_cobros_venta  ON venta_cobros(venta_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha        ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria    ON gastos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_stockmov_producto   ON stock_movimientos(producto_id);

-- ---------------------------------------------------------------
-- 11. DATOS INICIALES (si ya existen, no se duplican)
-- ---------------------------------------------------------------
INSERT INTO productos (nombre, unidad, precio, controla_stock, stock_minimo, orden) VALUES
  ('Huevos',          'docena', 20000, TRUE,  20, 1),
  ('Queso',           'kg',     40000, TRUE,   5, 2),
  ('Pepinillos 500g', 'frasco', 20000, TRUE,  10, 3),
  ('Carne',           'kg',     32000, FALSE,  0, 4)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO categorias_gasto (nombre, orden) VALUES
  ('Proveedores',              1),
  ('Insumos de producción',    2),
  ('Ganadería y veterinaria',  3),
  ('Combustible',              4),
  ('Administrativos',          5),
  ('Comerciales',              6),
  ('Mantenimiento',            7)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cuentas_pago (nombre, tipo) VALUES
  ('Caja chica',               'efectivo'),
  ('Banco — Cuenta principal', 'banco')
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================================
-- FIN. Verificación rápida (opcional): estas consultas deben devolver
-- las tablas nuevas con sus datos iniciales, y los conteos de las
-- tablas viejas deben ser idénticos a los de antes de la migración.
--
--   SELECT * FROM productos ORDER BY orden;
--   SELECT * FROM categorias_gasto ORDER BY orden;
--   SELECT * FROM cuentas_pago;
--   SELECT COUNT(*) FROM clientes;   -- mismo número que antes
--   SELECT COUNT(*) FROM animales;   -- mismo número que antes
--   SELECT COUNT(*) FROM pagos;      -- mismo número que antes
-- =====================================================================
