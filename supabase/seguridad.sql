-- =====================================================================
--  MiTecmm · Auditoría y endurecimiento de Supabase
--  Ejecutar en: Supabase Dashboard > SQL Editor
--
--  PARTE A: solo lectura (no cambia nada). Ejecútala primero y revisa.
--  PARTE B: correcciones. Ejecútala SOLO después de revisar la Parte A.
-- =====================================================================


-- =====================================================================
--  PARTE A · AUDITORÍA (solo lectura)
-- =====================================================================

-- A1. ¿Tienen RLS activado las tablas? (relrowsecurity debe ser true)
select relname as tabla, relrowsecurity as rls_activo, relforcerowsecurity as rls_forzado
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;

-- A2. Políticas existentes en tablas públicas.
--     Busca políticas con cmd = INSERT / UPDATE / DELETE / ALL para anon o public: NO deberían existir.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- A3. Permisos (GRANT) de los roles públicos sobre las tablas.
--     anon / authenticated solo deberían tener SELECT.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- A4. Función de búsqueda: ¿es SECURITY DEFINER? (prosecdef = true)
--     Si lo es, se ejecuta con permisos del dueño y salta RLS.
select p.proname, p.prosecdef as security_definer, p.proconfig as configuracion
from pg_proc p
where p.proname = 'buscar_docentes_v3';

-- A5. Definición completa de la función (cópiala y compártela para revisarla).
select pg_get_functiondef('public.buscar_docentes_v3'::regproc);

-- A6. Bucket de planos: público, límite de tamaño y tipos permitidos.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets;

-- A7. Políticas de Storage. Ninguna política INSERT / UPDATE / DELETE
--     debería aplicar a anon/public sobre el bucket 'Maps'.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd;


-- =====================================================================
--  PARTE B · CORRECCIONES  (APLICADAS el 2026-11-02)
--
--  Hallazgos de la auditoría que motivaron estos cambios:
--  · RLS activo en todas las tablas, solo con políticas SELECT (bien).
--  · anon/authenticated tenían INSERT/UPDATE/DELETE/TRUNCATE en todas las
--    tablas: RLS bloqueaba filas, pero TRUNCATE no pasa por RLS.
--  · buscar_docentes_v3 hacía SELECT * (exponía origen_pdf).
--  · docentes.nomina era legible públicamente.
--  · Bucket Maps sin límite de tamaño ni de tipo de archivo.
--
--  Nota: la administración se hace desde el Dashboard o con la service_role
--  key (nunca en la app). Estos cambios no la afectan.
-- =====================================================================
begin;

-- 1. Sin permisos de escritura para visitantes (actuales y futuras tablas).
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

-- 2. Vista pública de horarios con solo las columnas que usa la app.
create or replace view public.horarios_publicos
  with (security_invoker = true) as
  select id, docente, materia, grupo, dia, hora_inicio, hora_fin, aula
  from public.horarios_docentes;

grant select on public.horarios_publicos to anon, authenticated;

-- 3. Búsqueda (sin acentos) que devuelve solo columnas públicas.
drop function if exists public.buscar_docentes_v3(text);

create function public.buscar_docentes_v3(search_term text)
returns setof public.horarios_publicos
language sql
stable
set search_path = public, extensions
as $$
  select *
  from public.horarios_publicos
  where unaccent(docente) ilike unaccent('%' || left(search_term, 60) || '%')
     or unaccent(materia) ilike unaccent('%' || left(search_term, 60) || '%');
$$;

grant execute on function public.buscar_docentes_v3(text) to anon, authenticated;

-- 4. Columnas internas ocultas a los visitantes.
revoke select on public.horarios_docentes from anon, authenticated;
grant select (id, docente, materia, grupo, dia, hora_inicio, hora_fin, aula)
  on public.horarios_docentes to anon, authenticated;

revoke select on public.docentes from anon, authenticated;
grant select (id, nombre, grado, carrera_id)
  on public.docentes to anon, authenticated;

-- 5. Bucket de planos: solo SVG, máximo 2 MB.
update storage.buckets
set allowed_mime_types = array['image/svg+xml'],
    file_size_limit = 2097152
where id = 'Maps';

commit;

notify pgrst, 'reload schema';
