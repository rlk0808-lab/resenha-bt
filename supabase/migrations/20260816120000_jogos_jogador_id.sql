-- Bug: `jogos` guarda cada dupla como nome em texto livre
-- (dupla_a_1/a_2/b_1/b_2), nunca por jogador_id. A função de "Substituir
-- Jogador" (Admin.jsx) reatribuía esse nome em massa, inclusive em jogos já
-- disputados com placar lançado — roubando vitórias/derrotas reais de quem
-- saiu e creditando a quem entrou (bug reportado: jogador com 1 rodada
-- disputada aparecendo com 8 vitórias na Prata). A tabela `pontuacao`
-- (sempre por jogador_id) não é afetada, por isso a pontuação/classificação
-- continuava correta e só as telas que recalculam direto de `jogos`
-- mostravam número errado.
--
-- Esta migration só adiciona colunas (aditiva, sem apagar/alterar nada
-- existente) para blindar `jogos` contra esse tipo de corrupção: cada
-- posição da dupla passa a guardar também o jogador_id, junto do nome.
-- Linhas antigas ficam com essas colunas null e continuam sendo lidas por
-- nome (fallback) até serem substituídas por jogos novos.

alter table public.jogos
  add column if not exists dupla_a_1_id uuid references public.jogadores(id),
  add column if not exists dupla_a_2_id uuid references public.jogadores(id),
  add column if not exists dupla_b_1_id uuid references public.jogadores(id),
  add column if not exists dupla_b_2_id uuid references public.jogadores(id);
