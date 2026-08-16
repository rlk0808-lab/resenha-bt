-- Placar de `jogos` só era validado no HTML (min="0" max="7" no input) —
-- fácil de burlar mandando qualquer valor direto pra API do Supabase.
-- Mesmo limite que o client já usa, agora garantido no banco também.
-- NOT VALID: não varre/rejeita linhas históricas existentes (não sabemos
-- se todo jogo antigo respeitou esse intervalo) — só passa a valer pra
-- inserts/updates novos a partir de agora.
alter table public.jogos
  add constraint jogos_placar_a_valido check (placar_a is null or (placar_a between 0 and 7)) not valid,
  add constraint jogos_placar_b_valido check (placar_b is null or (placar_b between 0 and 7)) not valid;
