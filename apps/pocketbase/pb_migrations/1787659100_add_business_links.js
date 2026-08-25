/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const programmes = app.findCollectionByNameOrId("programmes");
    const quotations = app.findCollectionByNameOrId("quotations");
    const purchaseOrders = app.findCollectionByNameOrId("purchase_orders");
    const opportunities = app.findCollectionByNameOrId("opportunities");

    const addRelation = (col, name, target) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(new RelationField({
          name,
          required: false,
          maxSelect: 1,
          collectionId: target.id,
          cascadeDelete: false,
        }));
      }
    };

    addRelation(programmes, "quotation", quotations);
    addRelation(programmes, "po", purchaseOrders);
    addRelation(programmes, "opportunity", opportunities);
    app.save(programmes);

    // Make programme codes unique to avoid accidental duplicate registrations.
    if (!programmes.indexes.some((x) => String(x).includes("idx_programmes_code_unique"))) {
      programmes.indexes.push("CREATE UNIQUE INDEX idx_programmes_code_unique ON programmes (code)");
      app.save(programmes);
    }
  },
  () => {},
);
