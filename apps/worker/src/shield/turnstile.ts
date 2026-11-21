export const TURNSTILE_HEADER = "x-turnstile-token";
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

// Server-side check of the widget token. Any failure (missing token, network, bad answer) means "not human".
export async function verifyTurnstile({
  secret,
  token,
  ip,
}: {
  secret: string | undefined;
  token: string | null;
  ip: string | null;
}) {
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY is not set");
  }
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return false;
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) {
    form.append("remoteip", ip);
  }

  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    body: form,
  }).catch(() => {
    return null;
  });
  if (!response?.ok) {
    return false;
  }
  const outcome: { success?: unknown } = await response.json();
  return outcome.success === true;
}
