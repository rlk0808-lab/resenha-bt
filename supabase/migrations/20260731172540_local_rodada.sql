-- Local por rodada: permite sobrescrever o local padrão (Lake Beach Sports)
-- pontualmente, sem precisar mexer em código. Quando vazio, o app usa o padrão.

alter table public.rodadas add column if not exists local text;
