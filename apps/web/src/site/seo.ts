import { OG_IMAGE, SITE_NAME, SITE_URL } from "./config";

export type DocumentInput = {
  template: string;
  path: string;
  title: string;
  description: string;
  body: string;
  jsonLd?: unknown;
  isNoIndex?: boolean;
};

const NOINDEX_TAG = '<meta name="robots" content="noindex" />';
const TITLE = /<title>.*?<\/title>/s;
const DESCRIPTION_META = /<meta\s+name="description"\s+content="[^"]*"\s*\/>/;

export function buildDocument({ template, path, title, description, body, jsonLd, isNoIndex = false }: DocumentInput) {
  const head = isNoIndex ? [NOINDEX_TAG] : buildPublicHead({ path, title, description });

  if (jsonLd !== undefined) {
    head.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  }

  return template
    .replace(TITLE, () => `<title>${escapeHtml(title)}</title>`)
    .replace(DESCRIPTION_META, () => `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace("</head>", () => `${head.join("\n    ")}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root" data-prerendered="${path}">${body}</div>`);
}

export function buildAppShellDocument(template: string) {
  return template.replace("</head>", () => `${NOINDEX_TAG}\n  </head>`);
}

export function buildPageUrl(path: string) {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export function buildRobots() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app/",
    "Disallow: /sign-in",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

export function buildSitemap(paths: readonly string[]) {
  const urls = paths.map((path) => {
    return `  <url><loc>${buildPageUrl(path)}</loc></url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function buildPublicHead({ path, title, description }: { path: string; title: string; description: string }) {
  const pageUrl = buildPageUrl(path);
  const imageUrl = `${SITE_URL}${OG_IMAGE.path}`;

  return [
    `<link rel="canonical" href="${pageUrl}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
  ];
}
