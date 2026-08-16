-- `convites` liberava SELECT pra qualquer visitante anônimo com
-- `using(true)` — qualquer um, sem estar logado, conseguia listar TODOS
-- os convites (token + email associado, usados ou não). O motivo dessa
-- policy era só permitir a tela de Cadastro validar o próprio token do
-- link antes do usuário logar — mas `using(true)` libera a tabela
-- inteira, não só a linha do token que a pessoa já tem.
--
-- Correção: remove o SELECT público e move a validação pra uma function
-- (security definer) que só devolve se o token é válido e por quê não é
-- (nunca a linha inteira). `Cadastro.jsx` passa a chamar essa function em
-- vez de fazer select direto. A policy de UPDATE que marca o convite como
-- usado continua igual — já era escopada (só usado:false→true).
--
-- Bônus: as policies de admin de convites (ver/inserir/deletar) também
-- tinham using(true)/with check(true) — mesma correção de
-- 20260816130000_fecha_rls_admin.sql, aplicada aqui.

drop policy if exists "convites_leitura_publica" on public.convites;

create or replace function public.validar_convite(p_token text)
returns table(valido boolean, motivo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite public.convites%rowtype;
begin
  select * into v_convite from public.convites where token = p_token limit 1;
  if v_convite.id is null then
    return query select false, 'nao_encontrado';
  elsif v_convite.usado then
    return query select false, 'usado';
  elsif v_convite.expires_at < now() then
    return query select false, 'expirado';
  else
    return query select true, null::text;
  end if;
end;
$$;

grant execute on function public.validar_convite(text) to anon, authenticated;

drop policy if exists "Admin pode ver convites" on public.convites;
drop policy if exists "Admin pode inserir convites" on public.convites;
drop policy if exists "Admin pode deletar convites" on public.convites;

create policy "admin ve convites" on public.convites for select to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin insere convites" on public.convites for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));

create policy "admin deleta convites" on public.convites for delete to authenticated
  using (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));
