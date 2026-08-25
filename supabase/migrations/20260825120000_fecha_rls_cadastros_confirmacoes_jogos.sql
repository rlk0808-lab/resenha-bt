-- BUGS DE SEGURANÇA — mesma classe já corrigida em 20260816130000, mas que
-- sobrou em 3 lugares:
--
-- 1) `cadastros_pendentes` — as policies de SELECT e UPDATE tinham
--    `using(true)`, sem checar admin (nome da policy dizia "Admin pode..."
--    mas o `qual` não checava nada). Qualquer jogador autenticado conseguia
--    ler nome/e-mail/whatsapp de todo cadastro pendente e aprovar ou
--    rejeitar qualquer um, sem passar pelo admin.
--
-- 2) `confirmacoes` — a policy de UPDATE tinha `using(true) with_check(true)`.
--    Isso já estava anotado como pendência conhecida no comentário de
--    20260816130000_fecha_rls_admin.sql ("uma correção correta ali exige
--    mover essa promoção pra uma function no servidor, fica pra depois").
--    Qualquer jogador autenticado podia atualizar a confirmação de
--    QUALQUER outro jogador (pular a lista de espera, mexer no time de
--    rodada especial de qualquer um, etc). Fecha pra admin, e move a
--    promoção automática (usada em Confirmacao.jsx quando alguém cancela
--    e o próximo da espera sobe) pra uma function SECURITY DEFINER —
--    mesmo padrão de confirmar_presenca().
--
-- 3) `jogos` — as policies de DELETE ("admin apaga jogos") e UPDATE
--    ("jogador da partida ou admin lanca placar") checavam admin por uma
--    lista de 3 UUIDs fixos no texto da policy, em vez de `role='admin'`
--    como todo o resto do schema. Hoje bate com os 3 admins atuais, mas é
--    uma armadilha: promover um admin novo não dá a ele essas permissões
--    (precisaria de outra migration), e rebaixar um admin não tira.

-- ─── CADASTROS_PENDENTES ────────────────────────────────────────────────
drop policy if exists "Admin pode ver cadastros pendentes" on public.cadastros_pendentes;
drop policy if exists "Admin pode atualizar cadastros pendentes" on public.cadastros_pendentes;

create policy "admin ve cadastros pendentes" on public.cadastros_pendentes for select to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin atualiza cadastros pendentes" on public.cadastros_pendentes for update to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- ─── CONFIRMACOES ───────────────────────────────────────────────────────
drop policy if exists "admins podem atualizar confirmacoes" on public.confirmacoes;

create policy "admin atualiza confirmacoes" on public.confirmacoes for update to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

-- Cancela a própria confirmação e, se ela era da lista principal, promove
-- o primeiro da lista de espera (mesma rodada) — sem depender de update
-- direto em confirmacoes de outro jogador. Retorna o jogador_id promovido
-- (ou null) pra o client mandar a notificação push.
create or replace function public.cancelar_confirmacao(p_confirmacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jogador_id uuid;
  v_rodada_id uuid;
  v_status text;
  v_promovido_confirmacao_id uuid;
  v_promovido_jogador_id uuid;
begin
  select id into v_jogador_id from jogadores where user_id = auth.uid() limit 1;
  if v_jogador_id is null then
    raise exception 'jogador_nao_encontrado';
  end if;

  select rodada_id, status into v_rodada_id, v_status
    from confirmacoes where id = p_confirmacao_id and jogador_id = v_jogador_id;
  if v_rodada_id is null then
    raise exception 'confirmacao_nao_encontrada_ou_nao_e_sua';
  end if;

  -- Mesma trava usada em confirmar_presenca — evita corrida com outro
  -- jogador confirmando/cancelando na mesma rodada ao mesmo tempo.
  perform pg_advisory_xact_lock(hashtext(v_rodada_id::text));

  delete from confirmacoes where id = p_confirmacao_id;

  if v_status = 'confirmado' then
    select id, jogador_id into v_promovido_confirmacao_id, v_promovido_jogador_id
      from confirmacoes
      where rodada_id = v_rodada_id and status = 'espera'
      order by created_at asc
      limit 1;
    if v_promovido_confirmacao_id is not null then
      update confirmacoes set status = 'confirmado' where id = v_promovido_confirmacao_id;
    end if;
  end if;

  return v_promovido_jogador_id;
end;
$$;

-- ─── JOGOS (troca UUIDs fixos por checagem de role='admin') ────────────
drop policy if exists "admin apaga jogos" on public.jogos;
drop policy if exists "jogador da partida ou admin lanca placar" on public.jogos;

create policy "admin apaga jogos" on public.jogos for delete to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "jogador da partida ou admin lanca placar" on public.jogos for update to authenticated
  using (
    exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin')
    or (
      exists (select 1 from public.rodadas r where r.id = jogos.rodada_id and r.status = 'ativa')
      and exists (
        select 1 from public.jogadores j
        where j.user_id = auth.uid()
          and j.nome = any (array[jogos.dupla_a_1, jogos.dupla_a_2, jogos.dupla_b_1, jogos.dupla_b_2])
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
          and j.nome = any (array[jogos.dupla_a_1, jogos.dupla_a_2, jogos.dupla_b_1, jogos.dupla_b_2])
      )
    )
  );
