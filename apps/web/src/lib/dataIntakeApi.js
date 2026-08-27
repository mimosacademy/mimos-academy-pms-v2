import supabase from './supabaseClient';

const functionsUrl = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function invoke(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Authentication required. Please sign in again.');
  const response = await fetch(`${functionsUrl()}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Data processing request failed.');
  return payload;
}

export const analyseRawRows = (rows, targetTable) => invoke('data-intake-analyze', { rows, target_table: targetTable });
export const compareRawRows = (rows, targetTable) => invoke('data-intake-compare', { rows, target_table: targetTable });
export const promoteApprovedChanges = (items, changeSetId) => invoke('data-intake-promote', { items, change_set_id: changeSetId });

export async function uploadRawDataFile(file, { programmeId, bucket = 'pms-documents' } = {}) {
  if (!(file instanceof File)) throw new TypeError('A file is required.');
  if (!programmeId || !Number.isInteger(Number(programmeId))) throw new Error('A valid programme is required.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'raw-data';
  const path = `programmes/${Number(programmeId)}/raw-data/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream', cacheControl: '3600' });
  if (error) throw new Error('Raw data upload failed.');
  return path;
}

export default { analyseRawRows, compareRawRows, promoteApprovedChanges, uploadRawDataFile };
