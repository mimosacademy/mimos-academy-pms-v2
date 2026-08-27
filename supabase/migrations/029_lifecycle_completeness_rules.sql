-- 029_lifecycle_completeness_rules.sql
-- Lifecycle-aware completeness: NULL means outstanding information, not optional data.

create schema if not exists governance;

create table if not exists governance.completeness_rule (
  id bigint generated always as identity primary key,
  lifecycle_stage text not null check (lifecycle_stage in ('REGISTRATION','ACTIVE','COMMERCIAL','FINANCIAL','CLOSURE')),
  field_key text not null,
  label text not null,
  severity text not null default 'HIGH' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  unique(lifecycle_stage,field_key)
);

insert into governance.completeness_rule(lifecycle_stage,field_key,label,severity) values
('REGISTRATION','programme_name','Programme Name','CRITICAL'),
('REGISTRATION','client_id','Client','CRITICAL'),
('ACTIVE','start_date','Start Date','HIGH'),
('ACTIVE','end_date','End Date','HIGH'),
('COMMERCIAL','quotation','Quotation','HIGH'),
('COMMERCIAL','purchase_order','Purchase Order','HIGH'),
('FINANCIAL','invoice','Invoice','CRITICAL'),
('FINANCIAL','payment','Payment','HIGH'),
('CLOSURE','completion_date','Completion Date','HIGH')
on conflict(lifecycle_stage,field_key) do nothing;

alter table governance.completeness_rule enable row level security;
revoke all on governance.completeness_rule from anon, authenticated;

comment on table governance.completeness_rule is 'Lifecycle-aware required-data rules. A missing value creates an outstanding action rather than being treated as optional.';
