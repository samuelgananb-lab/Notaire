-- Evita reenviar avisos de vencimiento en cada ciclo del cron.
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table if exists public.recordatorios
    add column if not exists email_24h_sent boolean not null default false;

alter table if exists public.recordatorios
    add column if not exists email_due_sent boolean not null default false;
