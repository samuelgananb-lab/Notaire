-- Ejecutar una vez en Supabase antes de desplegar el backend.
-- Registra entregas, serializa ejecuciones simultáneas y conserva reintentos.

alter table if exists public.eventos_calendario
    add column if not exists notification_version bigint not null default 1;

alter table if exists public.recordatorios
    add column if not exists notification_version bigint not null default 1;

alter table if exists public.metas
    add column if not exists notification_version bigint not null default 1;

create table if not exists public.notification_deliveries (
    source_type text not null,
    source_id text not null,
    notification_type text not null,
    source_version text not null,
    status text not null check (status in ('processing', 'pending', 'sent')),
    claim_token uuid,
    attempts integer not null default 0,
    lease_until timestamptz,
    next_attempt_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    sent_at timestamptz,
    primary key (source_type, source_id, notification_type, source_version)
);

create index if not exists idx_notification_deliveries_retry
    on public.notification_deliveries(status, next_attempt_at)
    where status = 'pending';

alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select, insert, update on table public.notification_deliveries to service_role;

create or replace function public.bump_notification_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if TG_TABLE_NAME = 'eventos_calendario' then
        if old.fecha is distinct from new.fecha
            or old.hora is distinct from new.hora
            or (not old.notif24h and new.notif24h)
            or (not old.notif1h and new.notif1h)
            or (not old.notifonday and new.notifonday)
            or (old.notif24_sent and not new.notif24_sent)
            or (old.notif1h_sent and not new.notif1h_sent)
            or (old.notifonday_sent and not new.notifonday_sent) then
            new.notification_version := old.notification_version + 1;
        end if;
    elsif TG_TABLE_NAME = 'recordatorios' then
        if (old.estado is distinct from new.estado and new.estado = 'pendiente')
            or (old.email_24h_sent and not new.email_24h_sent)
            or (old.email_due_sent and not new.email_due_sent) then
            new.notification_version := old.notification_version + 1;
        end if;
    elsif TG_TABLE_NAME = 'metas' then
        if old.fecha_limite is distinct from new.fecha_limite then
            new.notification_version := old.notification_version + 1;
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists eventos_calendario_notification_version on public.eventos_calendario;
create trigger eventos_calendario_notification_version
before update on public.eventos_calendario
for each row execute function public.bump_notification_version();

drop trigger if exists recordatorios_notification_version on public.recordatorios;
create trigger recordatorios_notification_version
before update on public.recordatorios
for each row execute function public.bump_notification_version();

drop trigger if exists metas_notification_version on public.metas;
create trigger metas_notification_version
before update on public.metas
for each row execute function public.bump_notification_version();

create or replace function public.claim_notification_delivery(
    p_source_type text,
    p_source_id text,
    p_notification_type text,
    p_source_version text,
    p_claim_token uuid,
    p_lease_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_claimed boolean;
    v_status text;
begin
    if nullif(p_source_type, '') is null
        or nullif(p_source_id, '') is null
        or nullif(p_notification_type, '') is null
        or nullif(p_source_version, '') is null
        or p_claim_token is null then
        raise exception 'Los datos de la reclamación del aviso son obligatorios';
    end if;

    insert into public.notification_deliveries (
        source_type, source_id, notification_type, source_version,
        status, claim_token, attempts, lease_until, next_attempt_at, last_error, updated_at
    )
    values (
        p_source_type, p_source_id, p_notification_type, p_source_version,
        'processing', p_claim_token, 1,
        now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 900))),
        null, null, now()
    )
    on conflict (source_type, source_id, notification_type, source_version)
    do update set
        status = 'processing',
        claim_token = excluded.claim_token,
        attempts = notification_deliveries.attempts + 1,
        lease_until = excluded.lease_until,
        next_attempt_at = null,
        last_error = null,
        updated_at = now()
    where notification_deliveries.status <> 'sent'
        and (notification_deliveries.status <> 'processing'
            or notification_deliveries.lease_until <= now())
        and (notification_deliveries.next_attempt_at is null
            or notification_deliveries.next_attempt_at <= now())
    returning true into v_claimed;

    if found then
        return 'claimed';
    end if;

    select status into v_status
    from public.notification_deliveries
    where source_type = p_source_type
        and source_id = p_source_id
        and notification_type = p_notification_type
        and source_version = p_source_version;

    if v_status = 'sent' then
        return 'sent';
    end if;
    return 'busy';
end;
$$;

create or replace function public.complete_notification_delivery(
    p_source_type text,
    p_source_id text,
    p_notification_type text,
    p_source_version text,
    p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    update public.notification_deliveries
    set status = 'sent',
        claim_token = null,
        lease_until = null,
        next_attempt_at = null,
        last_error = null,
        sent_at = now(),
        updated_at = now()
    where source_type = p_source_type
        and source_id = p_source_id
        and notification_type = p_notification_type
        and source_version = p_source_version
        and claim_token = p_claim_token
        and status = 'processing';

    return found;
end;
$$;

create or replace function public.release_notification_delivery(
    p_source_type text,
    p_source_id text,
    p_notification_type text,
    p_source_version text,
    p_claim_token uuid,
    p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    update public.notification_deliveries
    set status = 'pending',
        claim_token = null,
        lease_until = null,
        next_attempt_at = now() + make_interval(
            secs => least(3600, greatest(30, 30 * power(2, least(attempts - 1, 7)))::integer)
        ),
        last_error = left(coalesce(nullif(p_error, ''), 'Envío no confirmado'), 1000),
        updated_at = now()
    where source_type = p_source_type
        and source_id = p_source_id
        and notification_type = p_notification_type
        and source_version = p_source_version
        and claim_token = p_claim_token
        and status = 'processing';

    return found;
end;
$$;

revoke all on function public.bump_notification_version() from public, anon, authenticated;
revoke all on function public.claim_notification_delivery(text, text, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.release_notification_delivery(text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(text, text, text, text, uuid, integer) to service_role;
grant execute on function public.complete_notification_delivery(text, text, text, text, uuid) to service_role;
grant execute on function public.release_notification_delivery(text, text, text, text, uuid, text) to service_role;

-- Supabase Dashboard > Integrations > Vault:
-- guarda los secretos notaire_cron_url y notaire_cron_secret antes de programar.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
    v_job_id bigint;
begin
    select jobid into v_job_id
    from cron.job
    where jobname = 'notaire-notifications-every-minute'
    limit 1;

    if v_job_id is not null then
        perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
        'notaire-notifications-every-minute',
        '* * * * *',
        $job$
        select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'notaire_cron_url'),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (
                    select decrypted_secret from vault.decrypted_secrets where name = 'notaire_cron_secret'
                )
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 10000
        );
        $job$
    );
end;
$$;
