import { supabase } from './supabase'

// /api/send-notification agora exige um token de sessão válido (ver
// api/send-notification.js) — centraliza aqui pra não repetir
// `getSession()` + header em cada tela que dispara push.
export async function enviarPush({ subscriptions, title, body, url }) {
  if (!subscriptions || subscriptions.length === 0) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await fetch('/api/send-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ subscriptions, title, body, url }),
  })
}
