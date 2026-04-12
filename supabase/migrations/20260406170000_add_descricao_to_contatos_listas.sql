alter table public.contatos_listas
  add column if not exists descricao text null;

update public.contatos_listas
set descricao = case
  when lower(nome) = 'frio' then 'Lista para contatos com baixo interesse, sem intenção clara de avançar ou que apenas pediram informações iniciais.'
  when lower(nome) = 'quente' then 'Lista para contatos com intenção clara de avançar, marcar reunião, pedir proposta ou continuar negociação.'
  when lower(nome) = 'qualificado' then 'Lista para contatos com perfil aderente, contexto claro e potencial real de virar oportunidade.'
  else descricao
end
where descricao is null;

create or replace function public.create_default_contact_lists()
returns trigger as $$
begin
  if new.tipo_de_usuario <> 'atendente' then
    insert into public.contatos_listas (profile_id, nome, cor, ordem, is_fixed, descricao)
    values
      (
        new.auth_id,
        'Frio',
        '#3b82f6',
        1,
        true,
        'Lista para contatos com baixo interesse, sem intenção clara de avançar ou que apenas pediram informações iniciais.'
      ),
      (
        new.auth_id,
        'Quente',
        '#f97316',
        2,
        true,
        'Lista para contatos com intenção clara de avançar, marcar reunião, pedir proposta ou continuar negociação.'
      ),
      (
        new.auth_id,
        'Qualificado',
        '#22c55e',
        3,
        true,
        'Lista para contatos com perfil aderente, contexto claro e potencial real de virar oportunidade.'
      );
  end if;

  return new;
end;
$$ language plpgsql;
