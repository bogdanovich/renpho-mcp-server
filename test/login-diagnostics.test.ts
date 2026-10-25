import assert from "node:assert/strict";
import test from "node:test";
import { RenphoApiService } from "../src/services/renpho-api.js";

const EMAIL = "private-account@example.com";
const PASSWORD = "private-password-SuperSecret";
const TOKEN = "private-session-token";

test("login check makes one request and reports only sanitized failure metadata", async (t) => {
  for (const fixture of [
    {
      status: 401,
      body: { code: 401, msg: `${PASSWORD} ${EMAIL} ${TOKEN}` },
      reason: "unauthorized",
    },
    { status: 403, body: { code: 403, message: TOKEN }, reason: "forbidden" },
    { status: 404, body: { message: PASSWORD }, reason: "endpoint_not_found" },
    { status: 429, body: { code: TOKEN, msg: EMAIL }, reason: "rate_limited" },
    {
      status: 200,
      body: { code: 102, msg: `Invalid password ${PASSWORD}` },
      reason: "credentials_rejected",
    },
    {
      status: 200,
      body: { code: 101, data: TOKEN },
      reason: "invalid_login_data",
    },
    { status: 200, body: { code: 101 }, reason: "missing_login_data" },
    {
      status: 200,
      body: { code: -114, errorMsg: PASSWORD },
      reason: "unexpected_login_response",
    },
    {
      status: 302,
      body: { message: PASSWORD },
      reason: "redirect_refused",
    },
    { status: 502, body: "not JSON " + PASSWORD, reason: "invalid_json" },
  ]) {
    await t.test(`${fixture.status}/${fixture.reason}`, async () => {
      let calls = 0;
      t.mock.method(
        globalThis,
        "fetch",
        async (url: unknown, options?: RequestInit) => {
          calls++;
          assert.equal(
            options?.redirect,
            "manual",
            "credentials must not follow redirects",
          );
          assert.ok(options?.signal, "login must have a bounded timeout");
          assert.equal(
            String(url),
            "https://cloud.renpho.com/renpho-aggregation/user/login",
          );
          return new Response(
            typeof fixture.body === "string"
              ? fixture.body
              : JSON.stringify(fixture.body),
            {
              status: fixture.status,
            },
          );
        },
      );
      await assert.rejects(
        new RenphoApiService(EMAIL, PASSWORD).checkLogin(),
        (error: Error) => {
          assert.match(
            error.message,
            new RegExp(`http_status=${fixture.status}`),
          );
          assert.match(error.message, new RegExp(`reason=${fixture.reason}`));
          for (const secret of [
            EMAIL,
            PASSWORD,
            TOKEN,
            "undefined",
            "encryptData",
          ]) {
            assert.ok(
              !error.message.includes(secret),
              `diagnostic leaked ${secret}`,
            );
          }
          return true;
        },
      );
      assert.equal(calls, 1, "failed login must not be retried");
      t.mock.restoreAll();
    });
  }
});

test("network failures do not echo fetch errors or retry", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error(`${PASSWORD} ${TOKEN}`);
  });
  await assert.rejects(new RenphoApiService(EMAIL, PASSWORD).checkLogin(), {
    message:
      "RENPHO login failed: endpoint=/renpho-aggregation/user/login http_status=unavailable code=missing reason=network_error",
  });
  assert.equal(calls, 1);
});

test("successful login-only check never reads devices or measurements", async (t) => {
  const service = new RenphoApiService(EMAIL, PASSWORD);
  const data = (service as any).encryptAES(
    JSON.stringify({ login: { id: "123", token: TOKEN, email: EMAIL } }),
  );
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(JSON.stringify({ code: 101, data }));
  });
  assert.equal(await service.checkLogin(), undefined);
  assert.equal(calls, 1);
});
