import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePmsData } from '@/contexts/PmsDataContext';
import { decimalToString } from '@/lib/format';

const normalizeDecimalInput = (value) => {
  if (value === '' || value === null || value === undefined) return '0';
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    throw new TypeError(`Invalid numeric value: ${value}`);
  }
  return decimalToString(text);
};

export default function EntityDialog({
  collection,
  title,
  description,
  triggerLabel,
  fields,
  initialValues = {},
  onCreated,
  mode = 'create',
  recordId = null,
}) {
  const { createRecord, updateRecord } = usePmsData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialValues || {});
  }, [open, initialValues]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        let value = form[f.name];
        if (f.type === 'number') value = normalizeDecimalInput(value);
        if (f.type === 'relation' && value === 'none') value = '';
        if (value !== undefined) payload[f.name] = value;
      });
      if (mode === 'edit') {
        if (!recordId) throw new Error('Cannot update this record because its ID is missing.');
        await updateRecord(collection, recordId, payload);
        toast.success(`${title} updated successfully.`);
      } else {
        await createRecord(collection, payload);
        toast.success(`${title} created successfully.`);
      }
      setOpen(false);
      onCreated?.();
    } catch (error) {
      console.error(`[PMS] ${mode} ${collection} failed`, error);
      toast.error(error?.message || `Unable to ${mode === 'edit' ? 'update' : 'create'} ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === 'edit' ? 'ghost' : undefined} size={mode === 'edit' ? 'icon' : undefined} className={mode === 'edit' ? 'h-8 w-8' : 'bg-violet-600 hover:bg-violet-700'} title={mode === 'edit' ? `Edit ${title}` : undefined}>
          {mode === 'edit' ? <Pencil className="h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" /> {triggerLabel || `New ${title}`}</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? `Edit ${title}` : title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const options = f.options || [];
            return (
              <div key={f.name} className={`space-y-2 ${f.full ? 'sm:col-span-2' : ''}`}>
                <Label htmlFor={`${collection}-${f.name}`}>{f.label}</Label>
                {f.type === 'select' || f.type === 'relation' ? (
                  <Select value={form[f.name] || 'none'} onValueChange={(v) => setForm((s) => ({ ...s, [f.name]: v === 'none' ? '' : v }))}>
                    <SelectTrigger id={`${collection}-${f.name}`}><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                    <SelectContent>
                      {!f.required && <SelectItem value="none">— None —</SelectItem>}
                      {options.map((o) => {
                        const value = typeof o === 'string' ? o : o.value;
                        const label = typeof o === 'string' ? o : (o.label ?? o.value);
                        return <SelectItem key={value} value={value}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`${collection}-${f.name}`}
                    type={f.type || 'text'}
                    required={!!f.required}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            );
          })}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={saving}>{saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
