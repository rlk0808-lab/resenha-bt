-- Permite que qualquer jogador de uma partida lance/edite o próprio placar
-- enquanto a rodada estiver ativa (sorteio publicado, ainda não finalizada).
-- Isso acelera a entrada de resultados e alimenta a classificação do dia
-- em tempo real, sem depender só do Admin lançar cada placar manualmente.
--
-- Escopo de segurança: só o jogador que está numa das 4 posições daquela
-- partida específica (dupla_a_1/dupla_a_2/dupla_b_1/dupla_b_2) pode alterar
-- o placar dessa partida, e só enquanto a rodada estiver com status "ativa".
-- Não afeta nenhuma policy já existente para o Admin.

create policy "jogador lanca placar da propria partida"
on public.jogos
for update
to authenticated
using (
  exists (
    select 1 from public.rodadas r
    where r.id = jogos.rodada_id and r.status = 'ativa'
  )
  and exists (
    select 1 from public.jogadores j
    where j.user_id = auth.uid()
      and j.nome in (jogos.dupla_a_1, jogos.dupla_a_2, jogos.dupla_b_1, jogos.dupla_b_2)
  )
)
with check (
  exists (
    select 1 from public.rodadas r
    where r.id = jogos.rodada_id and r.status = 'ativa'
  )
  and exists (
    select 1 from public.jogadores j
    where j.user_id = auth.uid()
      and j.nome in (jogos.dupla_a_1, jogos.dupla_a_2, jogos.dupla_b_1, jogos.dupla_b_2)
  )
);
