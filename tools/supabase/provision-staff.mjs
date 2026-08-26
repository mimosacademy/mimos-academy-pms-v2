#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redirectTo = process.env.SUPABASE_INVITE_REDIRECT_URL;

if (!url || !serviceKey) {
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: staff, error: staffError } = await supabase
  .from('staff')
  .select('id,email,full_name,role_id,is_active,staff_role:role_id(code)')
  .eq('is_active', true)
  .order('id');

if (staffError) throw staffError;

for (const person of staff ?? []) {
  const role = person.staff_role?.code ?? 'VIEWER';
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(person.email, {
    ...(redirectTo ? { redirectTo } : {}),
    data: {
      full_name: person.full_name,
      pms_staff_id: person.id,
      pms_role: role,
    },
  });

  if (error) {
    if (/already.*registered|already exists/i.test(error.message)) {
      console.log(`EXISTS  ${person.email}`);
      continue;
    }
    console.error(`FAILED  ${person.email}: ${error.message}`);
    continue;
  }

  const userId = data.user?.id;
  if (userId) {
    const { error: updateError } = await supabase
      .from('staff')
      .update({ auth_user_id: userId })
      .eq('id', person.id);
    if (updateError) throw updateError;
  }
  console.log(`INVITED ${person.email} [${role}]`);
}

console.log(`Processed ${staff?.length ?? 0} active staff profiles.`);
