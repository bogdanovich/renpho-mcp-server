import assert from "node:assert/strict";
import test from "node:test";
import { RenphoApiService } from "../src/services/renpho-api.js";

test("login sends its app version in the header required by Renpho's decryption gateway", async (t) => {
  const email = "header-regression@example.com";
  const password = "unchanged-password";
  const service = new RenphoApiService(email, password);
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) => {
      calls++;
      const envelope = JSON.parse(String(options?.body));
      const payload = JSON.parse(
        (service as any).decryptAES(envelope.encryptData),
      );
      assert.equal(payload.login.email, email);
      assert.equal(
        payload.login.password,
        password,
        "client must preserve the saved password",
      );
      const headers = new Headers(options?.headers);
      // The live endpoint returns -114 before account authentication when this
      // header is missing, even though the payload contains appRevision.
      if (headers.get("appVersion") !== payload.login.appRevision) {
        return new Response(
          JSON.stringify({ code: -114, message: "Decryption failed" }),
        );
      }
      const data = (service as any).encryptAES(
        JSON.stringify({ login: { id: "123", token: "fixture-token", email } }),
      );
      return new Response(JSON.stringify({ code: 101, data }));
    },
  );

  await service.checkLogin();
  assert.equal(calls, 1, "login must not hide a missing header with retries");
});
