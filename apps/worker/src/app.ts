import { SECURITY_HEADERS, SIGN_IN_OPTIONS_PATH, type SignInOptionsDto } from "@price-watch/contract";

import { accountRoutes } from "./api/account";
import { billingRoutes } from "./api/billing";
import type { ApiContext, PublicContext } from "./api/context";
import { devRoutes } from "./api/dev";
import { linkRoutes } from "./api/links";
import { createAuth, isGoogleSignInEnabled } from "./auth";
import { handlePaddleWebhook } from "./billing/webhook";
import type { Deps } from "./deps";
import { isDev } from "./env";
import { HttpError, errorResponse, matchRoute, type Route } from "./http";
import { getAccountByUserId } from "./repo/accounts";
import { guardAuthRequest } from "./shield/auth-guard";

export const API_ROUTES: Route<ApiContext>[] = [...accountRoutes, ...billingRoutes, ...linkRoutes];
const READ_METHODS = new Set(["GET", "HEAD"]);
const AUTH_PREFIX = "/api/auth/";
const PADDLE_WEBHOOK_PATH = "/paddle/webhook";
// SPA routes that must get the empty app shell, not the prerendered landing page in index.html.
const APP_SHELL_PATH = /^\/(app|app\/.*|sign-in)$/;
const APP_SHELL_ASSET = "/app-shell";
// Prerendered 404.html. Assets use not_found_handling = "none", so every unknown path reaches the Worker.
const NOT_FOUND_ASSET = "/404";

export async function handleRequest({ deps, request }: { deps: Deps; request: Request }) {
  return withSecurityHeaders(await routeRequestSafely({ deps, request }));
}

async function routeRequestSafely({ deps, request }: { deps: Deps; request: Request }) {
  try {
    return await routeRequest({ deps, request });
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error);
    }
    console.error("Unhandled request error", error instanceof Error ? error.name : "unknown");
    return errorResponse(new HttpError(500, "internal", "Something went wrong"));
  }
}

async function routeRequest({ deps, request }: { deps: Deps; request: Request }) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith(AUTH_PREFIX)) {
    await guardAuthRequest({ deps, request });
    return createAuth({ env: deps.env, mailer: deps.mailer }).handler(request);
  }
  if (pathname === SIGN_IN_OPTIONS_PATH && READ_METHODS.has(request.method)) {
    const options: SignInOptionsDto = { google: isGoogleSignInEnabled(deps.env) };
    return Response.json(options);
  }
  if (pathname === PADDLE_WEBHOOK_PATH && request.method === "POST") {
    return handlePaddleWebhook({ deps, request });
  }
  if (pathname.startsWith("/dev/")) {
    return routeDevRequest({ deps, request });
  }
  if (pathname.startsWith("/api/")) {
    return routeApiRequest({ deps, request });
  }
  if (APP_SHELL_PATH.test(pathname) && READ_METHODS.has(request.method) && deps.env.ASSETS) {
    return deps.env.ASSETS.fetch(new URL(APP_SHELL_ASSET, request.url));
  }
  if (READ_METHODS.has(request.method) && deps.env.ASSETS) {
    return serveNotFoundPage({ assets: deps.env.ASSETS, request });
  }
  throw new HttpError(404, "not_found", "Not found");
}

// A real 404 for unknown public paths, so search engines don't index them as copies of the landing page.
async function serveNotFoundPage({ assets, request }: { assets: Fetcher; request: Request }) {
  const page = await assets.fetch(new URL(NOT_FOUND_ASSET, request.url));
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "x-robots-tag": "noindex",
    "cache-control": "no-cache",
  });
  const body = page.ok
    ? page.body
    : '<!doctype html><title>Page not found</title><h1>Page not found</h1><a href="/">Home</a>';

  return new Response(request.method === "HEAD" ? null : body, { status: 404, headers });
}

async function routeDevRequest({ deps, request }: { deps: Deps; request: Request }) {
  const match = isDev(deps.env) ? matchRoute<PublicContext>({ routes: devRoutes, request }) : null;

  if (!match) {
    throw new HttpError(404, "not_found", "Not found");
  }
  return match.route.handler({
    deps,
    request,
    params: match.params,
  });
}

async function routeApiRequest({ deps, request }: { deps: Deps; request: Request }) {
  const session = await createAuth({ env: deps.env, mailer: deps.mailer }).api.getSession({ headers: request.headers });
  if (!session) {
    throw new HttpError(401, "unauthorized", "Sign in first");
  }

  const account = await getAccountByUserId({ db: deps.db, userId: session.user.id });
  if (!account) {
    throw new HttpError(403, "no_account", "This user has no account");
  }

  const match = matchRoute<ApiContext>({ routes: API_ROUTES, request });

  if (!match) {
    throw new HttpError(404, "not_found", "Not found");
  }

  return match.route.handler({
    deps,
    account,
    request,
    params: match.params,
  });
}

function withSecurityHeaders(response: Response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
}
