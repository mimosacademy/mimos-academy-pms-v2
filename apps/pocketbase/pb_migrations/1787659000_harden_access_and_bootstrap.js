/// <reference path="../pb_data/types.d.ts" />

const AUTH = "@request.auth.id != ''";
const ROLE = (roles) => roles.map((r) => `@request.auth.role = '${r}'`).join(" || ");
const ANY = (roles) => `(${ROLE(roles)})`;

migrate(
  (app) => {
    const setRules = (name, rules) => {
      const c = app.findCollectionByNameOrId(name);
      Object.assign(c, rules);
      app.save(c);
    };

    // Users: only Super Admin manages accounts. Staff may view their own record.
    setRules("users", {
      listRule: ANY(["super_admin", "manager"]),
      viewRule: "@request.auth.id = id || @request.auth.role = 'super_admin' || @request.auth.role = 'manager'",
      createRule: "@request.auth.role = 'super_admin'",
      updateRule: "@request.auth.role = 'super_admin'",
      deleteRule: "@request.auth.role = 'super_admin'",
    });

    setRules("clients", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "sales", "programme_pic"]),
      updateRule: ANY(["super_admin", "manager", "sales", "programme_pic"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    setRules("opportunities", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "sales"]),
      updateRule: ANY(["super_admin", "manager", "sales"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    setRules("quotations", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "sales", "finance"]),
      updateRule: ANY(["super_admin", "manager", "sales", "finance"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    setRules("purchase_orders", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "sales", "finance"]),
      updateRule: ANY(["super_admin", "manager", "sales", "finance"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    setRules("programmes", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "sales", "programme_pic"]),
      updateRule: ANY(["super_admin", "manager", "sales", "programme_pic"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    ["training_delivery", "training_statistics", "participants", "documents"].forEach((name) => {
      setRules(name, {
        listRule: AUTH,
        viewRule: AUTH,
        createRule: ANY(["super_admin", "manager", "programme_pic", "trainer"]),
        updateRule: ANY(["super_admin", "manager", "programme_pic", "trainer"]),
        deleteRule: ANY(["super_admin", "manager", "programme_pic"]),
      });
    });

    setRules("action_items", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "sales", "finance", "programme_pic", "trainer"]),
      updateRule: ANY(["super_admin", "manager", "sales", "finance", "programme_pic", "trainer"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    setRules("invoices", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "finance"]),
      updateRule: ANY(["super_admin", "manager", "finance"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    setRules("payments", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: ANY(["super_admin", "manager", "finance"]),
      updateRule: ANY(["super_admin", "manager", "finance"]),
      deleteRule: ANY(["super_admin", "manager"]),
    });

    // Audit history is readable by staff and append-only for normal users.
    setRules("audit_history", {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: "@request.auth.role = 'super_admin'",
      deleteRule: "@request.auth.role = 'super_admin'",
    });

    // Bootstrap exactly one Super Admin from server-only environment variables.
    const email = $os.getenv("PB_BOOTSTRAP_USER_EMAIL");
    const password = $os.getenv("PB_BOOTSTRAP_USER_PASSWORD");
    if (email && password) {
      const users = app.findCollectionByNameOrId("users");
      let existing = null;
      try { existing = app.findAuthRecordByEmail("users", email); } catch (_) {}
      if (!existing) {
        const record = new Record(users);
        record.setEmail(email);
        record.setPassword(password);
        record.set("name", "System Administrator");
        record.set("role", "super_admin");
        record.set("verified", true);
        app.save(record);
      }
    }
  },
  () => {},
);
