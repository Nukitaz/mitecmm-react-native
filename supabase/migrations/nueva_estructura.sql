-- 1. Tabla Carreras
CREATE TABLE carreras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  siglas text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla Profesores
CREATE TABLE profesores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  carrera_id uuid REFERENCES carreras(id) ON DELETE CASCADE,
  url_horario text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla Horarios Docentes
CREATE TABLE horarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profesor_id uuid REFERENCES profesores(id) ON DELETE CASCADE,
  materia text NOT NULL,
  grupo text NOT NULL,
  dia text NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  aula text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla Avisos
CREATE TABLE avisos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria text NOT NULL,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  fecha text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabla Administradores (Whitelist para inicio de sesión con Google)
CREATE TABLE administradores (
  email text PRIMARY KEY,
  rol text DEFAULT 'admin',
  agregado_por text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO carreras (nombre, siglas) 
VALUES ('Ingeniería en Sistemas Computacionales', 'ISC');

INSERT INTO administradores (email) 
VALUES ('za240120224@zapopan.tecmm.edu.mx');