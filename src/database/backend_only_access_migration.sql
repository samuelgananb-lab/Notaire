-- Restringe las tablas de la aplicación al backend Express con service_role.
-- No elimina ni modifica filas. Ejecutar manualmente después de las migraciones
-- que crean tablas/políticas y antes del despliegue que dependa de este cierre.

do $$
declare
    table_name text;
    app_tables text[] := array[
        'usuarios',
        'roles',
        'metas',
        'aportes_meta',
        'transacciones',
        'recordatorios',
        'eventos_calendario',
        'patrimonio',
        'tramites_notariales',
        'solicitudes_empleado',
        'auditoria_acciones',
        'notification_deliveries',
        'login_rate_limit_buckets'
    ];
begin
    foreach table_name in array app_tables loop
        if to_regclass(format('public.%I', table_name)) is not null then
            execute format('alter table public.%I enable row level security', table_name);
            execute format(
                'revoke all privileges on table public.%I from public, anon, authenticated',
                table_name
            );
            execute format(
                'grant all privileges on table public.%I to service_role',
                table_name
            );
            execute format(
                'drop policy if exists backend_only_access on public.%I',
                table_name
            );
            execute format(
                'create policy backend_only_access on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
                table_name
            );
        end if;
    end loop;
end;
$$;