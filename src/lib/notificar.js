import { supabase } from './supabase'

// Manda o(s) jogador_id(s) a notificar — não mais a subscription (endpoint
// + chaves) em si. Quem busca a subscription agora é o servidor, usando a
// service_role key, que nunca chega no navegador (ver
// api/send-notification.js) — antes o client precisava ler
// push_subscriptions de OUTRO jogador pra montar essa chamada, o que só
// era possível porque a tabela estava aberta pra leitura geral.
// jogadorIds omitido/vazio = notifica todo mundo inscrito.
export async function enviarPush({ jogadorIds, title, body, url }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await fetch('/api/send-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ jogadorIds, title, body, url }),
  })
}
