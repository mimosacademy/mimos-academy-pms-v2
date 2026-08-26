-- 002_lookup_tables.sql

create table if not exists public.account_type (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_role (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sector (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_type (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_method (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_status (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_type (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_status (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programme_status (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_status (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_status (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_item_status (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_terms (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  days integer,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.speed_to_market (
  id bigint generated always as identity primary key,
  code varchar(10) not null unique,
  name varchar(50) not null,
  quarter varchar(10),
  year integer check (year between 2000 and 2100),
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programme_category (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_type (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_type (
  id bigint generated always as identity primary key,
  code varchar(20) not null unique,
  name varchar(100) not null,
  description varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.account_type(code,name,description) values
('MSSB','MIMOS Services Sdn Bhd','Primary operating subsidiary'),('MB','MIMOS Berhad','Parent company / holding entity'),('MIMOS','MIMOS Group','Generic MIMOS entity'),('MH','MIMOS Holdings','Investment holding company'),('OTHER','Other','Third party or external entity') on conflict(code) do nothing;

insert into public.staff_role(code,name,description) values
('MASB_TEAM','MASB Team','Core MIMOS Academy team member'),('SUPER_ADMIN','Super Admin','System administrator with full access'),('MANAGER','Manager','Team manager or department head'),('PIC','Person In Charge','Assigned owner for programmes'),('SALES','Sales','Business development and sales'),('FINANCE','Finance','Financial operations and billing'),('TRAINER','Trainer','Training delivery personnel'),('INTERN','Intern','Internship or temporary staff') on conflict(code) do nothing;

insert into public.sector(code,name,description) values
('GOVT','Government','Federal, state, or local government agencies'),('PRIVATE','Private Sector','Private companies and corporations'),('INTERCO','Intercompany','Internal MIMOS group entities'),('ACADEMIA','Academia','Universities, colleges, and educational institutions'),('NGO','NGO / Foundation','Non-governmental organizations and foundations') on conflict(code) do nothing;

insert into public.training_type(code,name,description) values
('PUBLIC','Public Training','Open enrollment training programmes'),('INHOUSE','In-House Training','Customized training at client premises'),('ONLINE','Online Training','Virtual or remote training delivery'),('HYBRID','Hybrid Training','Blended online and face-to-face training'),('WORKSHOP','Workshop','Hands-on practical workshop sessions'),('SEMINAR','Seminar','Knowledge sharing and seminar events') on conflict(code) do nothing;

insert into public.payment_method(code,name,description) values
('HRDCORP','HRDCorp Claimable','Training claimable through HRDCorp'),('SELF_PAY','Self-Pay','Direct payment by client'),('EPEROLEHAN','ePerolehan','Government e-procurement system'),('GRANT','Grant Funded','Government or institutional grant funding'),('INSTALLMENT','Installment','Payment by installment plan'),('BANK_TRANSFER','Bank Transfer','Direct bank transfer payment') on conflict(code) do nothing;

insert into public.payment_status(code,name,description) values
('PAID','Paid','Payment received in full'),('UNPAID','Unpaid','Payment not yet received'),('PENDING','Pending','Payment processing or awaiting confirmation'),('PARTIAL','Partially Paid','Partial payment received'),('OVERDUE','Overdue','Payment past due date'),('CANCELLED','Cancelled','Payment cancelled or refunded'),('UNKNOWN','Unknown','Payment status not determined') on conflict(code) do nothing;

insert into public.quotation_type(code,name,description) values
('TRAINING','Training','Training programme quotation'),('CONSULTANCY','Consultancy','Consulting services quotation'),('SERVICE','Service','General service quotation'),('RENTAL','Space Rental','Facility or space rental quotation'),('PRODUCT','Product','Product or equipment quotation'),('CERT_PRINT','Certificate Printing','Certificate printing services') on conflict(code) do nothing;

insert into public.quotation_status(code,name,description) values
('SENT','Sent','Quotation sent to client'),('IN_PROGRESS','In Progress','Quotation under preparation or revision'),('ACCEPTED','Accepted','Quotation accepted by client'),('REJECTED','Rejected','Quotation rejected by client'),('EXPIRED','Expired','Quotation expired without response'),('REVISED','Revised','Revised quotation issued'),('WON','Won','Quotation converted to order'),('LOST','Lost','Quotation lost to competitor') on conflict(code) do nothing;

insert into public.programme_status(code,name,description) values
('PLANNED','Planned','Programme planned but not yet started'),('CONFIRMED','Confirmed','Programme confirmed with client'),('IN_PROGRESS','In Progress','Programme currently being delivered'),('DELIVERED','Delivered','Programme delivery completed'),('COMPLETED','Completed','Programme fully completed and closed'),('CANCELLED','Cancelled','Programme cancelled'),('POSTPONED','Postponed','Programme postponed to later date'),('ON_HOLD','On Hold','Programme temporarily on hold') on conflict(code) do nothing;

insert into public.project_status(code,name,description) values
('DONE','Done','Project completed successfully'),('FOLLOW_UP','Follow Up','Requires follow-up action'),('IN_PROGRESS','In Progress','Project actively being worked'),('PENDING','Pending','Awaiting input or decision'),('CLOSED','Closed','Project closed - no further action'),('KIV','KIV','Kept in view - under monitoring') on conflict(code) do nothing;

insert into public.opportunity_status(code,name,description) values
('EARLY_ENGAGEMENT','Early Engagement','Initial contact and exploration'),('QUALIFIED_LEAD','Qualified Lead','Lead qualified and tender in progress'),('PROPOSAL_SUBMITTED','Proposal Submitted','Proposal or tender submitted'),('NEGOTIATION','Negotiation','Under negotiation with client'),('VERBAL_COMMITMENT','Verbal Commitment','Verbal agreement received'),('CONTRACT_SIGNED','Contract Signed / PO Issued','Contract signed or purchase order received'),('LOST','Lost / No-go','Opportunity lost or declined'),('WON','Won','Opportunity secured') on conflict(code) do nothing;

insert into public.action_item_status(code,name,description) values
('NOT_STARTED','Not Started','Action item not yet started'),('IN_PROGRESS','In Progress','Action item actively being worked'),('PENDING','Pending','Action item awaiting external input'),('DONE','Done','Action item completed'),('KIV','KIV','Kept in view - under monitoring'),('OVERDUE','Overdue','Action item past due date'),('CANCELLED','Cancelled','Action item cancelled') on conflict(code) do nothing;

insert into public.payment_terms(code,name,days,description) values
('NET_30','Net 30 Days',30,'Payment due within 30 days'),('NET_14','Net 14 Days',14,'Payment due within 14 days'),('NET_7','Net 7 Days',7,'Payment due within 7 days'),('NET_60','Net 60 Days',60,'Payment due within 60 days'),('IMMEDIATE','Immediate',0,'Immediate payment upon invoice'),('UPON_COMPLETION','Upon Completion',null,'Payment upon programme completion'),('MILESTONE','Milestone Based',null,'Payment based on milestone achievement') on conflict(code) do nothing;

insert into public.speed_to_market(code,name,quarter,year,description) values
('Q1_2026','Q1 2026','Q1',2026,'First quarter 2026'),('Q2_2026','Q2 2026','Q2',2026,'Second quarter 2026'),('Q3_2026','Q3 2026','Q3',2026,'Third quarter 2026'),('Q4_2026','Q4 2026','Q4',2026,'Fourth quarter 2026'),('Q1_2027','Q1 2027','Q1',2027,'First quarter 2027'),('Q2_2027','Q2 2027','Q2',2027,'Second quarter 2027') on conflict(code) do nothing;

insert into public.programme_category(code,name,description) values
('AI_TRAINING','AI Training','Artificial Intelligence related training'),('SEMICONDUCTOR','Semiconductor','Semiconductor technology training'),('PROJECT_MGMT','Project Management','Project management training'),('LEADERSHIP','Leadership','Leadership and management training'),('TECHNICAL','Technical Skills','General technical skills training'),('SOFT_SKILLS','Soft Skills','Soft skills and personal development'),('CERTIFICATION','Certification','Professional certification programmes'),('CONSULTANCY','Consultancy','Consulting and advisory services'),('RENTAL','Space Rental','Facility and space rental services'),('OTHER','Other','Other programmes and services') on conflict(code) do nothing;

insert into public.service_type(code,name,description) values
('TRAINING','Training','Training delivery service'),('CONSULTING','Consulting','Consulting and advisory service'),('RENTAL','Rental','Space or equipment rental'),('CERTIFICATION','Certification','Certification and assessment service'),('EVENT','Event','Event management and hosting'),('PRINTING','Printing','Certificate and document printing') on conflict(code) do nothing;

insert into public.revenue_type(code,name,description) values
('TRAINING_AI','Training - AI','AI training revenue'),('TRAINING_SEMI','Training - Semiconductor','Semiconductor training revenue'),('TRAINING_GTM','Training - GTM','General training management revenue'),('TRAINING_TTT','Training - TTT','Train-the-trainer revenue'),('TRAINING_RD','Training - R&D','R&D related training revenue'),('RENTAL_SPACE','Rental - Space','Space rental revenue'),('SERVICE_OTHER','Service - Other','Other service revenue'),('CONSULTING','Consulting','Consulting revenue'),('PRODUCT_SALE','Product Sale','Product sales revenue') on conflict(code) do nothing;
