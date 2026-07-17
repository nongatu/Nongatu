-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.especies (
  id integer NOT NULL DEFAULT nextval('especies_id_seq'::regclass),
  nombre character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT especies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categorias (
  id integer NOT NULL DEFAULT nextval('categorias_id_seq'::regclass),
  especie_id integer,
  nombre character varying NOT NULL,
  cobrable boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categorias_pkey PRIMARY KEY (id),
  CONSTRAINT categorias_especie_id_fkey FOREIGN KEY (especie_id) REFERENCES public.especies(id)
);
CREATE TABLE public.usuarios (
  id integer NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
  nombre_usuario character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  rol character varying NOT NULL DEFAULT 'Usuario'::character varying,
  activo boolean DEFAULT true,
  permisos jsonb DEFAULT '{}'::jsonb,
  fecha_creacion timestamp with time zone DEFAULT now(),
  foto_url text,
  perfil jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clientes (
  id integer NOT NULL DEFAULT nextval('clientes_id_seq'::regclass),
  nombre_razon_social character varying NOT NULL,
  cedula character varying,
  ruc character varying,
  direccion text,
  telefono character varying,
  email character varying,
  fecha_alta date DEFAULT CURRENT_DATE,
  ultima_modificacion timestamp with time zone,
  modificado_por character varying,
  creado_por integer,
  created_at timestamp with time zone DEFAULT now(),
  tipo character varying NOT NULL DEFAULT 'pastaje'::character varying,
  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id)
);
CREATE TABLE public.animales (
  id integer NOT NULL DEFAULT nextval('animales_id_seq'::regclass),
  cliente_id integer,
  categoria_id integer,
  cantidad integer NOT NULL DEFAULT 1,
  fecha_ingreso date NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  observaciones text,
  estado character varying DEFAULT 'activo'::character varying,
  fecha_registro timestamp with time zone DEFAULT now(),
  usuario_id integer,
  created_at timestamp with time zone DEFAULT now(),
  fecha_inicio_cobro date,
  cobrar_proporcional boolean DEFAULT false,
  fecha_baja date,
  CONSTRAINT animales_pkey PRIMARY KEY (id),
  CONSTRAINT animales_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT animales_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT animales_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.movimientos (
  id integer NOT NULL DEFAULT nextval('movimientos_id_seq'::regclass),
  animal_id integer,
  cliente_id integer,
  tipo character varying NOT NULL,
  categoria_anterior_id integer,
  categoria_nueva_id integer,
  cantidad integer NOT NULL DEFAULT 1,
  causa character varying,
  observacion text,
  precio_nuevo numeric,
  fecha timestamp with time zone DEFAULT now(),
  usuario_id integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT movimientos_pkey PRIMARY KEY (id),
  CONSTRAINT movimientos_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animales(id),
  CONSTRAINT movimientos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT movimientos_categoria_anterior_id_fkey FOREIGN KEY (categoria_anterior_id) REFERENCES public.categorias(id),
  CONSTRAINT movimientos_categoria_nueva_id_fkey FOREIGN KEY (categoria_nueva_id) REFERENCES public.categorias(id),
  CONSTRAINT movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.cobros (
  id integer NOT NULL DEFAULT nextval('cobros_id_seq'::regclass),
  cliente_id integer,
  periodo character varying NOT NULL,
  fecha_generacion date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date NOT NULL,
  gravada numeric NOT NULL DEFAULT 0,
  iva numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  estado character varying DEFAULT 'pendiente'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cobros_pkey PRIMARY KEY (id),
  CONSTRAINT cobros_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.cobro_detalles (
  id integer NOT NULL DEFAULT nextval('cobro_detalles_id_seq'::regclass),
  cobro_id integer,
  categoria_id integer,
  cantidad integer NOT NULL,
  precio_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cobro_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT cobro_detalles_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.cobros(id),
  CONSTRAINT cobro_detalles_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id)
);
CREATE TABLE public.pagos (
  id integer NOT NULL DEFAULT nextval('pagos_id_seq'::regclass),
  cobro_id integer,
  monto numeric NOT NULL,
  tipo character varying NOT NULL,
  fecha_pago timestamp with time zone DEFAULT now(),
  usuario_id integer,
  created_at timestamp with time zone DEFAULT now(),
  medio_pago character varying DEFAULT 'efectivo'::character varying,
  credito_id integer,
  CONSTRAINT pagos_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.cobros(id),
  CONSTRAINT pagos_credito_id_fkey FOREIGN KEY (credito_id) REFERENCES public.creditos_cliente(id),
  CONSTRAINT pagos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.recibos (
  id integer NOT NULL DEFAULT nextval('recibos_id_seq'::regclass),
  pago_id integer,
  numero character varying NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id integer,
  total numeric NOT NULL,
  detalle jsonb,
  created_at timestamp with time zone DEFAULT now(),
  cobro_id integer,
  CONSTRAINT recibos_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES public.pagos(id),
  CONSTRAINT recibos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT recibos_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.cobros(id)
);
CREATE TABLE public.creditos_cliente (
  id integer NOT NULL DEFAULT nextval('creditos_cliente_id_seq'::regclass),
  cliente_id integer,
  monto numeric NOT NULL,
  fecha_pago date NOT NULL,
  periodo_aplicar character varying,
  observacion text,
  aplicado boolean DEFAULT false,
  cobro_id integer,
  usuario_id integer,
  created_at timestamp with time zone DEFAULT now(),
  medio_pago character varying DEFAULT 'efectivo'::character varying,
  CONSTRAINT creditos_cliente_pkey PRIMARY KEY (id),
  CONSTRAINT creditos_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT creditos_cliente_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.cobros(id),
  CONSTRAINT creditos_cliente_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.tareas (
  id integer NOT NULL DEFAULT nextval('tareas_id_seq'::regclass),
  texto text NOT NULL,
  hecha boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  visibilidad text DEFAULT 'admin'::text,
  CONSTRAINT tareas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.productos (
  id integer NOT NULL DEFAULT nextval('productos_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  unidad character varying NOT NULL DEFAULT 'unidad'::character varying,
  precio numeric NOT NULL DEFAULT 0,
  controla_stock boolean NOT NULL DEFAULT true,
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT productos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stock_movimientos (
  id integer NOT NULL DEFAULT nextval('stock_movimientos_id_seq'::regclass),
  producto_id integer NOT NULL,
  tipo character varying NOT NULL,
  cantidad numeric NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  venta_id integer,
  observacion text,
  usuario character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_movimientos_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movimientos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.categorias_gasto (
  id integer NOT NULL DEFAULT nextval('categorias_gasto_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT categorias_gasto_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cuentas_pago (
  id integer NOT NULL DEFAULT nextval('cuentas_pago_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  tipo character varying NOT NULL DEFAULT 'efectivo'::character varying,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT cuentas_pago_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ventas (
  id integer NOT NULL DEFAULT nextval('ventas_id_seq'::regclass),
  numero integer NOT NULL DEFAULT nextval('ventas_numero_seq'::regclass),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id integer,
  cliente_nombre character varying NOT NULL DEFAULT 'Consumidor final'::character varying,
  forma_pago character varying NOT NULL DEFAULT 'efectivo'::character varying,
  cuenta_id integer,
  estado character varying NOT NULL DEFAULT 'pagada'::character varying,
  fecha_vencimiento date,
  observaciones text,
  total numeric NOT NULL DEFAULT 0,
  usuario character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ventas_pkey PRIMARY KEY (id),
  CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT ventas_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_pago(id)
);
CREATE TABLE public.venta_items (
  id integer NOT NULL DEFAULT nextval('venta_items_id_seq'::regclass),
  venta_id integer NOT NULL,
  producto_id integer NOT NULL,
  cantidad numeric NOT NULL,
  precio_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  CONSTRAINT venta_items_pkey PRIMARY KEY (id),
  CONSTRAINT venta_items_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT venta_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.venta_cobros (
  id integer NOT NULL DEFAULT nextval('venta_cobros_id_seq'::regclass),
  venta_id integer NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL,
  forma character varying NOT NULL DEFAULT 'efectivo'::character varying,
  cuenta_id integer,
  usuario character varying,
  created_at timestamp with time zone DEFAULT now(),
  credito_id integer,
  CONSTRAINT venta_cobros_pkey PRIMARY KEY (id),
  CONSTRAINT venta_cobros_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT venta_cobros_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_pago(id),
  CONSTRAINT venta_cobros_credito_id_fkey FOREIGN KEY (credito_id) REFERENCES public.creditos_cliente(id)
);
CREATE TABLE public.gastos (
  id integer NOT NULL DEFAULT nextval('gastos_id_seq'::regclass),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  categoria_id integer,
  proveedor character varying,
  descripcion text NOT NULL,
  monto numeric NOT NULL,
  cuenta_id integer,
  nro_comprobante character varying,
  usuario character varying,
  created_at timestamp with time zone DEFAULT now(),
  proveedor_id integer,
  CONSTRAINT gastos_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gasto(id),
  CONSTRAINT gastos_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_pago(id),
  CONSTRAINT gastos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id)
);
CREATE TABLE public.proveedores (
  id integer NOT NULL DEFAULT nextval('proveedores_id_seq'::regclass),
  nombre_razon_social character varying NOT NULL,
  ruc character varying,
  cedula character varying,
  rubro character varying,
  telefono character varying,
  email character varying,
  direccion text,
  observaciones text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT proveedores_pkey PRIMARY KEY (id)
);
