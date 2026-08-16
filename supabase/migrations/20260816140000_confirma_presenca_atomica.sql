-- Bug: `Confirmacao.jsx` decidia "confirmado" vs "espera" contando
-- `listaConfirmados.length` já carregado no navegador e só DEPOIS inseria
-- a linha em `confirmacoes`. Dois jogadores confirmando no mesmo instante
-- perto da última vaga podem ambos ler a mesma contagem e ambos passar,
-- estourando o limite da lista principal.
--
-- Correção: função no banco que faz a contagem + decisão + insert dentro
-- da mesma transação, travada por rodada (pg_advisory_xact_lock) — só uma
-- chamada por rodada executa a contagem por vez, a próxima já vê o
-- resultado da anterior. `p_elegivel_principal` carrega as regras de
-- negócio que NÃO dependem de concorrência (prazo, se jogou a última
-- rodada, lista já fechada) — essas continuam decididas no client, só a
-- contagem de vaga (a parte realmente disputada) virou atômica aqui.
-- security definer: identifica o jogador por auth.uid() no servidor, não
-- confia no jogador_id que o client mandaria.

create or replace function public.confirmar_presenca(
  p_rodada_id uuid,
  p_limite integer,
  p_elegivel_principal boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jogador_id uuid;
  v_status text;
  v_count integer;
begin
  select id into v_jogador_id from jogadores where user_id = auth.uid() limit 1;
  if v_jogador_id is null then
    raise exception 'jogador_nao_encontrado';
  end if;

  if exists (select 1 from confirmacoes where jogador_id = v_jogador_id and rodada_id = p_rodada_id) then
    raise exception 'ja_confirmado';
  end if;

  -- Trava só essa rodada — outras rodadas continuam confirmando em paralelo.
  perform pg_advisory_xact_lock(hashtext(p_rodada_id::text));

  if p_elegivel_principal then
    select count(*) into v_count from confirmacoes where rodada_id = p_rodada_id and status = 'confirmado';
    v_status := case when v_count < p_limite then 'confirmado' else 'espera' end;
  else
    v_status := 'espera';
  end if;

  insert into confirmacoes (jogador_id, rodada_id, status) values (v_jogador_id, p_rodada_id, v_status);
  return v_status;
end;
$$;

grant execute on function public.confirmar_presenca(uuid, integer, boolean) to authenticated;
