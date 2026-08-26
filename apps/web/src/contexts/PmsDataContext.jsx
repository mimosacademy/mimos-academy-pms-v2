import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PmsDataContext = createContext(null);

const TABLES = {
  clients: 'client',
  client_contacts: 'client_contact',
  programmes: 'programme',
  opportunities: 'opportunity',
  quotations: 'quotation',
  purchase_orders: 'purchase_order',
  invoices: 'invoice',
  payments: 'payment',
  training_delivery: 'training_delivery',
  training_statistics: 'training_stat',
  participants: 'participant',
  action_items: 'action_item',
  documents: 'document',
  audit_history: 'audit_history',
};

const TABLE_COLLECTIONS = Object.entries(TABLES).reduce((acc, [collection, table]) => {
  acc[table] = collection;
  return acc;
}, {});

const selectMap = {
  client:
    '*, sector:sector_id(code,name)',

  client_contact:
    '*, client:client_id(company_name)',

  programme:
    '*, client:client_id(id,company_name), programme_status:programme_status_id(code,name), training_type:training_type_id(code,name), programme_category:programme_category_id(code,name), account:account_id(code,name), account_manager:account_manager_id(full_name), pic:pic_id(full_name)',

  opportunity:
    '*, client:client_id(company_name), opportunity_status:opportunity_status_id(code,name), speed_to_market:speed_to_market_id(name,quarter,year), sector:sector_id(name), account_manager:account_manager_id(full_name), salesman:salesman_id(full_name)',

  quotation:
    '*, client:client_id(company_name), programme:programme_id(programme_code,title), quotation_status:quotation_status_id(code,name), quotation_type:quotation_type_id(code,name), training_type:training_type_id(code,name), account_manager:account_manager_id(full_name), pic:pic_id(full_name)',

  purchase_order:
    '*, client:client_id(company_name), programme:programme_id(programme_code,title), quotation:quotation_id(quotation_no)',

  invoice:
    '*, client:client_id(company_name), programme:programme_id(programme_code,title), payment_status:payment_status_id(code,name), payment_method:payment_method_id(code,name)',

  payment:
    '*, invoice:invoice_id(invoice_no), client:client_id(company_name), programme:programme_id(programme_code,title), payment_method:payment_method_id(code,name), payment_status:payment_status_id(code,name)',

  training_delivery:
    '*, programme:programme_id(programme_code,title)',

  training_stat:
    '*, programme:programme_id(programme_code,title)',

  participant:
    '*, programme:programme_id(programme_code,title), client:client_id(company_name)',

  action_item:
    '*, client:client_id(company_name), programme:programme_id(programme_code,title), action_item_status:action_item_status_id(code,name), assigned_to:assigned_to_id(full_name)',

  document:
    '*, programme:programme_id(programme_code,title)',

  audit_history:
    '*, programme:programme_id(programme_code,title)',
};

const DEFAULT_STATE = {
  loading: true,
  error: '',
  clients: [],
  clientContacts: [],
  programmes: [],
  opportunities: [],
  quotations: [],
  purchaseOrders: [],
  invoices: [],
  payments: [],
  trainingSessions: [],
  trainingStatistics: [],
  participants: [],
  actionItems: [],
  documents: [],
  auditHistory: [],
  notifications: [],
};

const COLLECTION_STATE_KEYS = {
  clients: 'clients',
  client_contacts: 'clientContacts',
  programmes: 'programmes',
  opportunities: 'opportunities',
  quotations: 'quotations',
  purchase_orders: 'purchaseOrders',
  invoices: 'invoices',
  payments: 'payments',
  training_delivery: 'trainingSessions',
  training_statistics: 'trainingStatistics',
  participants: 'participants',
  action_items: 'actionItems',
  documents: 'documents',
  audit_history: 'auditHistory',
};

/**
 * Financial values returned by PostgreSQL NUMERIC should NOT be converted
 * to JavaScript Number during data transport.
 *
 * NUMERIC is represented as a canonical decimal string:
 * "0.00"
 * "1250.50"
 * "-10.25"
 */
const moneyDecimal = (value) => {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }

  if (typeof value === 'bigint') {
    return `${value.toString()}.00`;
  }

  const raw = String(value).trim();

  if (!raw) {
    return '0.00';
  }

  if (!/^-?(?:\d+|\d+\.\d+|\.\d+)$/.test(raw)) {
    return '0.00';
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;

  let [whole, fraction = ''] = unsigned.split('.');

  whole = whole || '0';
  fraction = fraction || '';

  fraction = fraction.replace(/0+$/, '');

  if (fraction.length === 0) {
    return `${negative ? '-' : ''}${whole}.00`;
  }

  return `${negative ? '-' : ''}${whole}.${fraction}`;
};

/**
 * Convert a decimal string to fixed-point bigint representation.
 *
 * Example:
 *  "123.45" -> 12345n at scale 2
 *  "-10.5"  -> -1050n at scale 2
 */
const decimalToScaledBigInt = (value, scale = 2) => {
  const decimal = moneyDecimal(value);
  const negative = decimal.startsWith('-');
  const unsigned = negative ? decimal.slice(1) : decimal;

  let [whole, fraction = ''] = unsigned.split('.');

  whole = whole || '0';
  fraction = fraction.padEnd(scale, '0').slice(0, scale);

  const scaled =
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction || '0');

  return negative ? -scaled : scaled;
};

/**
 * Exact decimal addition using bigint fixed-point arithmetic.
 * No IEEE-754 floating point is involved.
 */
const decimalAdd = (values) => {
  const SCALE = 2;
  const BASE = 10n ** BigInt(SCALE);

  const total = values.reduce(
    (sum, value) => sum + decimalToScaledBigInt(value, SCALE),
    0n,
  );

  const negative = total < 0n;
  const absolute = negative ? -total : total;

  const whole = absolute / BASE;
  const fraction = String(absolute % BASE).padStart(SCALE, '0');

  return `${negative ? '-' : ''}${whole}.${fraction}`;
};

/**
 * Exact decimal subtraction.
 */
const decimalSubtract = (a, b) => {
  return decimalAdd([a, `-${moneyDecimal(b)}`]);
};

/**
 * Decimal multiplication by an integer.
 * Useful for counts/rates without converting money to Number.
 */
const decimalMultiplyInteger = (value, multiplier) => {
  const decimal = moneyDecimal(value);
  const numericMultiplier = BigInt(
    Number.isInteger(multiplier) ? multiplier : 0,
  );

  const SCALE = 2;
  const BASE = 10n ** BigInt(SCALE);

  const total =
    decimalToScaledBigInt(decimal, SCALE) * numericMultiplier;

  const negative = total < 0n;
  const absolute = negative ? -total : total;

  const whole = absolute / BASE;
  const fraction = String(absolute % BASE).padStart(SCALE, '0');

  return `${negative ? '-' : ''}${whole}.${fraction}`;
};

/**
 * Only use this at explicit UI boundaries where a numeric value is required
 * by a chart/library. Database/source financial values remain strings.
 */
const decimalNumberForUi = (value) => {
  const number = Number.parseFloat(moneyDecimal(value));

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
};

const relationName = (record, key, fallback = '') =>
  record?.[key]?.company_name ||
  record?.[key]?.full_name ||
  record?.[key]?.name ||
  fallback;

/**
 * ---------------------------------------------------------------------------
 * MAPPERS
 * ---------------------------------------------------------------------------
 */

const mapClient = (r) => ({
  id: r.id,
  name: r.company_name,
  industry: r.sector?.name || '',
  contactPerson: '',
  email: '',
  phone: '',
  location: r.address || '',
  status: r.is_active ? 'Active' : 'Inactive',
  since: r.created_at?.slice(0, 4) || '',
});

const mapClientContact = (r) => ({
  id: r.id,
  clientId: r.client_id || null,
  clientName: r.client?.company_name || '',
  name: r.full_name || r.contact_name || r.name || '',
  email: r.email || '',
  phone: r.phone || '',
  position: r.position || r.job_title || '',
  isPrimary: Boolean(r.is_primary),
});

const mapProgramme = (r) => ({
  id: r.id,
  code: r.programme_code || '',
  title: r.title,
  category: r.programme_category?.name || '',
  trainingType: r.training_type?.name || '',
  programmeCategory: r.programme_category?.name || '',
  client: r.client_id,
  clientName: relationName(r, 'client', '—'),
  status: r.programme_status?.name || 'Planned',
  accountManager: r.account_manager?.full_name || '',
  pic: r.pic?.full_name || '',
  trainer: '',
  startDate: r.start_date || '',
  endDate: r.end_date || '',
  durationDays: r.duration_days ?? 0,
  venue: '',
  participants: r.no_of_pax ?? 0,
  progress: r.programme_status?.code === 'COMPLETED' ? 100 : 0,

  contractValue: moneyDecimal(r.total_revenue_excl_tax),
  totalRevenueExclSST: moneyDecimal(r.total_revenue_excl_tax),
  sstAmount: moneyDecimal(r.total_sst_amount),
  totalRevenueInclSST: moneyDecimal(r.total_revenue_incl_tax),
  totalCollection: moneyDecimal(r.total_collected),
  outstandingAmount: moneyDecimal(r.total_outstanding),

  poNo: '',
  quotationId: null,
  poId: null,
  opportunityId: null,
  sessionsPlanned: 0,
  sessionsDelivered: 0,
  account: r.account?.code || '',
});

const mapOpportunity = (r) => ({
  id: r.id,
  client: r.client_id,
  clientName: relationName(r, 'client', '—'),
  title: r.project_title,
  projectTitle: r.project_title,

  value: moneyDecimal(r.forecast_value),
  forecastValue: moneyDecimal(r.forecast_value),
  stage: r.opportunity_status?.name || 'Early Engagement',
  opportunityStatus: r.opportunity_status?.name || 'Early Engagement',

  probability: moneyDecimal(r.probability_percentage),
  weightedForecast: moneyDecimal(r.weighted_value),
  weighted: moneyDecimal(r.weighted_value),
  securedOrderBookValue: moneyDecimal(r.secured_value),

  sector: r.sector?.name || '',
  accountManager: r.account_manager?.full_name || '',
  salesman: r.salesman?.full_name || '',
  expectedClose: r.expected_close_date || '',
  year: r.speed_to_market?.year || 0,
});

const mapQuotation = (r) => ({
  id: r.id,
  quoteNo: r.quotation_no,
  revision: r.revision || '',
  quotationType: r.quotation_type?.name || 'Training',
  trainingType: r.training_type?.name || '',
  client: r.client_id,
  clientName: relationName(r, 'client', '—'),
  programme: r.programme?.title || '',
  programmeTitle: r.project_title || r.programme?.title || '',
  programmeCode: r.programme?.programme_code || '',
  programmeId: r.programme_id,
  opportunityId: null,

  amount: moneyDecimal(r.final_price ?? r.total_price_incl_tax),
  unitPriceExclSST: moneyDecimal(r.unit_price_excl_tax),
  unitPriceInclSST: moneyDecimal(r.unit_price_incl_tax),
  totalPriceExclSST: moneyDecimal(r.total_price_excl_tax),
  totalPriceInclSST: moneyDecimal(r.total_price_incl_tax),
  sstAmount: moneyDecimal(r.sst_amount),
  discountPercentage: moneyDecimal(r.discount_percentage),
  finalPrice: moneyDecimal(r.final_price),

  accountManager: r.account_manager?.full_name || '',
  pic: r.pic?.full_name || '',
  status: r.quotation_status?.name || 'Draft',
  issueDate: r.quotation_date || '',
  validUntil: r.valid_until || '',
  preparedBy: r.pic_full_name || '',
});

const mapPO = (r) => ({
  id: r.id,
  poNo: r.po_no,
  client: r.client_id,
  clientName: relationName(r, 'client', '—'),
  programmeId: r.programme_id,
  programmeCode: r.programme?.programme_code || '',
  programmeTitle: r.programme?.title || '',
  quotationId: r.quotation_id,
  amount: moneyDecimal(r.po_value_incl_tax),
  status: r.po_status || 'Pending',
  issueDate: r.po_date || '',
  receivedDate: '',
});

const mapInvoice = (r) => ({
  id: r.id,
  invoiceNo: r.invoice_no,
  invoiceDate: r.invoice_date || '',
  issueDate: r.invoice_date || '',
  dueDate: r.due_date || '',
  client: r.client_id,
  clientName: relationName(r, 'client', '—'),
  programmeId: r.programme_id,
  programmeCode: r.programme?.programme_code || '',
  programme: r.programme?.title || '',
  quotationReference: r.quotation_no_ref || '',
  poReference: r.po_no_ref || '',
  description: '',

  amountExcludingSST: moneyDecimal(r.amount_excl_tax),
  amount: moneyDecimal(r.amount_excl_tax),
  sstAmount: moneyDecimal(r.sst_amount),
  totalAmount: moneyDecimal(r.total_incl_tax),
  collectionAmount: moneyDecimal(r.amount_collected),
  paidAmount: moneyDecimal(r.amount_collected),
  outstandingAmount: moneyDecimal(r.amount_outstanding),

  status: r.payment_status?.name || 'Unpaid',
  paymentStatus: r.payment_status?.name || '',
  paymentMethod: r.payment_method?.name || '',
  paymentDate: r.payment_date || '',
  daysOutstanding: r.days_outstanding ?? 0,
  accountManager: '',
  pic: '',
});

const mapPayment = (r) => ({
  id: r.id,
  paymentNo: r.payment_reference,
  invoice: r.invoice_id,
  invoiceNo: r.invoice?.invoice_no || '',
  client: r.client_id,
  clientName: relationName(r, 'client', '—'),
  programmeId: r.programme_id,
  programmeCode: r.programme?.programme_code || '',
  amount: moneyDecimal(r.amount),
  method: r.payment_method?.name || '',
  date: r.payment_date || '',
  reference: r.bank_reference || r.transaction_id || '',
  status: r.payment_status?.name || 'Pending',
});

const mapAction = (r) => ({
  id: r.id,
  client: r.client_id || '',
  service: r.service || '',
  title: r.action_description,
  relatedTo: '',
  programmeId: r.programme_id,
  programmeCode: r.programme?.programme_code || '',
  owner:
    r.assigned_to?.full_name ||
    r.person_in_charge ||
    '',
  personInCharge: r.person_in_charge || '',
  personEmail: r.person_email || '',
  dueDate: r.due_date || '',
  status: r.action_item_status?.name || 'Open',
  potentialRevenue: moneyDecimal(r.potential_revenue),
  agingDays: r.aging_days ?? 0,
  notes: r.notes || '',
  priority: r.priority || 'Medium',
});

const mapTrainingStat = (r) => ({
  id: r.id,
  programmeId: r.programme_id,
  trainingDate: r.training_date || '',
  trainingName:
    r.training_name ||
    r.programme?.title ||
    '',
  trainingCategory: r.training_category || '',
  domain: r.domain_name || r.domain_code || '',
  workshopCount: r.workshop_count ?? 0,
  trainingCount: r.training_count ?? 0,
  totalCount: r.total_count ?? 0,
  bumiputeraCount: r.bumiputera_count ?? 0,
  nonBumiputeraCount: r.non_bumiputera_count ?? 0,

  totalCharges: moneyDecimal(r.total_charges_excl_tax),
  sstAmount: moneyDecimal(r.sst_amount),
  finalCharges: moneyDecimal(r.final_charges_incl_tax),

  sessionsPlanned: 0,
  sessionsDelivered: 0,
  attendanceRate: 0,
  completionRate: 0,
  avgScore: 0,
  npsScore: 0,
  lastSession: r.training_date || '',
});

const mapTraining = (r) => ({
  id: r.id,
  title: r.title,
  programme: r.programme?.title || '',
  programmeCode: r.programme?.programme_code || '',
  programmeId: r.programme_id,
  date: r.delivery_date || '',
  time: r.delivery_time || '',
  trainer: r.trainer || '',
  venue: r.venue || '',
  mode: r.mode || 'In-Person',
  status: r.status || 'Scheduled',
});

const mapParticipant = (r) => ({
  id: r.id,
  programmeId: r.programme_id,
  client: r.client_id || null,
  programmeCode: r.programme?.programme_code || '',
  programmeTitle: r.programme?.title || '',
  name: r.full_name,
  email: r.email || '',
  company: r.organization || '',
  phone: r.phone || '',
  status: r.attendance_status || 'Confirmed',
});

const mapDocument = (r) => ({
  id: r.id,
  programmeId: r.programme_id,
  name: r.name,
  type: r.document_type || '',
  uploadedBy: r.uploaded_by_name || '',
  date: r.document_date || '',
  size: r.file_size_text || '',
  storagePath: r.storage_path || '',
});

const mapAudit = (r) => ({
  id: r.id,
  programmeId: r.programme_id || null,
  action: r.action,
  entity: r.entity || '',
  description: r.description || '',
  user: r.actor_name || '',
  timestamp: r.event_at || r.created_at || '',
});

const MAPPERS = {
  client: mapClient,
  client_contact: mapClientContact,
  programme: mapProgramme,
  opportunity: mapOpportunity,
  quotation: mapQuotation,
  purchase_order: mapPO,
  invoice: mapInvoice,
  payment: mapPayment,
  training_delivery: mapTraining,
  training_stat: mapTrainingStat,
  participant: mapParticipant,
  action_item: mapAction,
  document: mapDocument,
  audit_history: mapAudit,
};

/**
 * ---------------------------------------------------------------------------
 * ERROR HANDLING
 * ---------------------------------------------------------------------------
 */

const classifySupabaseError = (error, operation = 'database operation') => {
  if (!error) {
    return null;
  }

  const code = error.code || '';
  const message = error.message || '';
  const details = error.details || '';
  const hint = error.hint || '';

  if (
    code === '23503' ||
    /foreign key/i.test(message)
  ) {
    return new Error(
      `Relationship validation failed during ${operation}. ` +
      `${details || message}`,
    );
  }

  if (
    code === '23505' ||
    /duplicate key/i.test(message)
  ) {
    return new Error(
      `Duplicate record detected during ${operation}. ` +
      `${details || message}`,
    );
  }

  if (
    code === '42501' ||
    /permission denied/i.test(message) ||
    /row-level security/i.test(message)
  ) {
    return new Error(
      `Permission denied by Supabase RLS during ${operation}. ` +
      `Please verify the authenticated user's role and RLS policy.`,
    );
  }

  if (
    /network/i.test(message) ||
    /fetch/i.test(message) ||
    /timeout/i.test(message) ||
    /failed to fetch/i.test(message)
  ) {
    return new Error(
      `Network error during ${operation}. ` +
      `Please check the Supabase connection and try again.`,
    );
  }

  return new Error(
    `${operation} failed${code ? ` [${code}]` : ''}: ${message}` +
    `${hint ? ` Hint: ${hint}` : ''}`,
  );
};

const throwSupabaseError = (error, operation) => {
  if (error) {
    throw classifySupabaseError(error, operation);
  }
};

/**
 * ---------------------------------------------------------------------------
 * PAGINATION
 * ---------------------------------------------------------------------------
 *
 * Supabase/PostgREST has practical response limits. Do not use range(0,9999)
 * as a single request.
 */

const PAGE_SIZE = 500;

async function fetchAllRows(table) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;

    const {
      data,
      error,
    } = await supabase
      .from(table)
      .select(selectMap[table] || '*')
      .order('created_at', {
        ascending: false,
      })
      .range(from, to);

    throwSupabaseError(
      error,
      `loading ${table} records`,
    );

    const page = data || [];

    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fullList(table) {
  return fetchAllRows(table);
}

/**
 * ---------------------------------------------------------------------------
 * SAFE FK VALIDATION
 * ---------------------------------------------------------------------------
 *
 * Do not construct PostgREST `.or()` expressions from arbitrary user input.
 * Validate IDs directly using `.eq()`.
 */

const FK_TABLES = {
  client: 'client',
  programme: 'programme',
  quotation: 'quotation',
  invoice: 'invoice',
  payment: 'payment',
  account: 'account',
  staff: 'staff',
  programme_status: 'programme_status',
  training_type: 'training_type',
  training_category: 'programme_category',
  programme_category: 'programme_category',
  quotation_status: 'quotation_status',
  quotation_type: 'quotation_type',
  payment_status: 'payment_status',
  payment_method: 'payment_method',
  opportunity_status: 'opportunity_status',
  speed_to_market: 'speed_to_market',
  sector: 'sector',
  action_item_status: 'action_item_status',
};

const validateForeignKey = async (
  table,
  id,
  fieldName,
  options = {},
) => {
  if (
    id === null ||
    id === undefined ||
    id === ''
  ) {
    if (options.required) {
      throw new Error(
        `${fieldName} is required.`,
      );
    }

    return null;
  }

  const targetTable = FK_TABLES[table] || table;

  if (!/^[a-zA-Z0-9_]+$/.test(targetTable)) {
    throw new Error(
      `Invalid relationship table for ${fieldName}.`,
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from(targetTable)
    .select('id')
    .eq('id', id)
    .maybeSingle();

  throwSupabaseError(
    error,
    `validating ${fieldName}`,
  );

  if (!data) {
    throw new Error(
      `Invalid relationship: ${fieldName} references a record that does not exist.`,
    );
  }

  return data.id;
};

/**
 * Safe lookup by exact value.
 *
 * Previous implementation constructed:
 *   .or(`${column}.ilike.${value},code.ilike.${value}`)
 *
 * That is unnecessary and can create malformed PostgREST expressions when
 * input contains commas, dots, parentheses or other reserved characters.
 *
 * This version performs separate exact lookups with parameterized filters.
 */

async function lookupId(table, value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const normalized = String(value).trim();

  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    throw new Error(
      'Invalid lookup table.',
    );
  }

  const column =
    table === 'staff'
      ? 'full_name'
      : 'name';

  const first = await supabase
    .from(table)
    .select('id')
    .eq(column, normalized)
    .limit(1);

  throwSupabaseError(
    first.error,
    `looking up ${table}.${column}`,
  );

  if (first.data?.[0]?.id) {
    return first.data[0].id;
  }

  /**
   * Only attempt code lookup if the table supports the conventional code
   * column. PostgREST will return an error for tables without it, so we
   * deliberately restrict this fallback to known lookup tables.
   */
  const tablesWithCode = new Set([
    'account',
    'account_type',
    'staff_role',
    'sector',
    'training_type',
    'payment_method',
    'payment_status',
    'quotation_type',
    'quotation_status',
    'programme_status',
    'project_status',
    'opportunity_status',
    'action_item_status',
    'programme_category',
    'service_type',
    'revenue_type',
  ]);

  if (!tablesWithCode.has(table)) {
    return null;
  }

  const second = await supabase
    .from(table)
    .select('id')
    .eq('code', normalized)
    .limit(1);

  throwSupabaseError(
    second.error,
    `looking up ${table}.code`,
  );

  return second.data?.[0]?.id ?? null;
}

/**
 * ---------------------------------------------------------------------------
 * DATA LINEAGE
 * ---------------------------------------------------------------------------
 */

const getCurrentUserId = async () => {
  const {
    data,
    error,
  } = await supabase.auth.getUser();

  throwSupabaseError(
    error,
    'reading authenticated user',
  );

  return data?.user?.id || null;
};

const applyLineage = (payload, userId) => ({
  ...payload,

  /**
   * Existing schema uses source_file. Keep it stable for web-originated
   * records and do not silently overwrite imported lineage identifiers.
   */
  source_file:
    payload.source_file ||
    'pms-web',

  /**
   * These metadata properties are only added if the database schema supports
   * them elsewhere. The current payload deliberately does not invent unknown
   * columns that could break an INSERT.
   */
  ...(userId && !payload.created_by
    ? { created_by: userId }
    : {}),
});

/**
 * ---------------------------------------------------------------------------
 * DATABASE PAYLOAD MAPPING
 * ---------------------------------------------------------------------------
 */

async function toDbPayload(collection, input) {
  const p = {
    ...(input || {}),
  };

  if (collection === 'clients') {
    return {
      company_name:
        p.name ??
        p.company_name,
      address:
        p.location ??
        p.address,
      is_active:
        p.status !== 'Inactive',
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'programmes') {
    return {
      client_id:
        p.client_id ??
        p.client ??
        null,
      programme_code:
        p.code ??
        p.programme_code,
      title:
        p.title,
      start_date:
        p.startDate,
      end_date:
        p.endDate,
      duration_days:
        p.durationDays,
      no_of_pax:
        p.participants,
      total_revenue_excl_tax:
        p.contractValue,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'opportunities') {
    return {
      client_id:
        p.client_id ??
        p.client ??
        null,
      programme_id:
        p.programme_id ??
        p.linkedProgramme ??
        null,
      project_title:
        p.title ??
        p.projectTitle,
      forecast_value:
        p.forecastValue ??
        p.value,
      probability_percentage:
        p.probability,
      expected_close_date:
        p.expectedClose,
      remarks:
        p.remarks,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'quotations') {
    return {
      client_id:
        p.client_id ??
        p.client ??
        null,
      programme_id:
        p.programme_id ??
        p.programme ??
        null,
      quotation_no:
        p.quoteNo ??
        p.quotation_no,
      project_title:
        p.programmeTitle,
      final_price:
        p.finalPrice ??
        p.amount,
      quotation_date:
        p.issueDate,
      valid_until:
        p.validUntil,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'purchase_orders') {
    return {
      client_id:
        p.client_id ??
        p.client ??
        null,
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      quotation_id:
        p.quotationId ??
        p.quotation ??
        null,
      po_no:
        p.poNo,
      po_value_incl_tax:
        p.amount,
      po_date:
        p.issueDate,
      po_status:
        p.status,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'invoices') {
    return {
      client_id:
        p.client_id ??
        p.client ??
        null,
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      invoice_no:
        p.invoiceNo,
      invoice_date:
        p.invoiceDate ??
        p.issueDate,
      due_date:
        p.dueDate,
      amount_excl_tax:
        p.amountExcludingSST ??
        p.amount,
      sst_amount:
        p.sstAmount,
      total_incl_tax:
        p.totalAmount ??
        p.amount,
      amount_collected:
        p.collectionAmount ??
        p.paidAmount ??
        0,
      amount_outstanding:
        p.outstandingAmount,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'payments') {
    return {
      invoice_id:
        p.invoice ??
        null,
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      client_id:
        p.client_id ??
        p.client ??
        null,
      payment_reference:
        p.paymentNo,
      amount:
        p.amount,
      payment_date:
        p.date,
      bank_reference:
        p.reference,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'action_items') {
    return {
      client_id:
        p.client ||
        null,
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      action_description:
        p.title ??
        p.action_description,
      person_in_charge:
        p.owner ??
        p.personInCharge,
      person_email:
        p.personEmail,
      due_date:
        p.dueDate,
      potential_revenue:
        p.potentialRevenue,
      aging_days:
        p.agingDays,
      priority:
        String(
          p.priority ||
          'MEDIUM',
        ).toUpperCase(),
      notes:
        p.notes,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'training_delivery') {
    return {
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      title:
        p.title,
      delivery_date:
        p.date,
      delivery_time:
        p.time,
      trainer:
        p.trainer,
      venue:
        p.venue,
      mode:
        p.mode,
      status:
        p.status,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'training_statistics') {
    return {
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      training_date:
        p.trainingDate,
      training_name:
        p.trainingName,
      training_category:
        p.trainingCategory,
      domain_name:
        p.domain,
      workshop_count:
        p.workshopCount,
      training_count:
        p.trainingCount,
      total_count:
        p.totalCount,
      bumiputera_count:
        p.bumiputeraCount,
      non_bumiputera_count:
        p.nonBumiputeraCount,
      total_charges_excl_tax:
        p.totalCharges,
      sst_amount:
        p.sstAmount,
      final_charges_incl_tax:
        p.finalCharges,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'participants') {
    return {
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      client_id:
        p.client ??
        null,
      full_name:
        p.name,
      email:
        p.email,
      organization:
        p.company,
      phone:
        p.phone,
      attendance_status:
        p.status,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'documents') {
    return {
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      name:
        p.name,
      document_type:
        p.type,
      storage_path:
        p.storagePath,
      uploaded_by_name:
        p.uploadedBy,
      document_date:
        p.date,
      file_size_text:
        p.size,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  if (collection === 'audit_history') {
    return {
      programme_id:
        p.programmeId ??
        p.programme ??
        null,
      action:
        p.action,
      entity:
        p.entity,
      description:
        p.description,
      actor_name:
        p.user,
      event_at:
        p.timestamp,
      source_file:
        p.source_file ||
        'pms-web',
    };
  }

  throw new Error(
    `Unsupported PMS collection: ${collection}`,
  );
}

/**
 * ---------------------------------------------------------------------------
 * FK RULES
 * ---------------------------------------------------------------------------
 */

const FK_RULES = {
  programmes: [
    ['client', 'client_id', false],
  ],

  opportunities: [
    ['client', 'client_id', false],
    ['programme', 'programme_id', false],
  ],

  quotations: [
    ['client', 'client_id', false],
    ['programme', 'programme_id', false],
  ],

  purchase_orders: [
    ['client', 'client_id', false],
    ['programme', 'programme_id', false],
    ['quotation', 'quotation_id', false],
  ],

  invoices: [
    ['client', 'client_id', false],
    ['programme', 'programme_id', false],
  ],

  payments: [
    ['invoice', 'invoice_id', false],
    ['programme', 'programme_id', false],
    ['client', 'client_id', false],
  ],

  action_items: [
    ['client', 'client_id', false],
    ['programme', 'programme_id', false],
  ],

  training_delivery: [
    ['programme', 'programme_id', false],
  ],

  training_statistics: [
    ['programme', 'programme_id', false],
  ],

  participants: [
    ['programme', 'programme_id', false],
    ['client', 'client_id', false],
  ],

  documents: [
    ['programme', 'programme_id', false],
  ],

  audit_history: [
    ['programme', 'programme_id', false],
  ],
};

const validatePayloadRelationships = async (
  collection,
  row,
) => {
  const rules =
    FK_RULES[collection] || [];

  for (const [
    targetTable,
    field,
    required,
  ] of rules) {
    await validateForeignKey(
      targetTable,
      row[field],
      field,
      { required },
    );
  }
};

/**
 * ---------------------------------------------------------------------------
 * AUDIT
 * ---------------------------------------------------------------------------
 */

const createAuditEntry = async ({
  programmeId = null,
  action,
  entity,
  description,
  userId = null,
}) => {
  if (!action || !entity) {
    return;
  }

  const actorName =
    userId || '';

  const payload = {
    programme_id:
      programmeId,
    action,
    entity,
    description:
      description || '',
    actor_name:
      actorName,
    event_at:
      new Date().toISOString(),
    source_file:
      'pms-web',
  };

  const {
    error,
  } = await supabase
    .from('audit_history')
    .insert(payload);

  /**
   * Audit failure must not silently break the business transaction, but it
   * must be visible in console diagnostics.
   */
  if (error) {
    console.error(
      'PMS audit_history insert failed:',
      error,
    );
  }
};

/**
 * ---------------------------------------------------------------------------
 * FINANCIAL DERIVED DATA
 * ---------------------------------------------------------------------------
 */

const makeTotals = (invoices) => ({
  revenue: decimalAdd(
    invoices.map(
      (invoice) =>
        invoice.totalAmount ||
        invoice.amount,
    ),
  ),

  collected: decimalAdd(
    invoices.map(
      (invoice) =>
        invoice.collectionAmount ||
        invoice.paidAmount,
    ),
  ),

  outstanding: decimalAdd(
    invoices.map(
      (invoice) =>
        invoice.outstandingAmount,
    ),
  ),

  overdue: decimalAdd(
    invoices
      .filter(
        (invoice) =>
          invoice.status === 'Overdue',
      )
      .map(
        (invoice) =>
          invoice.outstandingAmount,
      ),
  ),
});

const makeMonthlyFinancials = (
  invoices,
) => {
  const months = new Map();

  invoices.forEach((invoice) => {
    const key =
      (
        invoice.invoiceDate ||
        ''
      ).slice(0, 7);

    if (!key) {
      return;
    }

    if (!months.has(key)) {
      months.set(key, {
        month: key,
        revenue: '0.00',
        collection: '0.00',
      });
    }

    const current =
      months.get(key);

    current.revenue =
      decimalAdd([
        current.revenue,
        invoice.totalAmount,
      ]);

    current.collection =
      decimalAdd([
        current.collection,
        invoice.collectionAmount,
      ]);
  });

  return [...months.values()].sort(
    (a, b) =>
      a.month.localeCompare(
        b.month,
      ),
  );
};

/**
 * ---------------------------------------------------------------------------
 * DATA PROVIDER
 * ---------------------------------------------------------------------------
 */

export function PmsDataProvider({
  children,
}) {
  const {
    isAuthed,
  } = useAuth();

  const [
    state,
    setState,
  ] = useState(DEFAULT_STATE);

  const mountedRef =
    useRef(true);

  const refreshInFlightRef =
    useRef(false);

  const realtimeTimersRef =
    useRef(new Map());

  const realtimeChannelRef =
    useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * -------------------------------------------------------------------------
   * LOAD SINGLE TABLE
   * -------------------------------------------------------------------------
   */

  const loadTable = useCallback(
    async (
      table,
      {
        silent = true,
      } = {},
    ) => {
      const collection =
        TABLE_COLLECTIONS[table];

      if (!collection) {
        throw new Error(
          `Unknown PMS table: ${table}`,
        );
      }

      if (!silent && mountedRef.current) {
        setState((current) => ({
          ...current,
          loading: true,
          error: '',
        }));
      }

      try {
        const rows =
          await fullList(table);

        const mapper =
          MAPPERS[table];

        const mapped =
          mapper
            ? rows.map(mapper)
            : rows;

        const stateKey =
          COLLECTION_STATE_KEYS[
            collection
          ];

        if (
          mountedRef.current &&
          stateKey
        ) {
          setState((current) => ({
            ...current,
            [stateKey]: mapped,
            loading: false,
            error: '',
          }));
        }

        return mapped;
      } catch (error) {
        console.error(
          `PMS loadTable(${table}) failed:`,
          error,
        );

        const friendly =
          error instanceof Error
            ? error
            : new Error(
                String(error),
              );

        if (mountedRef.current) {
          setState((current) => ({
            ...current,
            loading: false,
            error:
              friendly.message ||
              `Unable to load ${table}.`,
          }));
        }

        throw friendly;
      }
    },
    [],
  );

  /**
   * -------------------------------------------------------------------------
   * FULL REFRESH
   * -------------------------------------------------------------------------
   */

  const refresh = useCallback(
    async ({
      silent = false,
    } = {}) => {
      if (!isAuthed) {
        if (mountedRef.current) {
          setState(DEFAULT_STATE);
        }

        return;
      }

      /**
       * Prevent overlapping full refresh operations.
       */
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      if (
        !silent &&
        mountedRef.current
      ) {
        setState((current) => ({
          ...current,
          loading: true,
          error: '',
        }));
      }

      try {
        const tableNames =
          Object.values(TABLES);

        const results =
          await Promise.all(
            tableNames.map(
              async (table) => ({
                table,
                rows:
                  await fullList(
                    table,
                  ),
              }),
            ),
          );

        if (!mountedRef.current) {
          return;
        }

        const nextState = {
          ...DEFAULT_STATE,
          loading: false,
          error: '',
        };

        for (const {
          table,
          rows,
        } of results) {
          const collection =
            TABLE_COLLECTIONS[
              table
            ];

          const stateKey =
            COLLECTION_STATE_KEYS[
              collection
            ];

          const mapper =
            MAPPERS[table];

          nextState[stateKey] =
            mapper
              ? rows.map(mapper)
              : rows;
        }

        setState(nextState);
      } catch (error) {
        console.error(
          'PMS full refresh failed:',
          error,
        );

        const friendly =
          error instanceof Error
            ? error
            : new Error(
                String(error),
              );

        if (mountedRef.current) {
          setState((current) => ({
            ...current,
            loading: false,
            error:
              friendly.message ||
              'Unable to load PMS data.',
          }));
        }
      } finally {
        refreshInFlightRef.current =
          false;
      }
    },
    [isAuthed],
  );

  /**
   * Initial data load.
   */
  useEffect(() => {
    if (!isAuthed) {
      setState(DEFAULT_STATE);
      return;
    }

    refresh({
      silent: false,
    });
  }, [
    isAuthed,
    refresh,
  ]);

  /**
   * -------------------------------------------------------------------------
   * REALTIME
   * -------------------------------------------------------------------------
   *
   * Important optimisation:
   *
   * PB-style:
   *   every event -> reload everything
   *
   * New behaviour:
   *   programme event -> reload programme only
   *   invoice event   -> reload invoice only
   *
   * Events are debounced per table to avoid repeated reloads when a transaction
   * produces several changes within a short interval.
   */

  useEffect(() => {
    if (!isAuthed) {
      if (
        realtimeChannelRef.current
      ) {
        supabase.removeChannel(
          realtimeChannelRef.current,
        );

        realtimeChannelRef.current =
          null;
      }

      return undefined;
    }

    const realtimeTables = [
      'client',
      'programme',
      'opportunity',
      'quotation',
      'purchase_order',
      'invoice',
      'payment',
      'action_item',
      'training_stat',
      'participant',
      'training_delivery',
      'document',
    ];

    const scheduleTableRefresh =
      (table) => {
        const existing =
          realtimeTimersRef.current.get(
            table,
          );

        if (existing) {
          clearTimeout(existing);
        }

        const timer =
          setTimeout(
            async () => {
              realtimeTimersRef.current.delete(
                table,
              );

              try {
                await loadTable(
                  table,
                  {
                    silent: true,
                  },
                );
              } catch (error) {
                console.error(
                  `Realtime refresh failed for ${table}:`,
                  error,
                );
              }
            },
            300,
          );

        realtimeTimersRef.current.set(
          table,
          timer,
        );
      };

    const channel =
      supabase
        .channel('pms-live')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'client',
          },
          () =>
            scheduleTableRefresh(
              'client',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'programme',
          },
          () =>
            scheduleTableRefresh(
              'programme',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'opportunity',
          },
          () =>
            scheduleTableRefresh(
              'opportunity',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quotation',
          },
          () =>
            scheduleTableRefresh(
              'quotation',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'purchase_order',
          },
          () =>
            scheduleTableRefresh(
              'purchase_order',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'invoice',
          },
          () =>
            scheduleTableRefresh(
              'invoice',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment',
          },
          () =>
            scheduleTableRefresh(
              'payment',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'action_item',
          },
          () =>
            scheduleTableRefresh(
              'action_item',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'training_stat',
          },
          () =>
            scheduleTableRefresh(
              'training_stat',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'participant',
          },
          () =>
            scheduleTableRefresh(
              'participant',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'training_delivery',
          },
          () =>
            scheduleTableRefresh(
              'training_delivery',
            ),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'document',
          },
          () =>
            scheduleTableRefresh(
              'document',
            ),
        )
        .subscribe(
          (status) => {
            if (
              status ===
                'CHANNEL_ERROR' &&
              mountedRef.current
            ) {
              setState(
                (current) => ({
                  ...current,
                  error:
                    'Supabase Realtime connection failed. Live updates may be temporarily unavailable.',
                }),
              );
            }
          },
        );

    realtimeChannelRef.current =
      channel;

    return () => {
      realtimeTimersRef.current.forEach(
        (timer) =>
          clearTimeout(timer),
      );

      realtimeTimersRef.current.clear();

      if (
        realtimeChannelRef.current
      ) {
        supabase.removeChannel(
          realtimeChannelRef.current,
        );

        realtimeChannelRef.current =
          null;
      }
    };
  }, [
    isAuthed,
    loadTable,
  ]);

  /**
   * -------------------------------------------------------------------------
   * CREATE
   * -------------------------------------------------------------------------
   */

  const createRecord = useCallback(
    async (
      collection,
      payload,
    ) => {
      const table =
        TABLES[collection];

      if (!table) {
        throw new Error(
          `Unknown collection: ${collection}`,
        );
      }

      const row =
        await toDbPayload(
          collection,
          payload,
        );

      const userId =
        await getCurrentUserId();

      const finalRow =
        applyLineage(
          row,
          userId,
        );

      await validatePayloadRelationships(
        collection,
        finalRow,
      );

      const {
        data,
        error,
      } = await supabase
        .from(table)
        .insert(finalRow)
        .select('*')
        .single();

      throwSupabaseError(
        error,
        `creating ${collection}`,
      );

      await createAuditEntry({
        programmeId:
          finalRow.programme_id ||
          null,
        action: 'CREATE',
        entity: collection,
        description:
          `Created ${collection} record ${data?.id || ''}`.trim(),
        userId,
      });

      /**
       * Refresh only the affected table.
       */
      try {
        await loadTable(
          table,
          {
            silent: true,
          },
        );
      } catch (refreshError) {
        console.error(
          'Post-create refresh failed:',
          refreshError,
        );
      }

      return data;
    },
    [loadTable],
  );

  /**
   * -------------------------------------------------------------------------
   * UPDATE
   * -------------------------------------------------------------------------
   */

  const updateRecord =
    useCallback(
      async (
        collection,
        id,
        payload,
      ) => {
        const table =
          TABLES[collection];

        if (!table) {
          throw new Error(
            `Unknown collection: ${collection}`,
          );
        }

        if (
          id === null ||
          id === undefined ||
          id === ''
        ) {
          throw new Error(
            `Cannot update ${collection}: record ID is required.`,
          );
        }

        const row =
          await toDbPayload(
            collection,
            payload,
          );

        const userId =
          await getCurrentUserId();

        const finalRow =
          applyLineage(
            row,
            userId,
          );

        await validatePayloadRelationships(
          collection,
          finalRow,
        );

        const {
          data,
          error,
        } = await supabase
          .from(table)
          .update(finalRow)
          .eq('id', id)
          .select('*')
          .single();

        throwSupabaseError(
          error,
          `updating ${collection}`,
        );

        await createAuditEntry({
          programmeId:
            finalRow.programme_id ||
            null,
          action: 'UPDATE',
          entity: collection,
          description:
            `Updated ${collection} record ${id}`,
          userId,
        });

        try {
          await loadTable(
            table,
            {
              silent: true,
            },
          );
        } catch (refreshError) {
          console.error(
            'Post-update refresh failed:',
            refreshError,
          );
        }

        return data;
      },
      [loadTable],
    );

  /**
   * -------------------------------------------------------------------------
   * DELETE
   * -------------------------------------------------------------------------
   */

  const deleteRecord =
    useCallback(
      async (
        collection,
        id,
      ) => {
        const table =
          TABLES[collection];

        if (!table) {
          throw new Error(
            `Unknown collection: ${collection}`,
          );
        }

        if (
          id === null ||
          id === undefined ||
          id === ''
        ) {
          throw new Error(
            `Cannot delete ${collection}: record ID is required.`,
          );
        }

        const userId =
          await getCurrentUserId();

        const {
          error,
        } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        throwSupabaseError(
          error,
          `deleting ${collection}`,
        );

        await createAuditEntry({
          action: 'DELETE',
          entity: collection,
          description:
            `Deleted ${collection} record ${id}`,
          userId,
        });

        try {
          await loadTable(
            table,
            {
              silent: true,
            },
          );
        } catch (refreshError) {
          console.error(
            'Post-delete refresh failed:',
            refreshError,
          );
        }
      },
      [loadTable],
    );

  /**
   * -------------------------------------------------------------------------
   * DOCUMENT UPLOAD
   * -------------------------------------------------------------------------
   *
   * Transaction pattern:
   *
   * 1. Upload Storage object.
   * 2. Insert database metadata.
   * 3. If DB insert fails -> delete Storage object.
   *
   * This prevents orphaned files.
   */

  const uploadDocument =
    useCallback(
      async (
        programmeId,
        file,
        metadata = {},
      ) => {
        if (
          !programmeId
        ) {
          throw new Error(
            'Cannot upload document: programme ID is required.',
          );
        }

        if (!file) {
          throw new Error(
            'Cannot upload document: file is required.',
          );
        }

        await validateForeignKey(
          'programme',
          programmeId,
          'programme_id',
          {
            required: true,
          },
        );

        const safeFileName =
          String(
            file.name ||
              'document',
          )
            .trim()
            .replace(
              /[^a-zA-Z0-9._-]/g,
              '_',
            );

        const uniqueId =
          typeof crypto !==
            'undefined' &&
          typeof crypto.randomUUID ===
            'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;

        const path =
          `programmes/${programmeId}/supporting-documents/${uniqueId}-${safeFileName}`;

        let uploaded =
          false;

        try {
          const {
            error:
              uploadError,
          } =
            await supabase.storage
              .from(
                'pms-documents',
              )
              .upload(
                path,
                file,
                {
                  upsert: false,
                  contentType:
                    file.type ||
                    'application/octet-stream',
                  cacheControl:
                    '3600',
                },
              );

          throwSupabaseError(
            uploadError,
            'uploading document to Supabase Storage',
          );

          uploaded = true;

          const userId =
            await getCurrentUserId();

          const documentPayload = {
            programmeId,
            name:
              metadata.name ||
              file.name,
            type:
              metadata.type ||
              file.type ||
              '',
            storagePath:
              path,
            uploadedBy:
              metadata.uploadedBy ||
              userId ||
              '',
            date:
              metadata.date ||
              new Date()
                .toISOString()
                .slice(0, 10),
            size:
              metadata.size ||
              String(
                file.size ||
                  0,
              ),
            source_file:
              'pms-web',
          };

          const row =
            await toDbPayload(
              'documents',
              documentPayload,
            );

          const finalRow =
            applyLineage(
              row,
              userId,
            );

          await validatePayloadRelationships(
            'documents',
            finalRow,
          );

          const {
            data,
            error,
          } = await supabase
            .from('document')
            .insert(finalRow)
            .select('*')
            .single();

          if (error) {
            throw classifySupabaseError(
              error,
              'creating document metadata',
            );
          }

          await createAuditEntry({
            programmeId,
            action: 'UPLOAD',
            entity:
              'document',
            description:
              `Uploaded document ${file.name}`,
            userId,
          });

          try {
            await loadTable(
              'document',
              {
                silent: true,
              },
            );
          } catch (refreshError) {
            console.error(
              'Post-upload document refresh failed:',
              refreshError,
            );
          }

          return data;
        } catch (error) {
          /**
           * Compensating transaction:
           * if Storage upload succeeded but DB metadata failed,
           * delete the uploaded object.
           */
          if (uploaded) {
            const {
              error:
                cleanupError,
            } =
              await supabase.storage
                .from(
                  'pms-documents',
                )
                .remove([path]);

            if (cleanupError) {
              console.error(
                'CRITICAL: document cleanup failed; orphaned Storage object may remain:',
                {
                  path,
                  cleanupError,
                },
              );
            }
          }

          throw (
            error instanceof Error
              ? error
              : new Error(
                  String(error),
                )
          );
        }
      },
      [loadTable],
    );

  /**
   * -------------------------------------------------------------------------
   * DERIVED DATA
   * -------------------------------------------------------------------------
   */

  const derived =
    useMemo(() => {
      const openOpportunities =
        state.opportunities.filter(
          (opportunity) =>
            ![
              'Lost',
              'Lost / No-go',
              'WON',
              'Won',
            ].includes(
              opportunity.stage,
            ),
        );

      const pipelineValue =
        decimalAdd(
          openOpportunities.map(
            (opportunity) =>
              opportunity.value,
          ),
        );

      const weightedPipelineValue =
        decimalAdd(
          openOpportunities.map(
            (opportunity) =>
              opportunity.weighted,
          ),
        );

      const securedOrderBook =
        decimalAdd(
          state.opportunities.map(
            (opportunity) =>
              opportunity.securedOrderBookValue,
          ),
        );

      const stages = [
        ...new Set(
          state.opportunities.map(
            (opportunity) =>
              opportunity.stage,
          ),
        ),
      ];

      const funnelByStage =
        stages.map((stage) => {
          const stageRows =
            state.opportunities.filter(
              (opportunity) =>
                opportunity.stage ===
                stage,
            );

          return {
            stage,
            count:
              stageRows.length,
            value:
              decimalAdd(
                stageRows.map(
                  (opportunity) =>
                    opportunity.value,
                ),
              ),
            weighted:
              decimalAdd(
                stageRows.map(
                  (opportunity) =>
                    opportunity.weighted,
                ),
              ),
          };
        });

      return {
        openOpportunities,

        pipelineValue,

        weightedPipelineValue,

        securedOrderBook,

        funnelByStage,

        totals:
          makeTotals(
            state.invoices,
          ),

        monthlyFinancials:
          makeMonthlyFinancials(
            state.invoices,
          ),

        programmeCompletenessAvg:
          state.programmes.length
            ? Math.round(
                state.programmes.reduce(
                  (
                    sum,
                    programme,
                  ) =>
                    sum +
                    (
                      programme.progress ||
                      0
                    ),
                  0,
                ) /
                  state.programmes
                    .length,
              )
            : 0,

        BUSINESS_FLOW: [
          'Opportunity',
          'Quotation',
          'Purchase Order',
          'Programme',
          'Training Delivery',
          'Invoice',
          'Payment Collection',
        ],
      };
    }, [
      state,
    ]);

  /**
   * -------------------------------------------------------------------------
   * CONTEXT VALUE
   * -------------------------------------------------------------------------
   */

  const value =
    useMemo(
      () => ({
        ...state,
        ...derived,

        refresh,
        createRecord,
        updateRecord,
        deleteRecord,
        uploadDocument,

        /**
         * Explicit UI conversion helper.
         * Financial values stored in state remain decimal strings.
         */
        decimalNumberForUi,

        /**
         * Exact arithmetic helpers available to components when needed.
         */
        decimalAdd,
        decimalSubtract,
        decimalMultiplyInteger,
        moneyDecimal,

        /**
         * Diagnostic helper.
         */
        lookupId,
      }),
      [
        state,
        derived,
        refresh,
        createRecord,
        updateRecord,
        deleteRecord,
        uploadDocument,
      ],
    );

  return (
    <PmsDataContext.Provider
      value={value}
    >
      {children}
    </PmsDataContext.Provider>
  );
}

export const usePmsData = () => {
  const context =
    useContext(
      PmsDataContext,
    );

  if (!context) {
    throw new Error(
      'usePmsData must be used inside PmsDataProvider',
    );
  }

  return context;
};
