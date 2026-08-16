import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:resenhabt@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Antes esse endpoint aceitava qualquer chamada sem checar quem está
  // pedindo — dava pra disparar push arbitrário (phishing em nome do
  // app) só sabendo a URL. Agora exige um token de sessão válido do
  // Supabase (mesmo usado pelo app pra tudo mais autenticado).
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Não autenticado' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Sessão inválida' })

  const { subscriptions, title, body, url } = req.body
  if (!subscriptions || !title) return res.status(400).json({ error: 'Dados inválidos' })

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