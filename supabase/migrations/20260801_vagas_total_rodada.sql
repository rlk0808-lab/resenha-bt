-- Total de vagas da rodada (24/28/32), definido no Admin em "Formato da Rodada".
-- Antes disso, a lista de confirmados usava um número fixo (24) no código,
-- então mudar o formato no Admin não refletia em Início/Confirmação.

alter table public.rodadas add column if not exists vagas_total integer;
