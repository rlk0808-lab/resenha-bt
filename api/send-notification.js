import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:resenhabt@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  
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