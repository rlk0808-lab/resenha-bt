-- Feed: comentários (respostas) em posts + foto no post.
-- Sem isso, o novo Feed (comentários/fotos) não funciona.

-- 1. Coluna de foto no post
alter table public.feed_posts add column if not exists foto_url text;

-- 2. Tabela de comentários/respostas nos posts do feed
create table if not exists public.feed_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  jogador_id uuid not null references public.jogadores(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now()
);

alter table public.feed_comentarios enable row level security;

-- Qualquer jogador autenticado pode ler todos os comentários
create policy "ler comentarios do feed"
on public.feed_comentarios
for select
to authenticated
using (true);

-- Só pode comentar em nome do próprio jogador vinculado à conta logada
create policy "comentar como o proprio jogador"
on public.feed_comentarios
for insert
to authenticated
with check (
  exists (
    select 1 from public.jogadores j
    where j.id = feed_comentarios.jogador_id and j.user_id = auth.uid()
  )
);

-- Só pode apagar o próprio comentário
create policy "apagar o proprio comentario"
on public.feed_comentarios
for delete
to authenticated
using (
  exists (
    select 1 from public.jogadores j
    where j.id = feed_comentarios.jogador_id and j.user_id = auth.uid()
  )
);
