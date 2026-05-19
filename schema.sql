-- =============================================
-- ÑONGATU - ESQUEMA DE BASE DE DATOS
-- Correr en Supabase → SQL Editor → New query
-- =============================================

CREATE TABLE IF NOT EXISTS especies (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  especie_id INTEGER REFERENCES especies(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  cobrable BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre_usuario VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'Usuario',
  activo BOOLEAN DEFAULT TRUE,
  permisos JSONB DEFAULT '{}',
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre_razon_social VARCHAR(255) NOT NULL,
  cedula VARCHAR(50),
  ruc VARCHAR(50),
  direccion TEXT,
  telefono VARCHAR(50),
  email VARCHAR(255),
  fecha_alta DATE DEFAULT CURRENT_DATE,
  ultima_modificacion TIMESTAMPTZ,
  modificado_por VARCHAR(100),
  creado_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS animales (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categorias(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  fecha_ingreso DATE NOT NULL,
  precio DECIMAL(15,0) NOT NULL DEFAULT 0,
  observaciones TEXT,
  estado VARCHAR(20) DEFAULT 'activo',
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  animal_id INTEGER REFERENCES animales(id),
  cliente_id INTEGER REFERENCES clientes(id),
  tipo VARCHAR(30) NOT NULL,
  categoria_anterior_id INTEGER REFERENCES categorias(id),
  categoria_nueva_id INTEGER REFERENCES categorias(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  causa VARCHAR(100),
  observacion TEXT,
  precio_nuevo DECIMAL(15,0),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cobros (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  periodo VARCHAR(7) NOT NULL,
  fecha_generacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,
  gravada DECIMAL(15,0) NOT NULL DEFAULT 0,
  iva DECIMAL(15,0) NOT NULL DEFAULT 0,
  total DECIMAL(15,0) NOT NULL DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cobro_detalles (
  id SERIAL PRIMARY KEY,
  cobro_id INTEGER REFERENCES cobros(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categorias(id),
  cantidad INTEGER NOT NULL,
  precio_unitario DECIMAL(15,0) NOT NULL,
  subtotal DECIMAL(15,0) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  cobro_id INTEGER REFERENCES cobros(id),
  monto DECIMAL(15,0) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  fecha_pago TIMESTAMPTZ DEFAULT NOW(),
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recibos (
  id SERIAL PRIMARY KEY,
  pago_id INTEGER REFERENCES pagos(id),
  numero VARCHAR(10) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente_id INTEGER REFERENCES clientes(id),
  total DECIMAL(15,0) NOT NULL,
  detalle JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DATOS INICIALES
-- =============================================

INSERT INTO especies (nombre) VALUES ('Bovinos');

INSERT INTO categorias (especie_id, nombre, cobrable, orden) VALUES
(1, 'Vaca', TRUE, 7),
(1, 'Toro', TRUE, 8),
(1, 'Novillo', TRUE, 6),
(1, 'Vaquilla', TRUE, 5),
(1, 'Desmamante Macho', TRUE, 3),
(1, 'Desmamante Hembra', TRUE, 4),
(1, 'Ternero Macho', FALSE, 1),
(1, 'Ternero Hembra', FALSE, 2);

-- Usuario admin por defecto (contraseña: admin123)
INSERT INTO usuarios (nombre_usuario, password_hash, rol, activo, permisos) VALUES
('admin', 'admin123', 'Administrador', TRUE,
 '{"ver_clientes":true,"ver_animales":true,"ver_cobros":true,"ver_reportes":true,
   "crear_editar_clientes":true,"registrar_animales":true,"generar_cobros":true,
   "registrar_pagos":true,"eliminar_anular":true,"exportar_pdf":true,"exportar_csv":true}');
