-- migration para criar o bucket de backups do banco de dados

insert into storage.buckets (id, name, public)
values ('database-backups', 'database-backups', false)
on conflict (id) do nothing;

create policy "Admins podem gerenciar backups do database_backups"
  on storage.objects for all
  using ( bucket_id = 'database-backups' and auth.role() = 'authenticated' )
  with check ( bucket_id = 'database-backups' and auth.role() = 'authenticated' );
