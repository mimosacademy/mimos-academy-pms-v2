import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const relationLabel = (relation, row) => {
  if (!row) return '';
  switch (relation) {
    case 'clients': return row.name || row.company_name || `Client #${row.id}`;
    case 'programmes': return row.code ? `${row.code}${row.title ? ` — ${row.title}` : ''}` : row.title || `Programme #${row.id}`;
    case 'quotations': return row.quoteNo || row.quotation_no || `Quotation #${row.id}`;
    case 'purchase_orders': return row.poNo || row.po_no || `PO #${row.id}`;
    case 'invoices': return row.invoiceNo || row.invoice_no || `Invoice #${row.id}`;
    case 'payments': return row.paymentNo || row.payment_reference || `Payment #${row.id}`;
    case 'opportunities': return row.projectTitle || row.title || `Opportunity #${row.id}`;
    case 'participants': return row.name || `Participant #${row.id}`;
    default: return row.name || row.title || row.code || `Record #${row.id}`;
  }
};

const relationValue = (row) => String(row?.id ?? '');

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
  const {
    createRecord,
    updateRecord,
    clients,
    programmes,
    opportunities,
    quotations,
    purchaseOrders,
    invoices,
    payments,
    participants,
  } = usePmsData();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  const relationOptions = useMemo(() => ({
    clients: clients || [],
    programmes: programmes || [],
    opportunities: opportunities || [],
    quotations: quotations || [],
    purchase_orders: purchaseOrders || [],
    invoices: invoices || [],
    payments: payments || [],
    participants: participants || [],
  }), [clients, programmes, opportunities, quotations, purchaseOrders, invoices, payments, participants]);

  useEffect(() => {
    if (open) {
      const next = { ...(initialValues || {}) };
      // Generate the idempotency key once per payment form instance. If a
      // network response is lost and the user retries, the same operation_id
      // prevents a second payment row from being created.
      if (collection === 'payments' && mode === 'create' && !next.operationId) {
        next.operationId = crypto.randomUUID();
      }
      setForm(next);
    }
  }, [open, initialValues, collection, mode]);

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

      if (collection === 'payments' && mode === 'create') {
        payload.operationId = form.operationId || crypto.randomUUID();
      }

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
        <Button
          variant={mode === 'edit' ? 'ghost' : undefined}
          size={mode === 'edit' ? 'icon' : undefined}
          className={mode === 'edit' ? 'h-8 w-8' : 'bg-violet-600 hover:bg-violet-700'}
          title={mode === 'edit' ? `Edit ${title}` : undefined}
        >
          {mode === 'edit' ? <Pencil className="h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" />{triggerLabel || `New ${title}`}</>}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? `Edit ${title}` : title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const staticOptions = f.options || [];
            const rows = f.relation ? relationOptions[f.relation] || [] : [];
            const options = f.type === 'relation' ? rows.map((row) => ({ value: relationValue(row), label: relationLabel(f.relation, row) })) : staticOptions;

            return (
              <div key={f.name} className={`space-y-2 ${f.full ? 'sm:col-span-2' : ''}`}>
                <Label htmlFor={`${collection}-${f.name}`}>{f.label}</Label>
                {f.type === 'select' || f.type === 'relation' ? (
                  <Select
                    value={String(form[f.name] ?? '') || 'none'}
                    onValueChange={(value) => setForm((state) => ({ ...state, [f.name]: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger id={`${collection}-${f.name}`}><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                    <SelectContent>
                      {!f.required && <SelectItem value="none">— None —</SelectItem>}
                      {options.length === 0 && <SelectItem value="__empty" disabled>{f.type === 'relation' ? `No ${f.relation} available` : 'No options available'}</SelectItem>}
                      {options.map((option) => {
                        const value = typeof option === 'string' ? option : option.value;
                        const label = typeof option === 'string' ? option : (option.label ?? option.value);
                        return <SelectItem key={String(value)} value={String(value)}>{label}</SelectItem>;
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
                    onChange={(e) => setForm((state) => ({ ...state, [f.name]: e.target.value }))}
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
