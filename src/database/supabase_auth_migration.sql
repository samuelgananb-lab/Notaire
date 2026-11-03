-- Migracion progresiva a Supabase Auth.
-- Ejecutar una vez en Supabase SQL Editor.

alter table if exists public.usuarios
    add column if not exists auth_id uuid unique;

-- Las nuevas cuentas usan el mismo UUID en auth.users y public.usuarios.
-- Las cuentas antiguas conservan temporalmente el JWT propio hasta recuperar
-- su contraseña y ser recreadas/vinculadas a Supabase Auth.

alter table if exists public.metas enable row level security;
alter table if exists public.aportes_meta enable row level security;
alter table if exists public.transacciones enable row level security;
alter table if exists public.recordatorios enable row level security;
alter table if exists public.patrimonio enable row level security;

drop policy if exists metas_owner_policy on public.metas;
drop policy if exists backend_only_access on public.metas;
create policy backend_only_access on public.metas as restrictive
    for all to anon, authenticated using (false) with check (false);

drop policy if exists aportes_meta_owner_policy on public.aportes_meta;
drop policy if exists backend_only_access on public.aportes_meta;
create policy backend_only_access on public.aportes_meta as restrictive
    for all to anon, authenticated using (false) with check (false);

drop policy if exists transacciones_owner_policy on public.transacciones;
drop policy if exists backend_only_access on public.transacciones;
create policy backend_only_access on public.transacciones as restrictive
    for all to anon, authenticated using (false) with check (false);

drop policy if exists recordatorios_owner_policy on public.recordatorios;
drop policy if exists backend_only_access on public.recordatorios;
create policy backend_only_access on public.recordatorios as restrictive
    for all to anon, authenticated using (false) with check (false);

drop policy if exists patrimonio_owner_policy on public.patrimonio;
drop policy if exists backend_only_access on public.patrimonio;
create policy backend_only_access on public.patrimonio as restrictive
    for all to anon, authenticated using (false) with check (false);

revoke all privileges on table public.metas, public.aportes_meta, public.transacciones,
    public.recordatorios, public.patrimonio from public, anon, authenticated;
grant all privileges on table public.metas, public.aportes_meta, public.transacciones,
    public.recordatorios, public.patrimonio to service_role;
