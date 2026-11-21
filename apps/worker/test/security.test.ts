import { describe, expect, it } from "vitest";

import { addLinks, apiFetch, countRows, findLinkId, productUrl, uniqueEmail } from "./helpers";
import { postPaddleEvent } from "./paddle";
import { signInAccount } from "./session";

// Every API route that takes a link id; each must hide another account's link behind a 404.
const ID_ROUTES = [{ method: "DELETE", path: "/api/links/:linkId" }];

function expectSecurityHeaders({ response, label }: { response: Response; label: string }) {
  expect(response.headers.get("content-security-policy"), label).toContain("frame-ancestors 'none'");
  expect(response.headers.get("strict-transport-security"), label).toMatch(/max-age=\d+/);
  expect(response.headers.get("x-content-type-options"), label).toBe("nosniff");
  expect(response.headers.get("referrer-policy"), label).toBe("strict-origin-when-cross-origin");
}

describe("security", () => {
  it("R30: every worker response carries the security headers", async () => {
    const { cookie } = await signInAccount({
      email: uniqueEmail({ prefix: "headers" }),
      plan: "pro",
      status: "active",
    });
    const responses = {
      "signed-in API": await apiFetch({ cookie, path: "/api/me" }),
      "anonymous API": await apiFetch({ path: "/api/links" }),
      "sign-in options": await apiFetch({ path: "/api/sign-in-options" }),
      "auth session": await apiFetch({ cookie, path: "/api/auth/get-session" }),
      "webhook rejection": await postPaddleEvent({ body: "{}", secret: "not-the-webhook-secret" }),
      "unknown path": await apiFetch({ path: "/no-such-page" }),
    };

    expect(responses["signed-in API"].status).toBe(200);
    expect(responses["anonymous API"].status).toBe(401);
    for (const [label, response] of Object.entries(responses)) {
      expectSecurityHeaders({ response, label });
    }
  });

  it("R31: every id route returns 404 for another account's link", async () => {
    const owner = await signInAccount({ email: uniqueEmail({ prefix: "owner" }), plan: "pro", status: "active" });
    const stranger = await signInAccount({ email: uniqueEmail({ prefix: "stranger" }), plan: "pro", status: "active" });
    await addLinks({ cookie: owner.cookie, urls: [productUrl({ host: "rival.example", handle: "linen-shirt" })] });
    const linkId = await findLinkId({ accountId: owner.accountId, host: "rival.example", handle: "linen-shirt" });

    for (const route of ID_ROUTES) {
      const response = await apiFetch({
        cookie: stranger.cookie,
        path: route.path.replace(":linkId", linkId),
        method: route.method,
      });

      expect(response.status, `${route.method} ${route.path}`).toBe(404);
    }
    expect(await countRows({ sql: "SELECT COUNT(*) AS n FROM links WHERE id = ?", binds: [linkId] })).toBe(1);
  });
});
