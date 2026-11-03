-- Desactiva el cron legado que llamaba los endpoints de correo retirados.
-- No elimina tablas, columnas ni registros. Ejecutar manualmente si el job existe.

do $$
declare
    scheduled_job record;
begin
    if to_regclass('cron.job') is not null then
        for scheduled_job in execute
            'select jobid from cron.job where jobname = $1'
            using 'notaire-notifications-every-minute'
        loop
            perform cron.unschedule(scheduled_job.jobid);
        end loop;
    end if;
end;
$$;