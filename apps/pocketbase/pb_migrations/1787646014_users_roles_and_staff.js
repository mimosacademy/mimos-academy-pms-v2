/// <reference path="../pb_data/types.d.ts" />

// V2: user accounts are provisioned from server environment variables or
// through the Super Admin UI. No production passwords are stored in source control.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    if (!users.fields.getByName("role")) {
      users.fields.add(
        new SelectField({
          name: "role",
          required: true,
          maxSelect: 1,
          values: ["super_admin", "manager", "finance", "sales", "programme_pic", "trainer", "viewer"],
        }),
      );
    }

    const pw = users.fields.getByName("password");
    pw.min = Math.max(pw.min || 0, 12);

    // Accounts are provisioned by the hardened access migration or by Super Admin.
    users.createRule = "@request.auth.role = 'super_admin'";
    app.save(users);
  },
  () => {},
);
