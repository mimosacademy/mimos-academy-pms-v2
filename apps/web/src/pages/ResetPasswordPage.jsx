import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '@/lib/supabaseClient';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (password !== confirm) return toast.error('Passwords do not match.');
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated successfully.');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error?.message || 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-sm border">
        <div>
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="text-sm text-slate-500 mt-1">Choose a new password for your MIMOS Academy PMS account.</p>
        </div>
        <input className="w-full rounded-md border p-3" type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input className="w-full rounded-md border p-3" type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <button className="w-full rounded-md bg-slate-900 px-4 py-3 text-white disabled:opacity-50" disabled={saving} type="submit">
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </main>
  );
}
