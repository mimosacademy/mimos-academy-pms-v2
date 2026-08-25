/// <reference path="../pb_data/types.d.ts" />

// V2 enterprise field refinement. Uses the typed PocketBase JSVM field
// constructors so the migration is compatible with current PocketBase APIs.

const makeField = (f) => {
  switch (f.type) {
    case "text": return new TextField(f);
    case "email": return new EmailField(f);
    case "number": return new NumberField(f);
    case "select": return new SelectField(f);
    case "date": return new DateField(f);
    default: throw new Error(`Unsupported migration field type: ${f.type}`);
  }
};

const addFields = (app, collectionName, fields) => {
  const col = app.findCollectionByNameOrId(collectionName);
  for (const field of fields) {
    if (!col.fields.getByName(field.name)) col.fields.add(makeField(field));
  }
  app.save(col);
};

const FIELD_GROUPS = {
  programmes: [
    { name: "trainingType", type: "text", max: 60 },
    { name: "programmeCategory", type: "select", maxSelect: 1, values: ["In-House", "Public", "Workshop"] },
    { name: "accountManager", type: "text", max: 100 },
    { name: "durationDays", type: "number", onlyInt: true },
    { name: "totalRevenueExclSST", type: "number", min: 0 },
    { name: "sstAmount", type: "number", min: 0 },
    { name: "totalRevenueInclSST", type: "number", min: 0 },
    { name: "totalCollection", type: "number", min: 0 },
    { name: "outstandingAmount", type: "number", min: 0 },
    { name: "poNo", type: "text", max: 60 },
  ],
  quotations: [
    { name: "revision", type: "text", max: 20 },
    { name: "quotationType", type: "select", maxSelect: 1, values: ["Training", "Space Rental", "Consultancy", "Service"] },
    { name: "trainingType", type: "text", max: 60 },
    { name: "accountManager", type: "text", max: 100 },
    { name: "pic", type: "text", max: 100 },
    { name: "unitPriceExclSST", type: "number", min: 0 },
    { name: "unitPriceInclSST", type: "number", min: 0 },
    { name: "totalPriceExclSST", type: "number", min: 0 },
    { name: "totalPriceInclSST", type: "number", min: 0 },
    { name: "sstAmount", type: "number", min: 0 },
    { name: "discountPercentage", type: "number", min: 0, max: 100 },
    { name: "finalPrice", type: "number", min: 0 },
  ],
  invoices: [
    { name: "amountExcludingSST", type: "number", min: 0 },
    { name: "sstAmount", type: "number", min: 0 },
    { name: "totalAmount", type: "number", min: 0 },
    { name: "collectionAmount", type: "number", min: 0 },
    { name: "outstandingAmount", type: "number", min: 0 },
    { name: "paymentStatus", type: "select", maxSelect: 1, values: ["PAID", "UNPAID", "PARTIAL"] },
    { name: "paymentMethod", type: "select", maxSelect: 1, values: ["HRDCorp Claimable", "Self-Pay", "ePerolehan"] },
    { name: "paymentDate", type: "date" },
    { name: "daysOutstanding", type: "number", onlyInt: true },
    { name: "quotationReference", type: "text", max: 80 },
    { name: "poReference", type: "text", max: 80 },
    { name: "accountManager", type: "text", max: 100 },
    { name: "pic", type: "text", max: 100 },
  ],
  opportunities: [
    { name: "opportunityStatus", type: "select", maxSelect: 1, values: ["Contract signed/PO issued", "Proposal/Tender submitted", "Negotiation stage", "Verbal commitment", "Early engagement", "Qualified lead/Tender in progress", "Lost/No-go"] },
    { name: "forecastValue", type: "number", min: 0 },
    { name: "weightedForecast", type: "number", min: 0 },
    { name: "securedOrderBookValue", type: "number", min: 0 },
    { name: "sector", type: "select", maxSelect: 1, values: ["Government", "Private", "Intercompany"] },
    { name: "accountManager", type: "text", max: 100 },
    { name: "salesman", type: "text", max: 100 },
    { name: "year", type: "number", onlyInt: true },
  ],
  action_items: [
    { name: "client", type: "text", max: 150 }, { name: "service", type: "text", max: 80 },
    { name: "personInCharge", type: "text", max: 100 }, { name: "personEmail", type: "email" },
    { name: "potentialRevenue", type: "number", min: 0 }, { name: "agingDays", type: "number", onlyInt: true },
    { name: "notes", type: "text", max: 500 },
  ],
  training_statistics: [
    { name: "trainingDate", type: "date" }, { name: "trainingName", type: "text", max: 200 },
    { name: "trainingCategory", type: "text", max: 60 }, { name: "domain", type: "text", max: 60 },
    { name: "workshopCount", type: "number", onlyInt: true }, { name: "trainingCount", type: "number", onlyInt: true },
    { name: "totalCount", type: "number", onlyInt: true }, { name: "bumiputeraCount", type: "number", onlyInt: true },
    { name: "nonBumiputeraCount", type: "number", onlyInt: true }, { name: "totalCharges", type: "number", min: 0 },
    { name: "sstAmount", type: "number", min: 0 }, { name: "finalCharges", type: "number", min: 0 },
  ],
};

migrate(
  (app) => Object.entries(FIELD_GROUPS).forEach(([collection, fields]) => addFields(app, collection, fields)),
  (app) => {
    for (const [collectionName, fields] of Object.entries(FIELD_GROUPS)) {
      const col = app.findCollectionByNameOrId(collectionName);
      for (const field of fields) {
        if (col.fields.getByName(field.name)) col.fields.removeByName(field.name);
      }
      app.save(col);
    }
  },
);
