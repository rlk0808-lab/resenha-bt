// PostgREST usa vírgula pra separar condições dentro de um .or(...) e
// parênteses pra agrupar — um valor de filtro que contenha esses
// caracteres (ex: apelido "Ana, Paula" ou "Zé (Capixaba)") quebra o
// parsing da query inteira se for interpolado cru. Valores com vírgula,
// parênteses ou aspas precisam vir entre aspas duplas.
export function escaparValorFiltroOr(valor) {
  if (/[,()"]/.test(valor)) {
    return `"${valor.replace(/"/g, '\\"')}"`
  }
  return valor
}
