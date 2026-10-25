#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { RenphoApiService } from "./services/renpho-api.js";

try {
  const config = loadConfig();
  await new RenphoApiService(config.email, config.password).checkLogin();
  console.log(
    JSON.stringify({
      ok: true,
      check: "login_only",
      checked_at: new Date().toISOString(),
    }),
  );
} catch (error) {
  // Only the service's closed-vocabulary diagnostic is allowed on this surface.
  const message =
    error instanceof Error &&
    error.message.startsWith("RENPHO login failed: endpoint=")
      ? error.message
      : "RENPHO login check could not run; verify configuration privately";
  console.error(
    JSON.stringify({ ok: false, check: "login_only", error: message }),
  );
  process.exitCode = 1;
}
