-- 028_data_completeness_engine.sql
-- Derived programme completeness and outstanding-data engine.

create schema if not exists governance;

create table if not exists governance.programme_completeness (
  programme_id bigint primary key references public.programme(id) on delete cascade,
  completeness_pct numeric(5,2) not null default 0,
  status text not null default 'INCOMPLETE' check (status in ('COMPLETE','INCOMPLETE','ACTION_REQUIRED')),
  missing_fields jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);

alter table governance.programme_completeness enable row level security;
revoke all on governance.programme_completeness from anon, authenticated;

create or replace function governance.calculate_programme_completeness(p_programme_id bigint)
returns void
language plpgsql
security definer
set search_path = public, governance
as $$
declare
  p public.programme%rowtype;
  total integer := 0;
  missing integer := 0;
  missing_list jsonb := '[]'::jsonb;
  pct numeric(5,2);
begin
  select * into p from public.programme where id=p_programme_id;
  if not found then return; end if;

  -- Core fields: intentionally derived rather than enforcing NOT NULL at the DB level.
  if p.client_id is null then total:=total+1; missing:=missing+1; missing_list:=missing_list||jsonb_build_array('client_id'); else total:=total+1; end if;
  if nullif(trim(p.programme_name),'') is null then total:=total+1; missing:=missing+1; missing_list:=missing_list||jsonb_build_array('programme_name'); else total:=total+1; end if;
  if p.start_date is null then total:=total+1; missing:=missing+1; missing_list:=missing_list||jsonb_build_array('start_date'); else total:=total+1; end if;
  if p.end_date is null then total:=total+1; missing:=missing+1; missing_list:=missing_list||jsonb_build_array('end_date'); else total:=total+1; end if;

  pct := case when total=0 then 100 else round(((total-missing)::numeric/total)*100,2) end;

  insert into governance.programme_completeness(programme_id,completeness_pct,status,missing_fields,calculated_at)
  values(p_programme_id,pct,case when missing=0 then 'COMPLETE' else 'ACTION_REQUIRED' end,missing_list,now())
  on conflict(programme_id) do update set completeness_pct=excluded.completeness_pct,status=excluded.status,missing_fields=excluded.missing_fields,calculated_at=excluded.calculated_at;
end;
$$;

revoke all on function governance.calculate_programme_completeness(bigint) from public;

create or replace function governance.refresh_programme_completeness()
returns void
language plpgsql
security definer
set search_path = public, governance
as $$
declare r record;
begin
  for r in select id from public.programme loop
    perform governance.calculate_programme_completeness(r.id);
  end loop;
end;
$$;
revoke all on function governance.refresh_programme_completeness() from public;

comment on table governance.programme_completeness is 'Derived data-quality view of programme completeness; NULL in required operational fields means action required, not optional.';
