-- Execute este arquivo no SQL Editor do Supabase.
-- Ele cria a agenda, bloqueia horários duplicados e libera somente o necessário para visitantes.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter extension pgcrypto set schema extensions;

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  servico text not null,
  data date not null,
  hora time without time zone not null,
  status text not null default 'agendado',
  origem text not null default 'site',
  observacoes text,
  created_at timestamptz not null default now(),

  constraint agendamentos_servico_check
    check (servico in ('Corte', 'Barba', 'Corte + Barba')),

  constraint agendamentos_status_check
    check (status in ('agendado', 'cancelado')),

  constraint agendamentos_telefone_check
    check (telefone ~ '^[0-9]{10,13}$'),

  constraint agendamentos_nome_check
    check (char_length(btrim(nome)) between 2 and 80)
);

alter table public.agendamentos
  drop constraint if exists agendamentos_hora_check,
  drop constraint if exists agendamentos_segunda_fechado_check;

create unique index if not exists agendamentos_data_hora_agendado_idx
  on public.agendamentos (data, hora)
  where status = 'agendado';

create table if not exists public.barbearia_admin_config (
  id smallint primary key default 1,
  senha_hash text not null,
  dias_funcionamento smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[],
  horarios_disponiveis time[] not null default array[
    time '09:00',
    time '10:00',
    time '11:00',
    time '12:00',
    time '13:00',
    time '14:00',
    time '15:00',
    time '16:00',
    time '17:00',
    time '18:00',
    time '19:00'
  ],
  updated_at timestamptz not null default now(),

  constraint barbearia_admin_config_id_check check (id = 1)
);

alter table public.barbearia_admin_config
  add column if not exists dias_funcionamento smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[],
  add column if not exists horarios_disponiveis time[] not null default array[
    time '09:00',
    time '10:00',
    time '11:00',
    time '12:00',
    time '13:00',
    time '14:00',
    time '15:00',
    time '16:00',
    time '17:00',
    time '18:00',
    time '19:00'
  ];

alter table public.agendamentos enable row level security;
alter table public.barbearia_admin_config enable row level security;

insert into public.barbearia_admin_config (id, senha_hash)
values (1, extensions.crypt('canaa2026', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create or replace function public.obter_configuracao_agenda()
returns table (
  dias_funcionamento smallint[],
  horarios_disponiveis text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    config.dias_funcionamento,
    array(
      select to_char(horario.hora, 'HH24:MI')
      from unnest(config.horarios_disponiveis) as horario(hora)
      order by horario.hora
    ) as horarios_disponiveis
  from public.barbearia_admin_config as config
  where config.id = 1;
$$;

create or replace function public.horario_agenda_permitido(
  p_data date,
  p_hora time without time zone
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.barbearia_admin_config as config
    where config.id = 1
      and p_data >= current_date
      and extract(dow from p_data)::smallint = any (config.dias_funcionamento)
      and p_hora = any (config.horarios_disponiveis)
  );
$$;

create or replace function public.validar_agendamento_funcionamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'agendado' and not public.horario_agenda_permitido(new.data, new.hora) then
    raise exception 'horario_fora_funcionamento';
  end if;

  return new;
end;
$$;

drop trigger if exists agendamentos_validar_funcionamento on public.agendamentos;
create trigger agendamentos_validar_funcionamento
before insert or update of data, hora, status on public.agendamentos
for each row
execute function public.validar_agendamento_funcionamento();

create or replace function public.listar_horarios_ocupados(p_data date)
returns table (hora time without time zone)
language sql
stable
security definer
set search_path = public
as $$
  select a.hora
  from public.agendamentos as a
  where a.data = p_data
    and a.status = 'agendado'
  order by a.hora;
$$;

revoke all on public.agendamentos from anon;
revoke all on public.agendamentos from authenticated;
grant usage on schema public to anon, authenticated;
grant insert on public.agendamentos to anon;
grant select, insert, update, delete on public.agendamentos to authenticated;
grant execute on function public.listar_horarios_ocupados(date) to anon, authenticated;
grant execute on function public.obter_configuracao_agenda() to anon, authenticated;
grant execute on function public.horario_agenda_permitido(date, time without time zone) to anon, authenticated;

create or replace function public.validar_senha_admin_barbearia(p_senha text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.barbearia_admin_config as config
    where config.id = 1
      and config.senha_hash = extensions.crypt(coalesce(p_senha, ''), config.senha_hash)
  );
$$;

create or replace function public.definir_senha_admin_barbearia(p_senha text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_senha is null or char_length(p_senha) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;

  insert into public.barbearia_admin_config (id, senha_hash, updated_at)
  values (1, extensions.crypt(p_senha, extensions.gen_salt('bf')), now())
  on conflict (id)
  do update set
    senha_hash = excluded.senha_hash,
    updated_at = now();
end;
$$;

create or replace function public.admin_obter_configuracao_agenda(p_senha text)
returns table (
  dias_funcionamento smallint[],
  horarios_disponiveis text[],
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.validar_senha_admin_barbearia(p_senha) then
    raise exception 'senha_invalida';
  end if;

  return query
  select
    config.dias_funcionamento,
    array(
      select to_char(horario.hora, 'HH24:MI')
      from unnest(config.horarios_disponiveis) as horario(hora)
      order by horario.hora
    ) as horarios_disponiveis,
    config.updated_at
  from public.barbearia_admin_config as config
  where config.id = 1;
end;
$$;

create or replace function public.admin_salvar_configuracao_agenda(
  p_senha text,
  p_dias_funcionamento integer[],
  p_horarios_disponiveis text[]
)
returns table (
  dias_funcionamento smallint[],
  horarios_disponiveis text[],
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias smallint[];
  v_horarios time[];
begin
  if not public.validar_senha_admin_barbearia(p_senha) then
    raise exception 'senha_invalida';
  end if;

  if cardinality(coalesce(p_dias_funcionamento, array[]::integer[])) = 0 then
    raise exception 'dias_vazios';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_dias_funcionamento, array[]::integer[])) as item(dia)
    where item.dia < 0 or item.dia > 6
  ) then
    raise exception 'dia_invalido';
  end if;

  select coalesce(array_agg(dia order by dia), array[]::smallint[])
  into v_dias
  from (
    select distinct item.dia::smallint as dia
    from unnest(coalesce(p_dias_funcionamento, array[]::integer[])) as item(dia)
  ) as dias;

  if cardinality(coalesce(p_horarios_disponiveis, array[]::text[])) = 0 then
    raise exception 'horarios_vazios';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_horarios_disponiveis, array[]::text[])) as item(hora)
    where btrim(coalesce(item.hora, '')) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) then
    raise exception 'horario_invalido';
  end if;

  select coalesce(array_agg(hora order by hora), array[]::time[])
  into v_horarios
  from (
    select distinct cast(btrim(item.hora) as time) as hora
    from unnest(coalesce(p_horarios_disponiveis, array[]::text[])) as item(hora)
  ) as horarios;

  if cardinality(v_horarios) = 0 then
    raise exception 'horarios_vazios';
  end if;

  update public.barbearia_admin_config
  set
    dias_funcionamento = v_dias,
    horarios_disponiveis = v_horarios,
    updated_at = now()
  where id = 1;

  return query
  select
    config.dias_funcionamento,
    array(
      select to_char(horario.hora, 'HH24:MI')
      from unnest(config.horarios_disponiveis) as horario(hora)
      order by horario.hora
    ) as horarios_disponiveis,
    config.updated_at
  from public.barbearia_admin_config as config
  where config.id = 1;
end;
$$;

create or replace function public.admin_listar_agendamentos(
  p_senha text,
  p_data_inicio date default current_date,
  p_data_fim date default current_date + 30,
  p_status text default null,
  p_busca text default null
)
returns table (
  id uuid,
  nome text,
  telefone text,
  servico text,
  data date,
  hora time without time zone,
  status text,
  origem text,
  observacoes text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio date := coalesce(p_data_inicio, current_date);
  v_fim date := coalesce(p_data_fim, current_date + 30);
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_busca_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '');
begin
  if not public.validar_senha_admin_barbearia(p_senha) then
    raise exception 'senha_invalida';
  end if;

  if v_inicio > v_fim then
    raise exception 'periodo_invalido';
  end if;

  return query
  select
    a.id,
    a.nome,
    a.telefone,
    a.servico,
    a.data,
    a.hora,
    a.status,
    a.origem,
    a.observacoes,
    a.created_at
  from public.agendamentos as a
  where a.data between v_inicio and v_fim
    and (v_status is null or a.status = v_status)
    and (
      v_busca is null
      or a.nome ilike '%' || v_busca || '%'
      or (v_busca_digitos is not null and a.telefone ilike '%' || v_busca_digitos || '%')
      or a.servico ilike '%' || v_busca || '%'
    )
  order by a.data asc, a.hora asc;
end;
$$;

create or replace function public.admin_cancelar_agendamento(
  p_senha text,
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validar_senha_admin_barbearia(p_senha) then
    raise exception 'senha_invalida';
  end if;

  update public.agendamentos
  set status = 'cancelado'
  where id = p_id
    and status = 'agendado';

  return found;
end;
$$;

revoke all on public.barbearia_admin_config from anon;
revoke all on public.barbearia_admin_config from authenticated;
revoke execute on function public.validar_senha_admin_barbearia(text) from public;
revoke execute on function public.definir_senha_admin_barbearia(text) from public;
grant execute on function public.admin_listar_agendamentos(text, date, date, text, text) to anon;
grant execute on function public.admin_cancelar_agendamento(text, uuid) to anon;
grant execute on function public.admin_obter_configuracao_agenda(text) to anon;
grant execute on function public.admin_salvar_configuracao_agenda(text, integer[], text[]) to anon;

drop policy if exists "Clientes podem criar agendamentos" on public.agendamentos;
create policy "Clientes podem criar agendamentos"
on public.agendamentos
for insert
to anon
with check (
  status = 'agendado'
  and origem = 'site'
  and servico in ('Corte', 'Barba', 'Corte + Barba')
  and public.horario_agenda_permitido(data, hora)
  and telefone ~ '^[0-9]{10,13}$'
  and char_length(btrim(nome)) between 2 and 80
  and data >= current_date
);

drop policy if exists "Equipe autenticada gerencia agendamentos" on public.agendamentos;
create policy "Equipe autenticada gerencia agendamentos"
on public.agendamentos
for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
