// Fonte única de verdade para o total de vagas na lista principal.
// Antes disso, Confirmacao.jsx tinha um valor fixo (24) enquanto Admin.jsx
// usava um valor guardado no localStorage de cada admin — os dois podiam
// divergir silenciosamente. Se o formato da liga mudar, atualize só aqui.
export const VAGAS_LISTA_PRINCIPAL = 24

// Formatos de rodada disponíveis. Admin.jsx usa isso pra fechar a lista de
// verdade (prepararFechamento); Confirmacao.jsx usa pra mostrar a prévia de
// chaves pro jogador (calcularPrevia). Antes vivia só dentro de Admin.jsx e
// Confirmacao.jsx assumia sempre 12🥇+12🥈 fixo — em formato 28 ou 32 a
// prévia mostrava vagas/subida erradas. Se um formato novo for adicionado,
// só precisa mudar aqui.
export const FORMATOS_RODADA = [
  { label: "24", sub: "12🥇+12🥈", ouro: 12, prata: 12, total: 24 },
  { label: "28", sub: "12🥇+16🥈", ouro: 12, prata: 16, total: 28 },
  { label: "32", sub: "16🥇+16🥈", ouro: 16, prata: 16, total: 32 },
]
