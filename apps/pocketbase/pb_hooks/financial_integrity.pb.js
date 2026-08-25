// Server-side financial integrity guards for invoice payments.
// These checks apply to API writes, not only the web UI.

function paymentCountsTowardInvoice(record) {
  const status = record.getString("status") || "Completed";
  return status !== "Failed";
}

function invoiceTotal(invoice) {
  return Number(invoice.get("totalAmount") || invoice.get("amount") || 0);
}

function existingInvoicePaymentTotal(invoiceId, excludePaymentId) {
  const payments = $app.findRecordsByFilter(
    "payments",
    "invoice = {:invoice} && id != {:exclude}",
    "",
    0,
    0,
    { invoice: invoiceId, exclude: excludePaymentId || "" },
  );

  let total = 0;
  for (const payment of payments) {
    if (paymentCountsTowardInvoice(payment)) {
      total += Number(payment.get("amount") || 0);
    }
  }
  return total;
}

function validatePayment(e) {
  const invoiceId = e.record.getString("invoice");
  const amount = Number(e.record.get("amount") || 0);

  if (!invoiceId) {
    return e.next();
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestError("Payment amount must be greater than zero.");
  }

  const invoice = $app.findRecordById("invoices", invoiceId);
  const total = invoiceTotal(invoice);
  const existing = existingInvoicePaymentTotal(invoiceId, e.record.id);
  const projected = paymentCountsTowardInvoice(e.record) ? existing + amount : existing;

  if (total < 0) {
    throw new BadRequestError("Invoice total cannot be negative.");
  }

  if (projected > total + 0.005) {
    throw new BadRequestError("Payment total cannot exceed the invoice total.");
  }

  e.next();
}

onRecordCreateRequest(validatePayment, "payments");
onRecordUpdateRequest(validatePayment, "payments");

function validateInvoice(e) {
  const total = invoiceTotal(e.record);
  if (!Number.isFinite(total) || total < 0) {
    throw new BadRequestError("Invoice total cannot be negative.");
  }

  const payments = $app.findRecordsByFilter(
    "payments",
    "invoice = {:invoice}",
    "",
    0,
    0,
    { invoice: e.record.id },
  );

  let collected = 0;
  for (const payment of payments) {
    if (paymentCountsTowardInvoice(payment)) {
      collected += Number(payment.get("amount") || 0);
    }
  }

  if (collected > total + 0.005) {
    throw new BadRequestError("Invoice total cannot be reduced below its recorded payments.");
  }

  e.next();
}

onRecordCreateRequest(validateInvoice, "invoices");
onRecordUpdateRequest(validateInvoice, "invoices");
