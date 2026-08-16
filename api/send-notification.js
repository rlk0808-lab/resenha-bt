import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:resenhabt@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Cliente com a anon key só pra validar o token de quem está chamando.
const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

// Cliente com a service_role key — só existe aqui no servidor, nunca no
// bundle do front (por isso sem prefixo VITE_). Bypassa RLS de propósito:
// é o único jeito de ler o push_subscriptions de OUTRO jogador (ex:
// notificar quem foi promovido da lista de espera) sem deixar o
// navegador de qualquer jogador ler o endpoint/chaves de notificação de
// todo mundo, que era o problema antes.
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Antes esse endpoint aceitava qualquer chamada sem checar quem está
  // pedindo — dava pra disparar push arbitrário (phishing em nome do
  // app) só sabendo a URL. Agora exige um token de sessão válido do
  // Supabase (mesmo usado pelo app pra tudo mais autenticado).
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Não autenticado' })
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Sessão inválida' })

  // jogadorIds ausente/vazio = broadcast pra todo mundo inscrito (usado
  // em "lista aberta"/"sorteio publicado"). Com jogadorIds, notifica só
  // esses jogadores específicos.
  const { jogadorIds, title, body, url } = req.body
  if (!title) return res.status(400).json({ error: 'Dados inválidos' })

  let query = supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (Array.isArray(jogadorIds) && jogadorIds.length > 0) query = query.in('jogador_id', jogadorIds)
  const { data: subscriptions, error: subError } = await query
  if (subError) return res.status(500).json({ error: subError.message })
  if (!subscriptions || subscriptions.length === 0) return res.json({ enviados: 0, total: 0 })

  const payload = JSON.stringify({ title, body, url: url || '/' })
  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload)
    )
  )

  const sucessos = results.filter(r => r.status === 'fulfilled').length
  res.json({ enviados: sucessos, total: subscriptions.length })
}
