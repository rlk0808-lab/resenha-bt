-- `temporadas` (arquivo histórico gravado ao "Encerrar Temporada") tinha RLS
-- habilitado com só uma policy de SELECT — nunca existiu policy de INSERT.
-- Resultado: o botão "Encerrar Temporada e Iniciar Nova Liga" sempre falhava
-- silenciosamente no primeiro insert (Admin.jsx: encerrarTemporada()), pra
-- qualquer admin. Mesmo padrão de checagem real de admin usado em
-- 20260816130000_fecha_rls_admin.sql.

create policy "admin insere temporadas" on public.temporadas for insert to authenticated
  with check (exists (select 1 from public.jogadores where jogadores.user_id = auth.uid() and jogadores.role = 'admin'));
