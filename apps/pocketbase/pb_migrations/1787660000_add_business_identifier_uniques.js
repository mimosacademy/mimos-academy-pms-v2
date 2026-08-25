/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const targets = [
      ["programmes", "idx_programmes_code_unique", "code"],
      ["quotations", "idx_quotations_quote_no_unique", "quoteNo"],
      ["purchase_orders", "idx_purchase_orders_po_no_unique", "poNo"],
      ["invoices", "idx_invoices_invoice_no_unique", "invoiceNo"],
      ["payments", "idx_payments_payment_no_unique", "paymentNo"],
    ];

    for (const [collectionName, indexName, fieldName] of targets) {
      const collection = app.findCollectionByNameOrId(collectionName);
      const exists = collection.indexes.some((index) => String(index).includes(indexName));
      if (!exists) {
        collection.indexes.push(`CREATE UNIQUE INDEX ${indexName} ON ${collectionName} (${fieldName})`);
        app.save(collection);
      }
    }
  },
  () => {},
);
