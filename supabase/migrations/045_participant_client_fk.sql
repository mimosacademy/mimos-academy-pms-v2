-- 045_participant_client_fk.sql
-- Align the participant schema with the PMS web application's participant model.
-- The web client already accepts client_id for participants and embeds client:client_id(...).

alter table public.participant
  add column if not exists client_id bigint;

alter table public.participant
  drop constraint if exists participant_client_id_fkey;

alter table public.participant
  add constraint participant_client_id_fkey
  foreign key (client_id)
  references public.client(id)
  on delete set null;

create index if not exists idx_participant_client_id
  on public.participant(client_id);
