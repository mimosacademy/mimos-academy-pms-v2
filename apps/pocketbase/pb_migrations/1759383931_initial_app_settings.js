/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const settings = app.settings();
  settings.meta.appName = "MIMOS Academy PMS";
  settings.meta.appURL = $os.getenv("PB_PUBLIC_URL") || "http://127.0.0.1:8090";
  settings.meta.hideControls = false;
  settings.logs.maxDays = 30;
  settings.logs.minLevel = 8;
  settings.logs.logIP = true;
  settings.trustedProxy.headers = ["X-Real-IP", "X-Forwarded-For", "CF-Connecting-IP"];
  app.save(settings);
});
