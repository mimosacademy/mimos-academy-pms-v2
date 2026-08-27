import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const TABLES = new Set(['client','programme','quotation','purchase_order','invoice','payment','staff']);
const ALLOWED_OPERATIONS = new Set(['NEW','UPDATE','UNCHANGED','DUPLICATE','CONFLICT','REVIEW','REJECT']);

function norm(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase().replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ');
  return s || null;
}

function stableObjectHash(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const text = keys.map((k) => `${k}:${norm(obj[k]) ?? ''}`).join('|');
  // FNV-1a is used only as a deterministic application fingerprint; database integrity does not depend on it.
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const FIELD_ALIASES: Record<string,string> = {
  'programme id':'programme_id','program id':'programme_id','programme_id':'programme_id','programmeid':'programme_id',
  'programme name':'programme_name','program name':'programme_name','programme':'programme_name',
  'client id':'client_id','client_id':'client_id','client':'client_name','client name':'client_name',
  'quotation id':'quotation_id','quotation number':'quotation_number','quote no':'quotation_number',
  'po number':'po_number','po no':'po_number','purchase order':'po_number',
  'invoice id':'invoice_id','invoice number':'invoice_number','invoice no':'invoice_number',
  'payment id':'payment_id','payment reference':'payment_reference','payment no':'payment_reference',
  'start date':'start_date','end date':'end_date','completion date':'completion_date',
  'revenue':'revenue','amount':'amount','total':'total_incl_tax','total incl tax':'total_incl_tax',
  'email':'email','phone':'phone','status':'status','pic':'pic','person in charge':'pic'
};

function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = FIELD_ALIASES[norm(key) ?? ''] ?? norm(key)?.replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    if (canonical) out[canonical] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

function inferTable(row: Record<string, unknown>): string | null {
  if (row.invoice_id || row.invoice_number || row.invoice_no) return 'invoice';
  if (row.po_number || row.purchase_order) return 'purchase_order';
  if (row.quotation_id || row.quotation_number) return 'quotation';
  if (row.payment_id || row.payment_reference) return 'payment';
  if (row.programme_id || row.programme_name) return 'programme';
  if (row.client_id || row.client_name) return 'client';
  if (row.staff_id || row.email) return 'staff';
  return null;
}

function identity(row: Record<string, unknown>, table: string): { key: string|null; confidence: number; reason: string } {
  const idFields: Record<string,string[]> = {
    programme:['programme_id'], client:['client_id'], quotation:['quotation_id','quotation_number'],
    purchase_order:['po_number'], invoice:['invoice_id','invoice_number'], payment:['payment_id','payment_reference'], staff:['staff_id','email']
  };
  for (const f of idFields[table] ?? []) if (row[f] !== undefined && row[f] !== null && String(row[f]).trim()) return { key: `${table}:${norm(row[f])}`, confidence: 1, reason: `Exact ${f} match key` };
  const composite = [row.programme_name,row.client_name,row.email,row.start_date].map(norm).filter(Boolean).join('|');
  if (composite) return { key: `${table}:composite:${composite}`, confidence: 0.75, reason: 'Composite identity; requires verification against canonical record' };
  return { key:null, confidence:0, reason:'No reliable identity key' };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error:'Method not allowed' }), { status:405, headers:{...cors(origin),'Content-Type':'application/json'} });

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return new Response(JSON.stringify({ error:'Authentication required' }), { status:401, headers:{...cors(origin),'Content-Type':'application/json'} });
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return new Response(JSON.stringify({ error:'Service unavailable' }), { status:503, headers:{...cors(origin),'Content-Type':'application/json'} });
  const supabase = createClient(url, anon, { global:{ headers:{ Authorization:auth } } });
  const { data:{ user }, error:userError } = await supabase.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error:'Authentication required' }), { status:401, headers:{...cors(origin),'Content-Type':'application/json'} });

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || rows.length > 5000) return new Response(JSON.stringify({ error:'rows must contain 1 to 5000 records' }), { status:400, headers:{...cors(origin),'Content-Type':'application/json'} });

  const results = rows.map((raw: Record<string,unknown>, index:number) => {
    const normalized = normalizeRow(raw);
    const table = inferTable(normalized);
    if (!table || !TABLES.has(table)) return { row_number:index+1, operation:'REVIEW', target_table:null, target_id:null, confidence:0, reason:'Unable to map row to a canonical PMS table', normalized_payload:normalized, payload_hash:stableObjectHash(normalized) };
    const match = identity(normalized, table);
    const operation = match.key && match.confidence === 1 ? 'UPDATE' : (match.key ? 'REVIEW' : 'NEW');
    return { row_number:index+1, operation, target_table:table, target_id:null, confidence:match.confidence, reason:match.reason, normalized_payload:normalized, payload_hash:stableObjectHash(normalized) };
  });

  const counts = Object.fromEntries([...ALLOWED_OPERATIONS].map((x)=>[x,results.filter((r)=>r.operation===x).length]));
  return new Response(JSON.stringify({ batch:{ user_id:user.id, row_count:results.length, counts }, results }), { status:200, headers:{...cors(origin),'Content-Type':'application/json'} });
});
