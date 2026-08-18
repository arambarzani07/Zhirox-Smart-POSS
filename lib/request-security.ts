const EMAIL_HEADER = "oai-authenticated-user-email";
const FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";

export type AuthenticatedIdentity = {
  email: string;
  displayName: string;
};

export class ApiSecurityError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function normalizedOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requireTrustedMutationRequest(request: Request) {
  const url = new URL(request.url);
  const origin = normalizedOrigin(request.headers.get("origin"));
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== url.origin) throw new ApiSecurityError(403, "CROSS_ORIGIN_REQUEST_DENIED");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    throw new ApiSecurityError(403, "CROSS_SITE_REQUEST_DENIED");
  }
}

export function requireAuthenticatedIdentity(request: Request): AuthenticatedIdentity {
  const email = request.headers.get(EMAIL_HEADER)?.trim().toLowerCase();
  if (!email || email.length > 320 || !email.includes("@")) {
    throw new ApiSecurityError(401, "AUTH_REQUIRED");
  }

  const encodedName = request.headers.get(FULL_NAME_HEADER);
  let displayName = email;
  if (encodedName && request.headers.get(FULL_NAME_ENCODING_HEADER) === "percent-encoded-utf-8") {
    try {
      displayName = decodeURIComponent(encodedName).trim().slice(0, 120) || email;
    } catch {
      displayName = email;
    }
  }

  return { email, displayName };
}

export function apiSecurityResponse(error: unknown) {
  if (!(error instanceof ApiSecurityError)) return null;
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    },
  );
}

export const apiSecurityHeaders = {
  "Cache-Control": "no-store, private",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;
