/// <reference path="../pb_data/types.d.ts" />

// V1 compatibility layer: preserve fields and enumerations needed when
// migrating the deployed V1 system into V2.
migrate(
  (app) => {
    const opportunities = app.findCollectionByNameOrId("opportunities");
    const sector = opportunities.fields.getByName("sector");
    if (sector) {
      sector.values = ["Government", "Private", "Intercompany"];
      app.save(opportunities);
    }

    const add = (collectionName, fields) => {
      const col = app.findCollectionByNameOrId(collectionName);
      for (const field of fields) {
        if (!col.fields.getByName(field.name)) col.fields.add(new Field(field));
      }
      app.save(col);
    };

    add("opportunities", [
      { name: "speedToMarket", type: "text", max: 50 },
      { name: "remarks", type: "text", max: 1000 },
    ]);

    add("programmes", [
      { name: "v1LegacyId", type: "number", onlyInt: true, min: 0 },
      { name: "quotationNo", type: "text", max: 80 },
      { name: "quotationDate", type: "date" },
      { name: "poDate", type: "date" },
      { name: "invoiceNo", type: "text", max: 80 },
      { name: "invoiceDate", type: "date" },
      { name: "paymentStatusLegacy", type: "text", max: 20 },
      { name: "paymentMethodLegacy", type: "text", max: 100 },
      { name: "paymentDateLegacy", type: "date" },
    ]);
  },
  () => {},
);
