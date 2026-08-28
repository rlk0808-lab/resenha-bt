-- Renomeia a liga em andamento de "Torneio de Inverno 2026" pra "Torneio de
-- Primavera 2026" (novo regulamento da temporada, sem encerrar/reiniciar a
-- liga — mesmas rodadas, mesma Ouro/Prata, só o nome muda).
update public.rodadas set liga = 'Torneio de Primavera 2026' where liga = 'Torneio de Inverno 2026';

-- Também troca o default da coluna, pra qualquer inserção futura sem `liga`
-- explícito já nascer com o nome certo.
alter table public.rodadas alter column liga set default 'Torneio de Primavera 2026';
