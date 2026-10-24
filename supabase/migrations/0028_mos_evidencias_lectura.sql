-- MOS: las evidencias (correos y adjuntos) se pueden consultar en cualquier
-- momento por todos los roles del proceso, incluido Esterilización.
drop policy "mos_correos lectura" on mos_correos;
create policy "mos_correos lectura" on mos_correos
  for select using (es_mos_o_admin() or es_programador_o_admin() or es_esterilizacion_o_admin());

drop policy "mos lectura" on storage.objects;
create policy "mos lectura" on storage.objects
  for select using (bucket_id = 'mos' and (public.es_mos_o_admin() or public.es_programador_o_admin() or public.es_esterilizacion_o_admin()));
