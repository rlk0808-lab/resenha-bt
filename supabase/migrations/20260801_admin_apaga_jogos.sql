-- Permite aos admins da liga apagar jogos (ex: "Cancelar sorteio" no Admin).
-- Sem isso, DELETE em jogos falha silenciosamente (RLS bloqueia sem erro),
-- o que também afeta o fluxo de qualify (que já tentava apagar jogos antes
-- de gerar um novo sorteio).

create policy "admin apaga jogos"
on public.jogos
for delete
to authenticated
using (
  auth.uid() in (
    'a60b3e0f-5528-400c-8e0f-8fb3f9226070', -- Robson
    '118a0596-1e11-4943-b8f2-9e49bd234dcf', -- Celso
    'a506b568-7183-4aab-b86f-5adbb5f435a6'  -- Marcel
  )
);
