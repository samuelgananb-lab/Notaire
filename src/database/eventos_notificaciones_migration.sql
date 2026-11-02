-- Campos de control para no enviar dos veces el mismo correo.
-- Ejecutar una vez en Supabase SQL Editor.

alter table if exists public.eventos_calendario
    add column if not exists notif24_sent boolean not null default false;

alter table if exists public.eventos_calendario
    add column if not exists notif1h_sent boolean not null default false;

alter table if exists public.eventos_calendario
    add column if not exists notifonday_sent boolean not null default false;

alter table if exists public.eventos_calendario
    add column if not exists estado varchar(30) not null default 'pendiente';

