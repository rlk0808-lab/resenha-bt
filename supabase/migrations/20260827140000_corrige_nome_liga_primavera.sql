-- Corrige a migration anterior (20260827130000): ela renomeou por engano a
-- liga já ENCERRADA "Torneio de Inverno 2026" — a liga realmente ativa em
-- produção se chama "Liga 3 - 2026". Reverte a liga encerrada pro nome
-- original e renomeia a liga certa.
update public.rodadas set liga = 'Torneio de Inverno 2026' where liga = 'Torneio de Primavera 2026';
update public.rodadas set liga = 'Torneio de Primavera 2026' where liga = 'Liga 3 - 2026';
