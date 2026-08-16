-- BUG DE SEGURANÇA CRÍTICO: as policies "Admin pode ..." de jogos,
-- pontuacao, jogadores, rodadas e ranking_rodada tinham `using(true)` /
-- `with check(true)` — ou seja, na prática QUALQUER jogador autenticado
-- (não só admin) podia escrever direto nessas tabelas via API do Supabase,
-- sem passar pela tela de Admin: reescrever placar/pontos/vitórias de
-- qualquer jogador, mudar a própria chave pra Ouro, criar rodadas falsas
-- etc. `jogos` já tinha uma policy de UPDATE mais restrita
-- (20260730095831_placar_por_jogador.sql), mas RLS combina policies
-- permissivas com OR — a antiga permissiva continuava valendo por cima e
-- anulava a restrição.
--
-- Correção: troca as policies genéricas por checagem real de admin
-- (jogadores.role = 'admin' — mesmo padrão já usado corretamente em
-- "admins podem inserir badges"). Não mexe nas policies de UPDATE/DELETE
-- de `jogos` que já eram restritas corretamente (placar por jogador da
-- partida, e "admin apaga jogos").
--
-- Jogadores continuam podendo atualizar a própria foto (Perfil.jsx) — um
-- trigger passa a reverter silenciosamente qualquer outro campo sensível
-- (chave/role/ativo/user_id/nome) que não seja admin tentar mudar no
-- próprio update, mesmo que o payload inclua esses campos.
--
-- Bônus (mesma classe de bug, correção trivial): `confirmacoes` liberava
-- insert com `check(true)` — qualquer jogador podia confirmar presença em
-- nome de outro. Restringe ao próprio `jogador_id`. Não mexe na policy de
-- UPDATE de `confirmacoes` — o app usa update client-side pra promover o
-- próximo da lista de espera quando alguém cancela (Confirmacao.jsx), uma
-- correção correta ali exige mover essa promoção pra uma function no
-- servidor, fica pra depois.
--
-- Bônus 2: `ranking_rodada` nunca teve policy de DELETE — o `.delete()`
-- que Admin.jsx faz antes de regravar o ranking de uma rodada estava
-- sendo silenciosamente ignorado pelo RLS (0 linhas apagadas, sem erro),
-- deixando ranking_rodada acumulando linhas duplicadas toda vez que uma
-- rodada era reaberta e refechada.

-- ─── JOGADORES ──────────────────────────────────────────────────────────
drop policy if exists "Admin pode inserir jogadores" on public.jogadores;
drop policy if exists "Admin pode atualizar jogadores" on public.jogadores;

create policy "admin insere jogadores" on public.jogadores for insert to authenticated
  with check (exists (select 1 from public.jogadores j2 where j2.user_id = auth.uid() and j2.role = 'admin'));

create policy "admin ou proprio jogador atualiza" on public.jogadores for update to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.jogadores j2 where j2.user_id = auth.uid() and j2.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.jogadores j2 where j2.user_id = auth.uid() and j2.role = 'admin')
  );

create or replace function public.protege_campos_sensiveis_jogador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.jogadores where user_id = auth.uid() and role = 'admin') then
    new.chave := old.chave;
    new.role := old.role;
    new.ativo := old.ativo;
    new.user_id := old.user_id;
    new.nome := old.nome;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protege_campos_sensiveis on public.jogadores;
create trigger trg_protege_campos_sensiveis
  before update on public.jogadores
  for each row execute function public.protege_campos_sensiveis_jogador();

-- ─── RODADAS ────────────────────────────────────────────────────────────
drop policy if exists "Admin pode inserir rodadas" on public.rodadas;
drop policy if exists "Admin pode atualizar rodadas" on public.rodadas;

create policy "admin insere rodadas" on public.rodadas for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin atualiza rodadas" on public.rodadas for update to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- ─── JOGOS (só o INSERT tinha o problema) ──────────────────────────────
drop policy if exists "Admin pode inserir jogos" on public.jogos;
drop policy if exists "Admin pode atualizar jogos" on public.jogos;

create policy "admin insere jogos" on public.jogos for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- ─── PONTUACAO ──────────────────────────────────────────────────────────
drop policy if exists "Admin pode inserir pontuação" on public.pontuacao;
drop policy if exists "Admin pode atualizar pontuação" on public.pontuacao;

create policy "admin insere pontuacao" on public.pontuacao for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin atualiza pontuacao" on public.pontuacao for update to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- ─── RANKING_RODADA ─────────────────────────────────────────────────────
drop policy if exists "ranking_insert" on public.ranking_rodada;

create policy "admin insere ranking_rodada" on public.ranking_rodada for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin apaga ranking_rodada" on public.ranking_rodada for delete to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- ─── CONFIRMACOES (insert só em nome do próprio jogador) ───────────────
drop policy if exists "Jogador confirma própria presença" on public.confirmacoes;

create policy "jogador confirma propria presenca" on public.confirmacoes for insert to authenticated
  with check (jogador_id in (select id from public.jogadores where user_id = auth.uid()));
