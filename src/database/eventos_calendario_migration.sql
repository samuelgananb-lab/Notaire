-- Campos necesarios para eventos persistentes y recordatorios.
-- Ejecutar una vez en Supabase SQL Editor.

alter table if exists public.eventos_calendario
    add column if not exists fecha date;

alter table if exists public.eventos_calendario
    add column if not exists hora time;

alter table if exists public.eventos_calendario
    add column if not exists fecha_hora timestamptz;

alter table if exists public.eventos_calendario
    add column if not exists nota text;

alter table if exists public.eventos_calendario
    add column if not exists notif24h boolean not null default true;

alter table if exists public.eventos_calendario
    add column if not exists notif1h boolean not null default true;

alter table if exists public.eventos_calendario
    add column if not exists notifonday boolean not null default false;

create index if not exists idx_eventos_calendario_usuario_fecha
    on public.eventos_calendario(usuario_id, fecha);
