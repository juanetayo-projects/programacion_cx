insert into storage.buckets (id, name, public) values ('soportes', 'soportes', false)
on conflict (id) do nothing;

create policy "soportes lectura autenticados" on storage.objects
  for select using (bucket_id = 'soportes' and auth.role() = 'authenticated');

create policy "soportes insercion autenticados" on storage.objects
  for insert with check (bucket_id = 'soportes' and auth.role() = 'authenticated');
