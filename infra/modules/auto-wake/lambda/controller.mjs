import crypto from "node:crypto";

export const ENVIRONMENT_STATES = Object.freeze({
  SLEEPING: "SLEEPING",
  WAKING: "WAKING",
  READY: "READY",
  SLEEPING_DOWN: "SLEEPING_DOWN",
  FAILED: "FAILED",
});

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        return [part.slice(0, separator), part.slice(separator + 1)];
      })
  );
}

function signature(payload, signingKey) {
  return crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
}

export function createSession(signingKey, ttlSeconds, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(now / 1000) + ttlSeconds, nonce: crypto.randomUUID() })
  ).toString("base64url");
  return `${payload}.${signature(payload, signingKey)}`;
}

export function verifySession(value, signingKey, now = Date.now()) {
  if (!value) return false;
  const [payload, providedSignature, extra] = value.split(".");
  if (!payload || !providedSignature || extra) return false;
  const expectedSignature = signature(payload, signingKey);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isInteger(data.exp) && data.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function secretsMatch(provided, expected) {
  const left = Buffer.from(String(provided ?? ""));
  const right = Buffer.from(String(expected ?? ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function originalRequestUri(event) {
  const path = event.rawPath || event.requestContext?.http?.path || "/";
  return event.rawQueryString ? `${path}?${event.rawQueryString}` : path;
}

export function wakingResponse(state, originalUri, retrySeconds = 10) {
  const method = state.method?.toUpperCase() || "GET";
  if (method !== "GET" && method !== "HEAD") {
    return {
      statusCode: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(retrySeconds),
      },
      body: JSON.stringify({ status: state.value, retryAfter: retrySeconds }),
    };
  }

  const safeUri = JSON.stringify(originalUri).replaceAll("<", "\\u003c");
  const safeState = escapeHtml(state.value);
  const body = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Iniciando ambiente</title><style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#eef2ff;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:34rem;padding:2rem;border:1px solid #334155;border-radius:1rem;background:#111827}small{color:#94a3b8}</style></head>
<body><main class="card"><h1>Iniciando o ambiente</h1><p>Os recursos estão sendo preparados. Esta página voltará automaticamente para o endereço solicitado.</p><small id="state">Estado: ${safeState}</small></main>
<script>const original=${safeUri};async function poll(){try{const response=await fetch('/_infra/status',{cache:'no-store'});const data=await response.json();document.getElementById('state').textContent='Estado: '+data.state;if(data.state==='READY')location.replace(original)}catch{} }setInterval(poll,${retrySeconds * 1000});poll();</script></body></html>`;

  return {
    statusCode: 202,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(retrySeconds),
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
    body,
  };
}

export function accessPage(message = "") {
  const notice = message ? `<p role="alert">${escapeHtml(message)}</p>` : "";
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
    body: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso ao laboratório</title><style>body{font-family:system-ui,sans-serif;max-width:30rem;margin:10vh auto;padding:1rem}input,button{box-sizing:border-box;width:100%;padding:.75rem;margin:.5rem 0}</style></head><body><h1>Acesso ao laboratório</h1>${notice}<form method="post" action="/session"><label>Segredo de acesso<input name="token" type="password" required autocomplete="current-password"></label><button type="submit">Entrar</button></form></body></html>`,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
