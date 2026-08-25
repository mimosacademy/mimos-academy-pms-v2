import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePmsData } from '@/contexts/PmsDataContext';

export default function EntityDialog({ collection, title, description, triggerLabel, fields, initialValues = {}, onCreated }) {
  const { createRecord, clients, programmes, quotations, opportunities, invoices } = usePmsData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialValues);

  useEffect(() => { if (open) setForm(initialValues); }, [open, JSON.stringify(initialValues)]);

  const relationOptions = (field) => {
    if (field.options) return field.options;
    if (field.relation === 'clients') return clients.map((x) => ({ value: x.id, label: x.name }));
    if (field.relation === 'programmes') return programmes.map((x) => ({ value: x.id, label: `${x.code} — ${x.title}` }));
    if (field.relation === 'quotations') return quotations.map((x) => ({ value: x.id, label: x.quoteNo }));
    if (field.relation === 'opportunities') return opportunities.map((x) => ({ value: x.id, label: x.title }));
    if (field.relation === 'invoices') return invoices.map((x) => ({ value: x.id, label: x.invoiceNo }));
    return [];
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {};
      fields.forEach((f) => {
        let value = form[f.name];
        if (f.type === 'number') value = value === '' || value == null ? 0 : Number(value);
        if (f.type === 'relation' && value === 'none') value = '';
        if (value !== undefined) payload[f.name] = value;
      });
      await createRecord(collection, payload);
      toast.success(`${title} created successfully.`);
      setOpen(false);
      onCreated?.();
    } catch (error) {
      toast.error(error?.message || `Unable to create ${title.toLowerCase()}.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" /> {triggerLabel || `New ${title}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const options = relationOptions(f);
            return (
              <div key={f.name} className={`space-y-2 ${f.full ? 'sm:col-span-2' : ''}`}>
                <Label>{f.label}</Label>
                {f.type === 'select' || f.type === 'relation' ? (
                  <Select value={form[f.name] || 'none'} onValueChange={(v) => setForm((s) => ({ ...s, [f.name]: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                    <SelectContent>
                      {!f.required && <SelectItem value="none">— None —</SelectItem>}
                      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label ?? o.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-violet-600 hover:bg-violet-700">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
