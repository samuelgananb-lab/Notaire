-- Estado requerido por el centro de notificaciones administrativas.
-- Ejecutar una vez en Supabase SQL Editor.

alter table if exists public.eventos_calendario
    add column if not exists estado varchar(30) not null default 'pendiente';

