/// <reference path="../pb_data/types.d.ts" />

// Adds an organisational team dimension without expanding the security role enum.
// Permission roles remain: super_admin, manager, finance, sales, programme_pic,
// trainer, viewer. Production staff provisioning is intentionally externalized.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.getByName("team")) {
      users.fields.add(new TextField({
        name: "team",
        id: "team",
        system: false,
        hidden: false,
        presentable: true,
        required: false,
        min: 0,
        max: 80,
        pattern: "",
      }));
      app.save(users);
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (users.fields.getByName("team")) {
      users.fields.removeByName("team");
      app.save(users);
    }
  },
);
