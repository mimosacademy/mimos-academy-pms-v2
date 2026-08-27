-- 034_import_approval_integrity.sql
-- Approval integrity and immutable review decisions.

alter table intake.review enable row level security;
revoke all on intake.review from anon,authenticated;

create or replace function intake.prevent_review_mutation()
returns trigger language plpgsql security definer set search_path=intake,public as $$
begin
  raise exception 'Review decisions are immutable';
end;
$$;
revoke all on function intake.prevent_review_mutation() from public;
drop trigger if exists trg_review_immutable on intake.review;
create trigger trg_review_immutable before update or delete on intake.review for each row execute function intake.prevent_review_mutation();

create or replace function intake.validate_change_set_approval(p_change_set_id bigint)
returns boolean language plpgsql security definer set search_path=intake,public as $$
declare bad integer;
begin
 select count(*) into bad from intake.change_set_item
 where change_set_id=p_change_set_id
 and (operation not in ('NEW','UPDATE') or status not in ('VALIDATED','APPROVED') or proposed_payload is null);
 return bad=0 and exists(select 1 from intake.change_set where id=p_change_set_id);
end;
$$;
revoke all on function intake.validate_change_set_approval(bigint) from public,anon,authenticated;
comment on function intake.validate_change_set_approval(bigint) is 'Server-side gate ensuring every proposed item is a valid NEW/UPDATE before approval.';
