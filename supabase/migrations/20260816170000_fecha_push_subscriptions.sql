-- `push_subscriptions` liberava SELECT pra qualquer autenticado
-- (using(true)) — qualquer jogador logado conseguia ler o endpoint/chaves
-- de notificação de QUALQUER outro jogador. Isso só existia porque o
-- fluxo de "notificar quem foi promovido da lista de espera"/"notificar
-- quem foi mencionado" lia a subscription de OUTRA pessoa direto do
-- navegador antes de mandar pro /api/send-notification.
--
-- Agora esse endpoint usa a service_role key no servidor pra buscar as
-- subscriptions (bypassa RLS de propósito, só ali) — o client só manda o
-- jogador_id a notificar, nunca lê a subscription de mais ninguém. Com
-- isso dá pra fechar a policy pública: cada jogador só enxerga a própria
-- subscription (a policy "jogador gerencia propria subscription", já
-- existente, cobre esse caso — select/insert/update/delete só da própria).

drop policy if exists "autenticados podem ler subscriptions" on public.push_subscriptions;
