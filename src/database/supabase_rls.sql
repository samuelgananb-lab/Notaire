-- Seguridad por usuario para las tablas del sistema.
-- Ejecutar una vez en Supabase SQL Editor.
-- El frontend no consulta Supabase directamente: las rutas del backend usan
-- service_role y validan el usuario mediante JWT antes de consultar.

alter table if exists public.metas enable row level security;
alter table if exists public.aportes_meta enable row level security;
alter table if exists public.transacciones enable row level security;
alter table if exists public.recordatorios enable row level security;
alter table if exists public.patrimonio enable row level security;

-- METAS
drop policy if exists metas_owner_policy on public.metas;
create policy metas_owner_policy on public.metas
    for all to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

-- APORTES
drop policy if exists aportes_meta_owner_policy on public.aportes_meta;
create policy aportes_meta_owner_policy on public.aportes_meta
    for all to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

-- TRANSACCIONES
drop policy if exists transacciones_owner_policy on public.transacciones;
create policy transacciones_owner_policy on public.transacciones
    for all to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

-- RECORDATORIOS
drop policy if exists recordatorios_owner_policy on public.recordatorios;
create policy recordatorios_owner_policy on public.recordatorios
    for all to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

-- PATRIMONIO
drop policy if exists patrimonio_owner_policy on public.patrimonio;
create policy patrimonio_owner_policy on public.patrimonio
    for all to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);
