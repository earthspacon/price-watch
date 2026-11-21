export const SIGNATURE_TOLERANCE_SECONDS = 5;

const encoder = new TextEncoder();

// Paddle-Signature: "ts=<unix seconds>;h1=<hex HMAC-SHA256 of `${ts}:${rawBody}`>"; more than one h1 during secret rotation.
export async function verifyPaddleSignature({
  header,
  rawBody,
  secret,
  now,
}: {
  header: string | null;
  rawBody: string;
  secret: string;
  now: Date;
}) {
  const parsed = parseSignatureHeader(header);

  if (!parsed) {
    return false;
  }
  if (Math.abs(now.getTime() / 1000 - Number(parsed.ts)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = await signPaddlePayload({ ts: parsed.ts, rawBody, secret });
  return parsed.signatures.some((signature) => {
    return isEqualHex({ a: signature, b: expected });
  });
}

export async function signPaddlePayload({ ts, rawBody, secret }: { ts: string; rawBody: string; secret: string }) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
  return [...new Uint8Array(mac)]
    .map((byte) => {
      return byte.toString(16).padStart(2, "0");
    })
    .join("");
}

function parseSignatureHeader(header: string | null) {
  if (!header) {
    return null;
  }
  const parts = header.split(";").map((part) => {
    return part.trim().split("=");
  });
  const ts = parts.find(([key]) => key === "ts")?.[1];
  const signatures = parts
    .filter(([key, value]) => {
      return key === "h1" && Boolean(value);
    })
    .map(([, value]) => value);

  if (!ts || !/^\d+$/.test(ts) || signatures.length === 0) {
    return null;
  }
  return {
    ts,
    signatures,
  };
}

function isEqualHex({ a, b }: { a: string; b: string }) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
