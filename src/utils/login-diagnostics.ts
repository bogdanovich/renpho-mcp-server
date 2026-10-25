const LOGIN_ENDPOINT = "/renpho-aggregation/user/login";

// Never include upstream free text or response bodies: they may echo account
// identifiers, passwords, session tokens, or encrypted login data. Only numeric
// codes and a closed vocabulary of reasons cross the diagnostic boundary.
export function loginFailure(
  status: number | undefined,
  payload: unknown,
  reason?:
    | "network_error"
    | "invalid_json"
    | "missing_login_data"
    | "invalid_login_data",
): Error {
  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const rawCode = body.code;
  const code =
    typeof rawCode === "number" &&
    Number.isSafeInteger(rawCode) &&
    Math.abs(rawCode) <= 999999
      ? String(rawCode)
      : rawCode == null
        ? "missing"
        : "invalid";
  const message =
    [body.msg, body.message, body.error_description].find(
      (value): value is string => typeof value === "string",
    ) ?? "";
  const category =
    reason ??
    (status != null && status >= 300 && status < 400
      ? "redirect_refused"
      : status === 401
        ? "unauthorized"
        : status === 403
          ? "forbidden"
          : status === 404
            ? "endpoint_not_found"
            : status === 429
              ? "rate_limited"
              : status != null && status >= 500
                ? "upstream_error"
                : /invalid.*(?:password|credential)|(?:password|credential).*(?:invalid|incorrect)|wrong.*password/i.test(
                      message,
                    )
                  ? "credentials_rejected"
                  : /locked|disabled/i.test(message)
                    ? "account_restricted"
                    : "unexpected_login_response");
  return new Error(
    `RENPHO login failed: endpoint=${LOGIN_ENDPOINT} http_status=${status ?? "unavailable"} code=${code} reason=${category}`,
  );
}
