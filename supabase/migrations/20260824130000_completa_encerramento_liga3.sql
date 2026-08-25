-- "Encerrar Temporada" (Admin.jsx: encerrarTemporada()) rodou até a metade,
-- várias vezes:
-- 1) o insert em `temporadas` (RLS corrigida em 20260824120000) já
--    funcionava, mas o passo seguinte — resetar jogadores.chave pra
--    'prata' — usava `.neq("id", "")`, e `id` é uuid: comparar `<> ''` com
--    uma coluna uuid é erro 400 do Postgres (string vazia não é um uuid
--    válido), não "sempre verdade" como o dev pretendia. Isso abortou a
--    função antes de criar a rodada de Qualify da liga nova, em toda
--    tentativa de clicar em "Encerrar Temporada" — 4 vezes, cada uma
--    inserindo de novo o arquivamento de todo mundo em `temporadas` antes
--    de falhar no reset de chave. Código já corrigido pra usar
--    `.not("id", "is", null)`.
-- 2) resultado: liga "Torneio de Inverno 2026" nunca fechou (rodada 13
--    ficou parada em status 'proxima', acumulando 20 confirmações, sem
--    nunca ter sorteio/jogos), e "Liga 3 - 2026" nunca foi criada.
--
-- Esta migração completa manualmente os passos que ficaram faltando, sem
-- reinserir em `temporadas` (isso já foi feito, só duplicado).

-- Remove as 3 cópias duplicadas de cada jogador em `temporadas`, geradas
-- pelas 4 tentativas anteriores (idênticas — mesma pontuação/posição/chave
-- de quando a liga parou, na rodada 12). Mantém 1 linha por jogador.
delete from public.temporadas t
using (
  select id, row_number() over (partition by jogador_id, nome_torneio, ano order by id) as rn
  from public.temporadas
  where nome_torneio = 'Torneio de Inverno 2026'
) dup
where t.id = dup.id and dup.rn > 1;

-- Reseta a chave de todo mundo pra 'prata' — o trigger de campos sensíveis
-- (20260816130000_fecha_rls_admin.sql) reverteria esse update fora de uma
-- sessão autenticada como admin (auth.uid() é null aqui), então desliga ele
-- só durante este update.
alter table public.jogadores disable trigger trg_protege_campos_sensiveis;
update public.jogadores set chave = 'prata';
alter table public.jogadores enable trigger trg_protege_campos_sensiveis;

do $$
declare
  v_qualify_id uuid;
  v_rodada13_id uuid;
begin
  -- Cria a rodada de Qualify da liga nova, só se ainda não existir. Data =
  -- próximo sábado a partir de hoje (2026-08-25, terça), mesmo cálculo de
  -- proximoSabadoISO() (src/lib/prazo.js) = 2026-08-29.
  select id into v_qualify_id from public.rodadas where liga = 'Liga 3 - 2026' limit 1;
  if v_qualify_id is null then
    insert into public.rodadas (numero, data, status, liga, tipo)
    values (0, date '2026-08-29', 'proxima', 'Liga 3 - 2026', 'qualify')
    returning id into v_qualify_id;
  end if;

  -- Rodada 13 nunca foi jogada (0 jogos, sem sorteio) — a temporada acaba
  -- na rodada 12. Não vamos jogar a 13: move as 20 confirmações de
  -- presença que já existiam pra ela direto pro Qualify da liga nova (em
  -- vez de perdê-las) e remove a rodada 13.
  select id into v_rodada13_id from public.rodadas
    where liga = 'Torneio de Inverno 2026' and numero = 13;
  if v_rodada13_id is not null then
    update public.confirmacoes set rodada_id = v_qualify_id where rodada_id = v_rodada13_id;
    delete from public.rodadas where id = v_rodada13_id;
  end if;
end $$;
