-- PERT Personal Trainer: esquema mínimo para sincronización opcional.
-- Ejecutar una vez en Supabase: SQL Editor -> New query -> pegar -> Run.
-- Una sola tabla de documentos por usuario. La app guarda:
--   key = 'session:<id>'   una sesión terminada (inmutable)
--   key = 'meta'           plantillas, ejercicios propios, tumbas de borrado y tiempos de fotos
--   key = 'photo:<ejId>'   foto de una máquina (JPEG en data URL)

create table if not exists public.pert_docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null check (char_length(key) between 1 and 80),
  body       text        not null check (char_length(body) <= 600000),
  rev        integer     not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.pert_docs enable row level security;

-- Cada usuario solo ve y modifica sus propias filas.
create policy "pert_docs_select_own" on public.pert_docs for select to authenticated using (auth.uid() = user_id);
create policy "pert_docs_insert_own" on public.pert_docs for insert to authenticated with check (auth.uid() = user_id);
create policy "pert_docs_update_own" on public.pert_docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pert_docs_delete_own" on public.pert_docs for delete to authenticated using (auth.uid() = user_id);

-- Sin acceso para usuarios anónimos.
revoke all on public.pert_docs from anon;
grant select, insert, update, delete on public.pert_docs to authenticated;
