/// <reference path="../pb_data/types.d.ts" />

// Prevent duplicate business documents/registrations at the database layer.
// This is intentionally a migration-level constraint so concurrent users cannot
// create duplicate numbers even when requests arrive at the same time.

migrate(
  (app) => {
    const uniqueIndexes = [
      ["quotations", "idx_quotations_quote_no_unique", "quoteNo"],
      ["purchase_orders", "idx_purchase_orders_po_no_unique", "poNo"],
      ["invoices", "idx_invoices_invoice_no_unique", "invoiceNo"],
      ["payments", "idx_payments_payment_no_unique", "paymentNo"],
    ];

    for (const [collectionName, indexName, fieldName] of uniqueIndexes) {
      const collection = app.findCollectionByNameOrId(collectionName);
      if (!collection.fields.getByName(fieldName)) continue;

      const exists = collection.indexes.some((index) => String(index).includes(indexName));
      if (!exists) {
        collection.indexes.push(`CREATE UNIQUE INDEX ${indexName} ON ${collectionName} (${fieldName})`);
        app.save(collection);
      }
    }
  },
  () => {},
);
