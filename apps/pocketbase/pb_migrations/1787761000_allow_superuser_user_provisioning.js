/// <reference path="../pb_data/types.d.ts" />

// Allow PocketBase superusers (including the CI bootstrap account) to provision
// application users. Application super_admin users retain the same capability.
// This is intentionally limited to user-account creation; it does not grant
// superusers access to application collection records through these rules.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "@request.auth.collectionName = '_superusers' || @request.auth.role = 'super_admin'";
    app.save(users);
  },
  () => {},
);
