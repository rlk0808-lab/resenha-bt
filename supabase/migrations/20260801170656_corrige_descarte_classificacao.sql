-- Bug: classificacao_com_descarte cruzava cada jogador com TODAS as rodadas
-- finalizadas da liga (inclusive rodadas anteriores à entrada dele, sem
-- nenhuma confirmação), tratando essas rodadas inexistentes como "0 pontos"
-- e usando esse zero fantasma como um dos 2 descartes. Isso fazia o total
-- "Histórico Total" divergir do total da "Classificação" (temporada atual),
-- que só descarta entre as rodadas em que o jogador realmente tem pontuação.
--
-- Correção: descarta as 2 piores apenas entre as rodadas onde existe uma
-- linha real em `pontuacao` (mesma regra usada em src/lib/temporada.js).
-- Faltas de jogador confirmado agora geram pontos:0 explicitamente
-- (ver salvarPontuacao em src/pages/Admin.jsx), então continuam contando
-- e podendo ser descartadas — só rodadas em que o jogador nem estava
-- inscrito é que deixam de contar.

create or replace view public.classificacao_com_descarte as
with pontos_rankeados as (
  select
    j.id as jogador_id,
    j.nome,
    j.chave,
    j.foto_url,
    p.rodada_id,
    p.pontos,
    p.vitorias,
    row_number() over (partition by j.id order by p.pontos) as rn
  from public.jogadores j
  join public.pontuacao p on p.jogador_id = j.id
  join public.rodadas r on r.id = p.rodada_id and r.status = 'finalizada'
),
pontos_sem_descarte as (
  select
    jogador_id, nome, chave, foto_url,
    sum(pontos) as pontos_total,
    sum(vitorias) as vitorias_total,
    count(*) as rodadas_total
  from pontos_rankeados
  where rn > 2
  group by jogador_id, nome, chave, foto_url
)
select
  jogador_id as id,
  nome,
  chave,
  foto_url,
  pontos_total as pontos,
  vitorias_total as vitorias,
  rodadas_total as rodadas_jogadas,
  rank() over (order by pontos_total desc) as posicao
from pontos_sem_descarte;
