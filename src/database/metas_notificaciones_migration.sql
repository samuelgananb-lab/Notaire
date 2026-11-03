-- Ejecutar una vez en Supabase SQL Editor.
-- Registra aportes a metas de forma atómica sin superar el objetivo.

create or replace function public.registrar_aporte_meta(
    p_usuario_id uuid,
    p_meta_id bigint,
    p_monto numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_meta public.metas%rowtype;
    v_monto numeric(12, 2);
    v_restante numeric(12, 2);
begin
    if p_monto is null or p_monto <= 0 then
        return jsonb_build_object('codigo', 'MONTO_INVALIDO');
    end if;

    v_monto := round(p_monto, 2);
    if v_monto <= 0 then
        return jsonb_build_object('codigo', 'MONTO_INVALIDO');
    end if;

    select *
    into v_meta
    from public.metas
    where id = p_meta_id
      and usuario_id = p_usuario_id
    for update;

    if not found then
        return jsonb_build_object('codigo', 'META_NO_ENCONTRADA');
    end if;

    v_restante := greatest(0, v_meta.monto_objetivo - v_meta.monto_actual);
    if v_monto > v_restante then
        return jsonb_build_object('codigo', 'META_LIMITE', 'montoMaximo', v_restante);
    end if;

    insert into public.aportes_meta (meta_id, usuario_id, monto)
    values (p_meta_id, p_usuario_id, v_monto);

    update public.metas
    set monto_actual = monto_actual + v_monto
    where id = p_meta_id
      and usuario_id = p_usuario_id
    returning * into v_meta;

    return jsonb_build_object(
        'codigo', 'OK',
        'nuevo_monto_actual', v_meta.monto_actual,
        'meta', to_jsonb(v_meta)
    );
end;
$$;

revoke all on function public.registrar_aporte_meta(uuid, bigint, numeric) from public;
grant execute on function public.registrar_aporte_meta(uuid, bigint, numeric) to service_role;
