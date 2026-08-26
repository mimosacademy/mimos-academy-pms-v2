-- 003_master_tables.sql

create table if not exists public.staff (
  id bigint generated always as identity primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  staff_number varchar(50),
  full_name varchar(100) not null,
  email varchar(255) not null unique,
  phone varchar(50),
  role_id bigint references public.staff_role(id) on delete set null,
  is_active boolean not null default true,
  source_file varchar(255),
  source_row_number integer,
  import_batch_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_staff_auth_user on public.staff(auth_user_id);
create index if not exists idx_staff_email on public.staff(lower(email));
create index if not exists idx_staff_role on public.staff(role_id);
create index if not exists idx_staff_active on public.staff(is_active);

create table if not exists public.account (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  account_type_id bigint references public.account_type(id) on delete set null,
  is_active boolean not null default true,
  source_file varchar(255),
  source_row_number integer,
  import_batch_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_account_type on public.account(account_type_id);
create index if not exists idx_account_active on public.account(is_active);

create table if not exists public.client (
  id bigint generated always as identity primary key,
  company_name varchar(255) not null,
  registration_number varchar(100),
  address text,
  sector_id bigint references public.sector(id) on delete set null,
  is_active boolean not null default true,
  source_file varchar(255),
  source_row_number integer,
  import_batch_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_client_name on public.client(company_name);
create index if not exists idx_client_sector on public.client(sector_id);
create index if not exists idx_client_active on public.client(is_active);

create table if not exists public.client_contact (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.client(id) on delete cascade,
  contact_name varchar(100) not null,
  contact_email varchar(255),
  contact_phone varchar(50),
  contact_designation varchar(100),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  source_file varchar(255),
  source_row_number integer,
  import_batch_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_contact_client on public.client_contact(client_id);
create index if not exists idx_contact_email on public.client_contact(lower(contact_email));
create index if not exists idx_contact_primary on public.client_contact(is_primary);

-- Initial profile mapping from readme/User Profiles Mapping.xlsx / source SQL.
-- auth_user_id is intentionally NULL until Supabase Auth accounts are provisioned.
insert into public.staff(full_name,email,role_id,is_active)
select v.full_name, v.email, r.id, true
from (values
  ('Zalina Sayuti','zalina@mimos.my','MASB_TEAM'),
  ('Siti Sarah','sitisarah.ramli@mimos.my','MASB_TEAM'),
  ('Abu Sa''id','abu.razak@mimos.my','MASB_TEAM'),
  ('Qusyairi','qusyairi.zolkefle@mimos.my','MASB_TEAM'),
  ('Fuziah','fuziah.rahim@mimos.my','MASB_TEAM'),
  ('Adilah','adilah.nisman@mimos.my','MASB_TEAM'),
  ('Aisyah','aisyah.alias@mimos.my','MASB_TEAM'),
  ('Dr. Ahmad Nizar','nizar.harun@mimos.my','MANAGER'),
  ('Farrah','farrah.johar@mimos.my','MASB_TEAM'),
  ('Sholihin','sholihin.abdullah@mimos.my','MASB_TEAM'),
  ('Dr. Afiq','muhammadafiq.azmi@mimos.my','MASB_TEAM'),
  ('Ainur Najwa','ainur.rodzi@mimos.my','MASB_TEAM'),
  ('Mohd Suhairi','suhairi.soobni@mimos.my','MASB_TEAM'),
  ('Omar','omar.azmi@mimos.my','MASB_TEAM'),
  ('Fatin Firzana','fatin.pata@mimos.my','MASB_TEAM'),
  ('Amalia Adriana','amalia.rizam@mimos.my','MASB_TEAM'),
  ('Nur Aleeya','aleeya.amran@mimos.my','MASB_TEAM'),
  ('Muhammad Yusuf','yusuf.zolkipli@mimos.my','MASB_TEAM'),
  ('Admin','saidrazak88@gmail.com','SUPER_ADMIN')
) as v(full_name,email,role_code) join public.staff_role r on r.code=v.role_code
on conflict(email) do update set full_name=excluded.full_name, role_id=excluded.role_id;

insert into public.account(code,name,description,account_type_id,is_active) select * from (values
('MSSB','MIMOS Services Sdn Bhd','Primary operating subsidiary for MIMOS Academy',(select id from public.account_type where code='MSSB'),true),
('MB','MIMOS Berhad','Parent company entity',(select id from public.account_type where code='MB'),true),
('MIMOS','MIMOS Group','Generic MIMOS group billing',(select id from public.account_type where code='MIMOS'),true),
('MH','MIMOS Holdings Sdn Bhd','Investment holding company',(select id from public.account_type where code='MH'),true)
) as x(code,name,description,account_type_id,is_active)
on conflict(code) do update set name=excluded.name, description=excluded.description, account_type_id=excluded.account_type_id;
