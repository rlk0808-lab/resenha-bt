-- Bug: dois cadastros pra "Hugo" — Robson e Marcel aprovaram o mesmo
-- cadastro pendente ao mesmo tempo. `aprovarCadastro()` (Admin.jsx) faz
-- "criar/vincular jogador" e "marcar cadastros_pendentes como aprovado"
-- como dois passos separados, sem checar se o status ainda era 'pendente'
-- no segundo passo — mesma classe de bug já corrigida em
-- 20260816140000_confirma_presenca_atomica.sql (decisão de negócio lida
-- no client, sem trava, decidida duas vezes em paralelo). Resultado aqui:
-- dois jogadores criados pro mesmo cadastro, um com o user_id (acesso) e
-- outro sem, exigindo correção manual depois.
--
-- Correção: aprovação inteira (checar status + criar/vincular jogador +
-- marcar aprovado) vira uma função SECURITY DEFINER, travada por
-- pg_advisory_xact_lock keyed no id do cadastro pendente — mesmo padrão de
-- confirmar_presenca()/cancelar_confirmacao(). A segunda aprovação
-- concorrente do mesmo cadastro (seja "aprovar" de novo, seja duas pessoas
-- clicando ao mesmo tempo) vê status <> 'pendente' e falha com
-- 'cadastro_ja_processado', em vez de criar um jogador duplicado.
create or replace function public.aprovar_cadastro(
  p_pendente_id uuid,
  p_jogador_id uuid,
  p_novo_nome text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_user_id uuid;
  v_nome_pendente text;
  v_resultado_id uuid;
begin
  if not exists (select 1 from jogadores where user_id = auth.uid() and role = 'admin') then
    raise exception 'apenas_admin';
  end if;

  -- Trava só esse cadastro — outras aprovações continuam em paralelo.
  perform pg_advisory_xact_lock(hashtext(p_pendente_id::text));

  select status, user_id, nome into v_status, v_user_id, v_nome_pendente
    from cadastros_pendentes where id = p_pendente_id;
  if v_status is null then
    raise exception 'cadastro_nao_encontrado';
  end if;
  if v_status <> 'pendente' then
    raise exception 'cadastro_ja_processado';
  end if;

  if p_jogador_id is not null then
    update jogadores set user_id = v_user_id, apelido = v_nome_pendente where id = p_jogador_id;
    if not found then
      raise exception 'jogador_nao_encontrado';
    end if;
    v_resultado_id := p_jogador_id;
  elsif p_novo_nome is not null and trim(p_novo_nome) <> '' then
    insert into jogadores (nome, apelido, chave, ativo, user_id)
      values (trim(p_novo_nome), v_nome_pendente, 'prata', true, v_user_id)
      returning id into v_resultado_id;
  else
    raise exception 'informe_jogador_existente_ou_nome_novo';
  end if;

  update cadastros_pendentes set status = 'aprovado' where id = p_pendente_id;

  return v_resultado_id;
end;
$$;

grant execute on function public.aprovar_cadastro(uuid, uuid, text) to authenticated;
