-- Sistema de punições da Torneio de Primavera 2026: notificação de atraso
-- (1º atraso) e suspensão (2 atrasos acumulados = 1 rodada; falta sem
-- aviso/justificativa/substituto = 2 rodadas). `liga` e `rodada_numero`
-- ficam denormalizados (copiados de `rodadas` no momento do insert) pra dar
-- pra calcular "está bloqueado na rodada X desta liga" sem join — mesmo
-- padrão de escopo por liga já usado em lib/temporada.js.
create table public.punicoes (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid not null references public.jogadores(id),
  tipo text not null check (tipo in ('atraso', 'suspensao')),
  motivo text,
  rodada_id uuid references public.rodadas(id),
  rodada_numero integer not null,
  liga text not null,
  quantidade_rodadas integer not null default 0, -- 0 p/ atraso isolado; 1 ou 2 p/ suspensao
  criado_por uuid,
  created_at timestamptz default now()
);
alter table public.punicoes enable row level security;

create policy "punicoes visíveis para autenticados" on public.punicoes
  for select to authenticated using (true);

create policy "admin insere punicoes" on public.punicoes
  for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin remove punicoes" on public.punicoes
  for delete to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));
