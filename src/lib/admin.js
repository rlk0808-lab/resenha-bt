// Mesmos 3 UIDs usados nas policies de RLS de `jogos`
// (placar_por_jogador.sql, admin_apaga_jogos.sql) — checagem de admin no
// front é só UX (esconder/bloquear rota), a proteção de verdade é no banco.
export const ADMINS = [
  'a60b3e0f-5528-400c-8e0f-8fb3f9226070', // Robson
  '118a0596-1e11-4943-b8f2-9e49bd234dcf', // Celso
  'a506b568-7183-4aab-b86f-5adbb5f435a6', // Marcel
]

export function isAdmin(session) {
  return ADMINS.includes(session?.user?.id)
}
