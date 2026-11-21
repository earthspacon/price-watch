const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare's documented test behaviour (developers.cloudflare.com/turnstile/troubleshooting/testing/):
// secret 1x…AA accepts only the dummy token, 2x…AA always fails. The real endpoint is never called from tests.
const PASSING_SECRET = "1x0000000000000000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export const siteverifyRequests: Array<{ secret: string; response: string }> = [];

export function installFakeSiteverify() {
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);

    if (request.url !== SITEVERIFY_URL) {
      return realFetch(input, init);
    }
    const form = await request.formData();
    const secret = String(form.get("secret"));
    const response = String(form.get("response"));
    siteverifyRequests.push({
      secret,
      response,
    });

    if (secret === PASSING_SECRET && response === DUMMY_TOKEN) {
      return Response.json({ success: true, "error-codes": [] });
    }
    return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
  };
}
