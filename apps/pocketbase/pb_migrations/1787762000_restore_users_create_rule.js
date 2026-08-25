/// <reference path="../pb_data/types.d.ts" />

// Restore the application boundary after the CI bootstrap migration.
// Only application Super Admin accounts may create application users.
// PocketBase _superusers are intentionally not granted this rule-level access.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "@request.auth.role = 'super_admin'";
    app.save(users);
  },
  () => {},
);
