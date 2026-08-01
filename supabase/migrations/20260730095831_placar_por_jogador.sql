-- Permite lançar/editar o placar de uma partida a:
--   1) qualquer jogador que esteja numa das 4 posições daquela partida
--      específica (dupla_a_1/dupla_a_2/dupla_b_1/dupla_b_2), só enquanto
--      a rodada estiver com status "ativa" (sorteio publicado);
--   2) os admins da liga (mesmos IDs hardcoded em src/components/Layout.jsx),
--      que podem lançar qualquer placar, de qualquer rodada, a qualquer momento.
--
-- Isso acelera a entrada de resultados e alimenta a classificação do dia em
-- tempo real, sem depender só do Admin lançar cada placar manualmente.
-- Não substitui nenhuma policy já existente — só adiciona esse caminho extra.

create policy "jogador da partida ou admin lanca placar"
on public.jogos
for update
to authenticated
using (
  auth.uid() in (
    'a60b3e0f-5528-400c-8e0f-8fb3f9226070', -- Robson
    '118a0596-1e11-4943-b8f2-9e49bd234dcf', -- Celso
    'a506b568-7183-4aab-b86f-5adbb5f435a6'  -- Marcel
  )
  or (
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
)
with check (
  auth.uid() in (
    'a60b3e0f-5528-400c-8e0f-8fb3f9226070', -- Robson
    '118a0596-1e11-4943-b8f2-9e49bd234dcf', -- Celso
    'a506b568-7183-4aab-b86f-5adbb5f435a6'  -- Marcel
  )
  or (
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
);
