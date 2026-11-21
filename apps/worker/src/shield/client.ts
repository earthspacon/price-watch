// Cloudflare sets and overwrites this header at the edge, so a client can't spoof it in production.
export function readClientIp(request: Request) {
  return request.headers.get("cf-connecting-ip");
}

// Rate-limit keys are hashed so no raw email or IP is stored.
export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}
