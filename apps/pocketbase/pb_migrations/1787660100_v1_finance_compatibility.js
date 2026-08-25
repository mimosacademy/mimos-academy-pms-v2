/// <reference path="../pb_data/types.d.ts" />

// Preserve V1 payment classifications without weakening the API rules.
migrate(
  (app) => {
    const invoices = app.findCollectionByNameOrId("invoices");
    const paymentStatus = invoices.fields.getByName("paymentStatus");
    if (paymentStatus) paymentStatus.values = ["PAID", "UNPAID", "PARTIAL"];
    const paymentMethod = invoices.fields.getByName("paymentMethod");
    if (paymentMethod) paymentMethod.values = [
      "HRDCorp Claimable", "Self-Pay", "ePerolehan", "Bank Transfer", "Cheque", "Online Banking", "Credit Card",
    ];
    app.save(invoices);
  },
  () => {},
);
