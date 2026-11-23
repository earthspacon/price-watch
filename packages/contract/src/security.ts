// One header set for every response: the Worker adds it to its own responses, the web build writes it to `_headers`
// for static assets. Turnstile (sign-in), Paddle (checkout) and Cloudflare Web Analytics (page views) are the only third parties.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://cdn.paddle.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://cdn.paddle.com",
  "img-src 'self' data: https://*.paddle.com",
  "font-src 'self'",
  "connect-src 'self' https://*.paddle.com https://cloudflareinsights.com",
  "frame-src https://challenges.cloudflare.com https://*.paddle.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
