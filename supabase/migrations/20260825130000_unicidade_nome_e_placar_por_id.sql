-- Auditoria de código (/code-review) achou uma raiz comum pra 5 bugs
-- diferentes: `jogadores.nome` nunca teve constraint de unicidade, e boa
-- parte do app (sorteio, pontuação, H2H, RLS de placar) casa jogador por
-- nome-texto em vez de jogador_id. Hoje não existe nome duplicado na base
-- (conferido antes desta migration), mas nada impedia de existir — e
-- quando existisse, isso corrompia silenciosamente:
--   - idPorNome() (Admin.jsx) grava o jogador_id errado nas duplas do sorteio
--   - salvarPontuacao() mescla a pontuação dos dois homônimos num só
--   - sorteioQualify.js remove os dois de uma vez no dedup do backtracking
--   - h2h.js mistura "Histórico contra Adversários" dos dois na mesma linha
--   - RLS de `jogos` deixa o jogador lançar placar casando pelo nome
-- Em vez de corrigir cada um separadamente, fecha a raiz: nome vira único
-- (case/espaço-insensitive), então essas 5 situações não podem mais
-- acontecer entre jogadores atualmente ativos.
create unique index jogadores_nome_unico_idx on public.jogadores (lower(trim(nome)));

-- Bônus, mesma classe: a policy de UPDATE de `jogos` que deixa o próprio
-- jogador lançar o placar da própria partida casava por
-- `jogadores.nome = ANY(...)` contra o texto (nome no momento do sorteio)
-- gravado em dupla_a_1/dupla_a_2/dupla_b_1/dupla_b_2. Isso fica errado se
-- o jogador for renomeado depois do sorteio — o texto antigo não
-- acompanha. `jogos` já tem dupla_a_1_id/dupla_a_2_id/dupla_b_1_id/
-- dupla_b_2_id (migration 20260816120000) sempre preenchidos em rodadas
-- ativas (as únicas às quais essa policy se aplica), então casa por id.
drop policy if exists "jogador da partida ou admin lanca placar" on public.jogos;

create policy "jogador da partida ou admin lanca placar" on public.jogos for update to authenticated
  using (
    exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin')
    or (
      exists (select 1 from public.rodadas r where r.id = jogos.rodada_id and r.status = 'ativa')
      and exists (
        select 1 from public.jogadores j
        where j.user_id = auth.uid()
          and j.id in (jogos.dupla_a_1_id, jogos.dupla_a_2_id, jogos.dupla_b_1_id, jogos.dupla_b_2_id)
      )
    )
  )
  with check (
    exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin')
    or (
      exists (select 1 from public.rodadas r where r.id = jogos.rodada_id and r.status = 'ativa')
      and exists (
        select 1 from public.jogadores j
        where j.user_id = auth.uid()
          and j.id in (jogos.dupla_a_1_id, jogos.dupla_a_2_id, jogos.dupla_b_1_id, jogos.dupla_b_2_id)
      )
    )
  );
