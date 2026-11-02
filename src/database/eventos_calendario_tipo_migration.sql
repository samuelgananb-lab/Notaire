-- Align calendar event categories with the values used by the application.
-- Existing rows are not revalidated, while all new and updated rows are checked.

alter table if exists public.eventos_calendario
    drop constraint if exists eventos_calendario_tipo_check;

update public.eventos_calendario
set tipo = case lower(tipo)
    when 'purple' then 'notarial'
    when 'green' then 'financiero'
    when 'orange' then 'recordatorio'
    when 'blue' then 'personal'
    when 'pink' then 'personal'
    when 'pago' then 'financiero'
    when 'cumpleanos' then 'personal'
    else tipo
end
where lower(tipo) in ('purple', 'green', 'orange', 'blue', 'pink', 'pago', 'cumpleanos');

alter table if exists public.eventos_calendario
    add constraint eventos_calendario_tipo_check
    check (tipo in ('notarial', 'financiero', 'recordatorio', 'personal'))
    not valid;
