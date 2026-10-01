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
create policy metas_owner_policy on public.metas
    for all to authenticated
    using (exists (
        select 1 from public.usuarios u
        where u.id = metas.usuario_id
          and (u.auth_id = auth.uid() or u.id = auth.uid())
    ))
    with check (exists (
        select 1 from public.usuarios u
        where u.id = metas.usuario_id
          and (u.auth_id = auth.uid() or u.id = auth.uid())
    ));

drop policy if exists aportes_meta_owner_policy on public.aportes_meta;
create policy aportes_meta_owner_policy on public.aportes_meta
    for all to authenticated
    using (exists (
        select 1 from public.usuarios u
        where u.id = aportes_meta.usuario_id
          and (u.auth_id = auth.uid() or u.id = auth.uid())
    ))
    with check (exists (
        select 1 from public.usuarios u
        where u.id = aportes_meta.usuario_id
          and (u.auth_id = auth.uid() or u.id = auth.uid())
    ));

drop policy if exists transacciones_owner_policy on public.transacciones;
create policy transacciones_owner_policy on public.transacciones
    for all to authenticated
    using (exists (
        select 1 from public.usuarios u
        where u.id = transacciones.usuario_id
          and (u.auth_id = auth.uid() or u.id = auth.uid())
    ))
    with check (exists (
        select 1 from public.usuarios u
        where u.id = transacciones.usuario_id
          and (u.auth_id = auth.uid() or u.id = auth.uid())
    ));

drop policy if exists recordatorios_owner_policy on public.recordatorios;
create policy recordatorios_owner_policy on public.recordatorios
        for all to authenticated
        using (exists (
                select 1 from public.usuarios u
                where u.id = recordatorios.usuario_id
                    and (u.auth_id = auth.uid() or u.id = auth.uid())
        ))
        with check (exists (
                select 1 from public.usuarios u
                where u.id = recordatorios.usuario_id
                    and (u.auth_id = auth.uid() or u.id = auth.uid())
        ));

drop policy if exists patrimonio_owner_policy on public.patrimonio;
create policy patrimonio_owner_policy on public.patrimonio
        for all to authenticated
        using (exists (
                select 1 from public.usuarios u
                where u.id = patrimonio.usuario_id
                    and (u.auth_id = auth.uid() or u.id = auth.uid())
        ))
        with check (exists (
                select 1 from public.usuarios u
                where u.id = patrimonio.usuario_id
                    and (u.auth_id = auth.uid() or u.id = auth.uid())
        ));
