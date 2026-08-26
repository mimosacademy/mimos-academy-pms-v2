import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Inbox } from 'lucide-react';
import EntityDialog from '@/components/EntityDialog';
import { usePmsData } from '@/contexts/PmsDataContext';

const inferCollection = (row) => {
  if ('invoiceNo' in row) return 'invoices';
  if ('quoteNo' in row) return 'quotations';
  if ('poNo' in row) return 'purchase_orders';
  if ('paymentNo' in row) return 'payments';
  if ('projectTitle' in row || 'forecastValue' in row) return 'opportunities';
  if ('trainingName' in row || 'workshopCount' in row) return 'training_statistics';
  if ('attendanceRate' in row || 'trainingDate' in row) return 'training_statistics';
  if ('attendanceStatus' in row || ('email' in row && 'company' in row && 'programmeId' in row)) return 'participants';
  if ('storagePath' in row) return 'documents';
  if ('potentialRevenue' in row || ('dueDate' in row && 'priority' in row)) return 'action_items';
  if ('deliveryDate' in row || ('trainer' in row && 'venue' in row && 'mode' in row)) return 'training_delivery';
  if ('code' in row && 'title' in row && 'startDate' in row) return 'programmes';
  if ('industry' in row && 'location' in row && 'status' in row) return 'clients';
  return null;
};

const EDIT_FIELDS = {
  clients: [
    ['name', 'Client Name', 'text', true],
    ['industry', 'Industry', 'text'],
    ['contactPerson', 'Contact Person', 'text'],
    ['email', 'Email', 'email'],
    ['phone', 'Phone', 'text'],
    ['location', 'Location', 'text'],
    ['status', 'Status', 'select', false, ['Active', 'Prospect', 'Inactive']],
    ['since', 'Since', 'text'],
  ],
  programmes: [
    ['code', 'Programme Code', 'text'],
    ['title', 'Title', 'text', true],
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['startDate', 'Start Date', 'date'],
    ['endDate', 'End Date', 'date'],
    ['durationDays', 'Duration Days', 'number'],
    ['participants', 'Participants', 'number'],
    ['contractValue', 'Contract Value', 'number'],
  ],
  opportunities: [
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['title', 'Project Title', 'text', true],
    ['forecastValue', 'Forecast Value', 'number'],
    ['probability', 'Probability %', 'number'],
    ['expectedClose', 'Expected Close', 'date'],
  ],
  quotations: [
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['quoteNo', 'Quotation No', 'text', true],
    ['programmeTitle', 'Project Title', 'text'],
    ['finalPrice', 'Final Price', 'number'],
    ['issueDate', 'Issue Date', 'date'],
    ['validUntil', 'Valid Until', 'date'],
  ],
  purchase_orders: [
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['quotationId', 'Quotation', 'relation', false, null, 'quotations'],
    ['poNo', 'PO No', 'text', true],
    ['amount', 'PO Amount', 'number'],
    ['issueDate', 'PO Date', 'date'],
    ['status', 'Status', 'text'],
  ],
  invoices: [
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['invoiceNo', 'Invoice No', 'text', true],
    ['invoiceDate', 'Invoice Date', 'date'],
    ['dueDate', 'Due Date', 'date'],
    ['amountExcludingSST', 'Amount Excl. SST', 'number'],
    ['sstAmount', 'SST Amount', 'number'],
    ['totalAmount', 'Total Amount', 'number'],
    ['collectionAmount', 'Collected', 'number'],
    ['outstandingAmount', 'Outstanding', 'number'],
  ],
  payments: [
    ['invoice', 'Invoice', 'relation', false, null, 'invoices'],
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['paymentNo', 'Payment Reference', 'text'],
    ['amount', 'Amount', 'number', true],
    ['date', 'Payment Date', 'date'],
    ['reference', 'Bank Reference', 'text'],
  ],
  action_items: [
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['title', 'Action', 'text', true],
    ['owner', 'Owner', 'text'],
    ['personEmail', 'Person Email', 'email'],
    ['dueDate', 'Due Date', 'date'],
    ['potentialRevenue', 'Potential Revenue', 'number'],
    ['agingDays', 'Aging Days', 'number'],
    ['priority', 'Priority', 'text'],
    ['notes', 'Notes', 'text'],
  ],
  training_delivery: [
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['title', 'Title', 'text', true],
    ['date', 'Date', 'date'],
    ['time', 'Time', 'text'],
    ['trainer', 'Trainer', 'text'],
    ['venue', 'Venue', 'text'],
    ['mode', 'Mode', 'text'],
    ['status', 'Status', 'text'],
  ],
  training_statistics: [
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['trainingDate', 'Training Date', 'date'],
    ['trainingName', 'Training Name', 'text', true],
    ['trainingCategory', 'Category', 'text'],
    ['domain', 'Domain', 'text'],
    ['workshopCount', 'Workshop Count', 'number'],
    ['trainingCount', 'Training Count', 'number'],
    ['totalCount', 'Total Count', 'number'],
    ['bumiputeraCount', 'Bumiputera Count', 'number'],
    ['nonBumiputeraCount', 'Non-Bumiputera Count', 'number'],
    ['totalCharges', 'Total Charges', 'number'],
    ['sstAmount', 'SST Amount', 'number'],
    ['finalCharges', 'Final Charges', 'number'],
  ],
  participants: [
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['client', 'Client', 'relation', false, null, 'clients'],
    ['name', 'Name', 'text', true],
    ['email', 'Email', 'email'],
    ['company', 'Company', 'text'],
    ['phone', 'Phone', 'text'],
    ['status', 'Attendance Status', 'text'],
  ],
  documents: [
    ['programmeId', 'Programme', 'relation', false, null, 'programmes'],
    ['name', 'Name', 'text', true],
    ['type', 'Type', 'text'],
    ['storagePath', 'Storage Path', 'text'],
    ['uploadedBy', 'Uploaded By', 'text'],
    ['date', 'Date', 'date'],
    ['size', 'Size', 'text'],
  ],
};

const fieldsFor = (collection, row) => (EDIT_FIELDS[collection] || [])
  .filter(([name]) => Object.prototype.hasOwnProperty.call(row, name))
  .map(([name, label, type = 'text', required = false, options, relation]) => ({
    name,
    label,
    type,
    required,
    options,
    relation,
  }));

export default function DataTable({
  columns,
  data,
  searchKeys = [],
  searchPlaceholder = 'Search…',
  filters = [],
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filter criteria.',
}) {
  const { deleteRecord, refresh } = usePmsData();
  const [query, setQuery] = useState('');
  const [filterState, setFilterState] = useState(() =>
    Object.fromEntries(filters.map((f) => [f.key, 'all'])),
  );
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.filter((row) => {
      if (
        q &&
        !searchKeys.some((key) =>
          String(row[key] ?? '').toLowerCase().includes(q),
        )
      ) {
        return false;
      }

      return filters.every((filter) => {
        const value = filterState[filter.key];
        return !value || value === 'all' || String(row[filter.key]) === value;
      });
    });
  }, [data, query, searchKeys, filters, filterState]);

  const handleDelete = async (row) => {
    const collection = inferCollection(row);

    if (!collection) {
      toast.error('This table does not have a configured delete action yet.');
      return;
    }

    if (!row.id) {
      toast.error('Cannot delete this record because its ID is missing.');
      return;
    }

    if (
      !window.confirm(
        `Delete this ${collection.replaceAll('_', ' ')} record? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(row.id);

    try {
      await deleteRecord(collection, row.id);
      toast.success('Record deleted successfully.');
    } catch (error) {
      console.error(`[PMS] delete ${collection} failed`, error);
      toast.error(
        error?.message ||
          'Unable to delete record. Check your permissions and try again.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {(searchKeys.length > 0 || filters.length > 0) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {searchKeys.length > 0 && (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.8}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 bg-white pl-9 text-sm"
              />
            </div>
          )}

          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={filterState[filter.key]}
              onValueChange={(value) =>
                setFilterState((previous) => ({
                  ...previous,
                  [filter.key]: value,
                }))
              }
            >
              <SelectTrigger className="h-9 w-full bg-white text-sm sm:w-44">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 ${column.className ?? ''}`}
                  >
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((row) => {
                const collection = inferCollection(row);
                const fields = fieldsFor(collection, row);

                return (
                  <TableRow key={row.id} className="hover:bg-violet-50/40">
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={`text-sm ${column.className ?? ''}`}
                      >
                        {column.render ? column.render(row) : row[column.key]}
                      </TableCell>
                    ))}

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {collection && fields.length > 0 ? (
                          <EntityDialog
                            mode="edit"
                            collection={collection}
                            recordId={row.id}
                            title={collection
                              .replaceAll('_', ' ')
                              .replace(/\b\w/g, (character) => character.toUpperCase())
                              .replace(/s$/, '')}
                            description="Update this record. Changes are saved immediately to the PMS database."
                            triggerLabel="Edit"
                            initialValues={row}
                            fields={fields}
                            onCreated={refresh}
                          />
                        ) : null}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Delete"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
              <Inbox className="h-6 w-6 text-violet-400" strokeWidth={1.8} />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-800">{emptyTitle}</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{emptyDescription}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {data.length} records
      </p>
    </div>
  );
}
