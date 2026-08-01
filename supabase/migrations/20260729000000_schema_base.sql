-- Snapshot do schema base do projeto, reconstruído por introspecção do banco
-- de produção (information_schema / pg_policies / pg_get_viewdef) em
-- 2026-08-01. Até esta data, todas as tabelas abaixo tinham sido criadas
-- direto no painel do Supabase — nunca existiu uma migration versionada pra
-- elas, então o schema base não dava pra auditar nem recriar só pelo git.
-- Datado um dia antes da primeira migration real (20260730) pra manter a
-- ordem cronológica correta no histórico.
--
-- Não foi possível usar `supabase db pull`/`db dump` porque ambos dependem
-- de Docker (indisponível neste ambiente) pra montar um "shadow database".
-- Reconstruído manualmente via SELECTs em information_schema/pg_catalog —
-- cobre tabelas, colunas, defaults, PK/FK/UNIQUE, RLS e policies. Não
-- captura triggers/functions customizados porque não havia nenhum no
-- schema public no momento da introspecção.

-- ─── JOGADORES ──────────────────────────────────────────────────────────
create table if not exists public.jogadores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nome text not null,
  apelido text,
  chave text default 'prata',
  ativo boolean default true,
  created_at timestamp default now(),
  whatsapp text,
  role text not null default 'jogador',
  foto_url text
);
alter table public.jogadores enable row level security;
create policy "Jogadores visíveis para autenticados" on public.jogadores for select to authenticated using (true);
create policy "Admin pode inserir jogadores" on public.jogadores for insert to authenticated with check (true);
create policy "Admin pode atualizar jogadores" on public.jogadores for update to authenticated using (true);

-- ─── RODADAS ────────────────────────────────────────────────────────────
create table if not exists public.rodadas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  data date not null,
  status text default 'proxima',
  liga text default 'Torneio de Inverno 2026',
  tipo text default 'normal',
  created_at timestamp default now(),
  local text,
  vagas_total integer
);
alter table public.rodadas enable row level security;
create policy "Rodadas visíveis para autenticados" on public.rodadas for select to authenticated using (true);
create policy "Admin pode inserir rodadas" on public.rodadas for insert to authenticated with check (true);
create policy "Admin pode atualizar rodadas" on public.rodadas for update to authenticated using (true);

-- ─── CONFIRMACOES ───────────────────────────────────────────────────────
create table if not exists public.confirmacoes (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid references public.jogadores(id),
  rodada_id uuid references public.rodadas(id),
  created_at timestamp default now(),
  status text not null default 'espera',
  "time" text,
  unique (jogador_id, rodada_id)
);
alter table public.confirmacoes enable row level security;
create policy "Confirmações visíveis para autenticados" on public.confirmacoes for select to authenticated using (true);
create policy "Jogador confirma própria presença" on public.confirmacoes for insert to authenticated with check (true);
create policy "admins podem atualizar confirmacoes" on public.confirmacoes for update to authenticated using (true) with check (true);
create policy "jogadores podem cancelar propria confirmacao" on public.confirmacoes for delete to authenticated
  using (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));

-- ─── JOGOS ──────────────────────────────────────────────────────────────
create table if not exists public.jogos (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid references public.rodadas(id),
  numero_rodada integer not null,
  dupla_a_1 text,
  dupla_a_2 text,
  dupla_b_1 text,
  dupla_b_2 text,
  placar_a integer,
  placar_b integer,
  chave text default 'ouro',
  created_at timestamp default now(),
  rodada_interna integer default 1,
  tie_a integer,
  tie_b integer
);
alter table public.jogos enable row level security;
create policy "Jogos visíveis para autenticados" on public.jogos for select to authenticated using (true);
create policy "Admin pode inserir jogos" on public.jogos for insert to authenticated with check (true);
create policy "Admin pode atualizar jogos" on public.jogos for update to authenticated using (true);
-- As policies "admin apaga jogos" e "jogador da partida ou admin lanca placar"
-- (com os 3 IDs de admin) já vêm das migrations 20260731181053 e
-- 20260730195452/placar_por_jogador — não duplicadas aqui.

-- ─── PONTUACAO ──────────────────────────────────────────────────────────
create table if not exists public.pontuacao (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid references public.jogadores(id),
  rodada_id uuid references public.rodadas(id),
  pontos integer default 0,
  vitorias integer default 0,
  created_at timestamp default now()
);
alter table public.pontuacao enable row level security;
create policy "Pontuação visível para autenticados" on public.pontuacao for select to authenticated using (true);
create policy "Admin pode inserir pontuação" on public.pontuacao for insert to authenticated with check (true);
create policy "Admin pode atualizar pontuação" on public.pontuacao for update to authenticated using (true);

-- ─── RANKING_RODADA ─────────────────────────────────────────────────────
create table if not exists public.ranking_rodada (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid references public.rodadas(id),
  jogador_id uuid references public.jogadores(id),
  chave text,
  posicao integer,
  pontos_liga integer,
  created_at timestamptz default now()
);
alter table public.ranking_rodada enable row level security;
create policy "ranking_leitura" on public.ranking_rodada for select to authenticated using (true);
create policy "ranking_insert" on public.ranking_rodada for insert to authenticated with check (true);

-- ─── BADGES ─────────────────────────────────────────────────────────────
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid references public.jogadores(id),
  rodada_id uuid references public.rodadas(id),
  tipo text not null,
  created_at timestamptz default now(),
  unique (jogador_id, rodada_id, tipo)
);
alter table public.badges enable row level security;
create policy "badges visíveis para autenticados" on public.badges for select to authenticated using (true);
create policy "admins podem inserir badges" on public.badges for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- ─── PUSH_SUBSCRIPTIONS ─────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid references public.jogadores(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (jogador_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "autenticados podem ler subscriptions" on public.push_subscriptions for select to authenticated using (true);
create policy "jogador gerencia propria subscription" on public.push_subscriptions for all to authenticated
  using (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()))
  with check (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));

-- ─── FEED_POSTS ─────────────────────────────────────────────────────────
create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid references public.jogadores(id) on delete cascade,
  texto text,
  badge_tipo text,
  rodada_id uuid references public.rodadas(id) on delete set null,
  created_at timestamptz default now(),
  foto_url text
);
alter table public.feed_posts enable row level security;
create policy "feed_posts_select" on public.feed_posts for select to authenticated using (true);
create policy "feed_posts_insert" on public.feed_posts for insert to authenticated
  with check (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));
create policy "feed_posts_delete" on public.feed_posts for delete to authenticated
  using (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));

-- FEED_COMENTARIOS (comentários de um post do Feed) não entra aqui —
-- diferente das outras tabelas deste arquivo, ela já tem uma migration
-- datada de verdade (20260730195452_feed_comentarios_e_fotos.sql) que cria
-- a tabela E as policies. Duplicar a criação de policy aqui quebraria um
-- replay do zero (CREATE POLICY não aceita IF NOT EXISTS no Postgres).

-- ─── FEED_REACOES ───────────────────────────────────────────────────────
create table if not exists public.feed_reacoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.feed_posts(id) on delete cascade,
  jogador_id uuid references public.jogadores(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (post_id, jogador_id, emoji)
);
alter table public.feed_reacoes enable row level security;
create policy "feed_reacoes_select" on public.feed_reacoes for select to authenticated using (true);
create policy "feed_reacoes_all" on public.feed_reacoes for all to authenticated
  using (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));

-- ─── JOGO_REACOES ───────────────────────────────────────────────────────
create table if not exists public.jogo_reacoes (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid references public.jogos(id) on delete cascade,
  jogador_id uuid references public.jogadores(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (jogo_id, jogador_id, emoji)
);
alter table public.jogo_reacoes enable row level security;
create policy "jogo_reacoes_select" on public.jogo_reacoes for select to authenticated using (true);
create policy "jogo_reacoes_all" on public.jogo_reacoes for all to authenticated
  using (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));

-- ─── COMENTARIOS (comentários por rodada, tela Rodada.jsx — distinto do
-- feed_comentarios, que é por post do Feed) ─────────────────────────────
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid references public.rodadas(id),
  jogador_id uuid references public.jogadores(id),
  texto text not null,
  created_at timestamptz default now()
);
alter table public.comentarios enable row level security;
create policy "comentarios visíveis para autenticados" on public.comentarios for select to authenticated using (true);
create policy "jogador pode comentar" on public.comentarios for insert to authenticated
  with check (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));
create policy "jogador pode deletar proprio comentario" on public.comentarios for delete to authenticated
  using (jogador_id in (select jogadores.id from public.jogadores where jogadores.user_id = auth.uid()));

-- ─── CADASTROS_PENDENTES (fluxo de cadastro via convite) ────────────────
create table if not exists public.cadastros_pendentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nome text not null,
  email text not null,
  whatsapp text,
  token_convite text,
  status text not null default 'pendente',
  jogador_id uuid,
  created_at timestamp default now()
);
alter table public.cadastros_pendentes enable row level security;
create policy "Permitir insert em cadastros_pendentes" on public.cadastros_pendentes for insert to anon, authenticated with check (true);
create policy "Admin pode ver cadastros pendentes" on public.cadastros_pendentes for select to authenticated using (true);
create policy "Admin pode atualizar cadastros pendentes" on public.cadastros_pendentes for update to authenticated using (true);

-- ─── CONVITES ───────────────────────────────────────────────────────────
create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text,
  usado boolean not null default false,
  criado_por uuid,
  created_at timestamp default now(),
  expires_at timestamp
);
alter table public.convites enable row level security;
create policy "convites_leitura_publica" on public.convites for select to anon using (true);
create policy "Admin pode ver convites" on public.convites for select to authenticated using (true);
create policy "Admin pode inserir convites" on public.convites for insert to authenticated with check (true);
create policy "Admin pode deletar convites" on public.convites for delete to authenticated using (true);
create policy "anon pode marcar convite como usado" on public.convites for update to anon
  using (usado = false) with check (usado = true);

-- ─── TEMPORADAS (arquivo histórico gravado ao "Encerrar Temporada") ─────
create table if not exists public.temporadas (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid references public.jogadores(id),
  nome_torneio text not null,
  ano integer not null,
  pontos integer default 0,
  posicao integer,
  chave text,
  status text default 'finalizado'
);
alter table public.temporadas enable row level security;
create policy "temporadas visíveis para autenticados" on public.temporadas for select to authenticated using (true);

-- ─── VIEWS ──────────────────────────────────────────────────────────────

-- Classificação geral (sem descarte), soma bruta de tudo desde sempre.
create or replace view public.classificacao as
select
  j.id,
  j.nome,
  j.chave,
  j.foto_url,
  coalesce(sum(p.pontos), 0::bigint) as pontos,
  coalesce(sum(p.vitorias), 0::bigint) as vitorias,
  rank() over (order by coalesce(sum(p.pontos), 0::bigint) desc) as posicao
from public.jogadores j
left join public.pontuacao p on p.jogador_id = j.id
group by j.id, j.nome, j.chave, j.foto_url;

-- Classificação com descarte — versão ORIGINAL (tinha o bug do "zero
-- fantasma" corrigido depois pela migration 20260801170656). Mantida aqui
-- fiel ao que existiu de fato; a migration seguinte já reescreve com
-- CREATE OR REPLACE VIEW para a versão corrigida.
create or replace view public.classificacao_com_descarte as
with todas_rodadas as (
  select rodadas.id from public.rodadas where rodadas.status = 'finalizada'
), pontos_completos as (
  select
    j.id as jogador_id, j.nome, j.chave, j.foto_url, r.id as rodada_id,
    coalesce(p.pontos, 0) as pontos, coalesce(p.vitorias, 0) as vitorias
  from public.jogadores j
  cross join todas_rodadas r
  left join public.pontuacao p on p.jogador_id = j.id and p.rodada_id = r.id
  where exists (select 1 from public.pontuacao p2 where p2.jogador_id = j.id)
), pontos_rankeados as (
  select
    jogador_id, nome, chave, foto_url, rodada_id, pontos, vitorias,
    row_number() over (partition by jogador_id order by pontos) as rn
  from pontos_completos
), pontos_sem_descarte as (
  select
    jogador_id, nome, chave, foto_url,
    sum(pontos) as pontos_total, sum(vitorias) as vitorias_total, count(*) as rodadas_total
  from pontos_rankeados
  where rn > 2
  group by jogador_id, nome, chave, foto_url
)
select
  jogador_id as id, nome, chave, foto_url,
  pontos_total as pontos, vitorias_total as vitorias, rodadas_total as rodadas_jogadas,
  rank() over (order by pontos_total desc) as posicao
from pontos_sem_descarte;

-- Stats de um jogador só entre jogadores ativos (usada no Perfil — Carreira
-- Total). Sem descarte, soma bruta.
create or replace view public.stats_jogador as
select
  j.id as jogador_id,
  j.nome,
  j.chave,
  coalesce(sum(p.pontos), 0::bigint) as pontos_total,
  coalesce(sum(p.vitorias), 0::bigint) as vitorias,
  count(distinct p.rodada_id) as rodadas_jogadas,
  rank() over (order by coalesce(sum(p.pontos), 0::bigint) desc) as posicao
from public.jogadores j
left join public.pontuacao p on p.jogador_id = j.id
where j.ativo = true
group by j.id, j.nome, j.chave;
