-- Roles canónicos de Notaire para Supabase.
-- Ejecutar una vez en el SQL Editor de Supabase.

insert into public.roles (id_rol, nombre_rol)
values (
    '33333333-3333-3333-3333-333333333333',
    'empleado'
)
on conflict (id_rol) do update
set nombre_rol = excluded.nombre_rol;

select id_rol, nombre_rol
from public.roles
order by nombre_rol;
