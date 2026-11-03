-- Rate limiting distribuido para login. Ejecutar manualmente en Supabase.
-- Solo almacena hashes HMAC; no guarda IP, correo, contraseñas ni tokens.

create table if not exists public.login_rate_limit_buckets (
    scope text not null check (scope in ('ip', 'account')),
    identifier_hash text not null check (identifier_hash ~ '^[0-9a-f]{64}$'),
    window_started_at timestamptz not null,
    attempts integer not null check (attempts > 0),
    primary key (scope, identifier_hash)
);

create index if not exists idx_login_rate_limit_window
    on public.login_rate_limit_buckets(window_started_at);

alter table public.login_rate_limit_buckets enable row level security;
revoke all privileges on table public.login_rate_limit_buckets from public, anon, authenticated;
grant all privileges on table public.login_rate_limit_buckets to service_role;

create or replace function public.consume_login_attempt(
    p_ip_hash text,
    p_account_hash text,
    p_ip_max_attempts integer,
    p_account_max_attempts integer,
    p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_now timestamptz := clock_timestamp();
    v_ip_attempts integer;
    v_account_attempts integer := 0;
    v_ip_window timestamptz;
    v_account_window timestamptz;
    v_retry_after integer := 0;
    v_allowed boolean;
begin
    if p_ip_hash is null
        or p_ip_hash !~ '^[0-9a-f]{64}$'
        or (p_account_hash is not null and p_account_hash !~ '^[0-9a-f]{64}$')
        or p_ip_max_attempts is null
        or p_ip_max_attempts < 1
        or p_ip_max_attempts > 10000
        or p_account_max_attempts is null
        or p_account_max_attempts < 1
        or p_account_max_attempts > 1000
        or p_window_seconds is null
        or p_window_seconds < 60
        or p_window_seconds > 86400 then
        raise exception 'Parámetros de rate limit inválidos';
    end if;

    delete from public.login_rate_limit_buckets
    where window_started_at + make_interval(secs => p_window_seconds) <= v_now;

    insert into public.login_rate_limit_buckets as bucket (
        scope, identifier_hash, window_started_at, attempts
    ) values ('ip', p_ip_hash, v_now, 1)
    on conflict (scope, identifier_hash) do update set
        window_started_at = case
            when bucket.window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now
            else bucket.window_started_at
        end,
        attempts = case
            when bucket.window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1
            else bucket.attempts + 1
        end
    returning attempts, window_started_at into v_ip_attempts, v_ip_window;

    if p_account_hash is not null then
        insert into public.login_rate_limit_buckets as bucket (
            scope, identifier_hash, window_started_at, attempts
        ) values ('account', p_account_hash, v_now, 1)
        on conflict (scope, identifier_hash) do update set
            window_started_at = case
                when bucket.window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now
                else bucket.window_started_at
            end,
            attempts = case
                when bucket.window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1
                else bucket.attempts + 1
            end
        returning attempts, window_started_at into v_account_attempts, v_account_window;
    end if;

    v_allowed := v_ip_attempts <= p_ip_max_attempts
        and (p_account_hash is null or v_account_attempts <= p_account_max_attempts);

    if v_ip_attempts > p_ip_max_attempts then
        v_retry_after := greatest(v_retry_after, ceil(extract(epoch from (
            v_ip_window + make_interval(secs => p_window_seconds) - v_now
        )))::integer);
    end if;
    if p_account_hash is not null and v_account_attempts > p_account_max_attempts then
        v_retry_after := greatest(v_retry_after, ceil(extract(epoch from (
            v_account_window + make_interval(secs => p_window_seconds) - v_now
        )))::integer);
    end if;

    return jsonb_build_object(
        'allowed', v_allowed,
        'retry_after_seconds', greatest(0, v_retry_after)
    );
end;
$$;

revoke all on function public.consume_login_attempt(text, text, integer, integer, integer)
    from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text, text, integer, integer, integer)
    to service_role;