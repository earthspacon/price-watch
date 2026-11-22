import { readFileSync } from "node:fs";
import path from "node:path";

import { PLANS, type Plan } from "@price-watch/contract";
import { describe, expect, it } from "vitest";

import TEMPLATE from "../../index.html?raw";
import { CONTACT_EMAIL, SELLER_LEGAL_NAME } from "../site/config";
import { buildPrerenderedFiles } from "./entry";

const SITE_URL = "https://pricedawn.spacesonlabs.com";
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/prisync-alternative",
  "/track-shopify-competitor-prices",
  "/terms",
  "/privacy",
  "/refunds",
];
const LEGAL_PATHS = ["/terms", "/privacy", "/refunds"];
const FOOTER_PATHS = ["/pricing", ...LEGAL_PATHS];
const PLAN_ORDER: Plan[] = ["starter", "pro"];
const HERO_TEXT =
  "Wake up to your competitors' price changes: a daily email for Shopify store owners who check rival prices by hand.";
const EXAMPLE_DIGEST_LINE = "Linen Shirt — Blue / M: 24.99 → 19.99 (-5.00, -20.0%)";
const COMPETITOR_PRICES = ["$99", "$199", "$299", "$399", "$499"];
const COMPETITOR_SOURCES = [
  /href="https:\/\/(www\.)?prisync\.com\/pricing\/?"/,
  /href="https:\/\/(www\.)?pricemole\.io\/pricing\/?"/,
];
const SOURCES_CHECKED = "checked November 21, 2026";
const SUB_PROCESSORS = ["Cloudflare", "Brevo", "Paddle", "Google"];
const OG_IMAGE_FILE = path.resolve(import.meta.dirname, "../../public/og.png");
const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};
const NOINDEX = '<meta name="robots" content="noindex" />';

const files = new Map(
  buildPrerenderedFiles(TEMPLATE).map(({ file, content }) => {
    return [file, content];
  }),
);

describe("prerendered public site", () => {
  it("R25: the landing page is prerendered with hero, example, steps and FAQ", () => {
    const html = readPage("/");
    const text = readText(html);
    const graph: Array<Record<string, unknown>> = readJsonLd(html)["@graph"];
    const app = graph.find((node) => node["@type"] === "SoftwareApplication");
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    const questions = (faq?.mainEntity ?? []) as Array<{ "@type": string; name: string }>;

    expect(html).toContain('<div id="root" data-prerendered="/">');
    expect(text).toContain(HERO_TEXT);
    expect(text).toContain("rival.example");
    expect(text).toContain(EXAMPLE_DIGEST_LINE);
    expect(text).toContain("How it works");
    expect(app?.offers).toEqual(
      PLAN_ORDER.map((plan) => {
        return expect.objectContaining({
          name: PLANS[plan].name,
          price: String(PLANS[plan].monthlyCents / 100),
          priceCurrency: "USD",
        });
      }),
    );
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
      expect(question["@type"]).toBe("Question");
      expect(text).toContain(question.name);
    }
  });

  it("R25: every public page has its own title, description, canonical and social tags", () => {
    const titles = new Set<string>();

    for (const pagePath of PUBLIC_PATHS) {
      const html = readPage(pagePath);
      titles.add(/<title>(.*?)<\/title>/.exec(html)?.[1] ?? "");

      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html.match(/<meta name="description"/g)).toHaveLength(1);
      expect(html).toContain(`<link rel="canonical" href="${buildPageUrl(pagePath)}" />`);
      expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og.png" />`);
      expect(html).toContain(`<meta property="og:image:width" content="${OG_IMAGE_SIZE.width}" />`);
      expect(html).toContain(`<meta property="og:image:height" content="${OG_IMAGE_SIZE.height}" />`);
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(html).toContain(`data-prerendered="${pagePath}"`);
    }
    expect(titles.size).toBe(PUBLIC_PATHS.length);
    expect(readPngSize(OG_IMAGE_FILE)).toEqual(OG_IMAGE_SIZE);
  });

  it("R26: the pricing page shows both plans from one config", () => {
    const text = readText(readPage("/pricing"));

    for (const plan of PLAN_ORDER) {
      expect(text).toContain(PLANS[plan].name);
      expect(text).toContain(`${formatDollars(PLANS[plan].monthlyCents)}/mo`);
      expect(text).toContain(`${PLANS[plan].linkLimit.toLocaleString("en-US")} links`);
    }
    expect(text).toContain("one product variant");
    expect(text).toMatch(/14[- ]day/);
    expect(text).toContain("Paddle");
  });

  it("R27: the Prisync comparison cites its sources", () => {
    const html = readPage("/prisync-alternative");
    const text = readText(html);

    expect(text).toContain("Prisync");
    expect(text).toContain("PriceMole");
    for (const price of [...COMPETITOR_PRICES, ...PLAN_ORDER.map((plan) => formatDollars(PLANS[plan].monthlyCents))]) {
      expect(text).toContain(price);
    }
    for (const source of COMPETITOR_SOURCES) {
      expect(html).toMatch(source);
    }
    expect(text).toContain(SOURCES_CHECKED);
  });

  it("R27: the problem page explains tracking Shopify prices", () => {
    const html = readPage("/track-shopify-competitor-prices");
    const heading = readText(/<h1[^>]*>(.*?)<\/h1>/s.exec(html)?.[1] ?? "");
    const text = readText(html);

    expect(heading).toMatch(/Shopify competitor prices/i);
    expect(text).toMatch(/by hand/i);
    expect(text).toMatch(/spreadsheet/i);
    expect(text).toContain("PriceDawn");
    expect(text).toContain("7:00");
  });

  it("R28: legal pages name Paddle and the sub-processors", () => {
    const terms = readText(readPage("/terms"));
    const privacy = readText(readPage("/privacy"));
    const refunds = readText(readPage("/refunds"));

    expect(terms).toMatch(/Paddle.*merchant of record/i);
    for (const subProcessor of SUB_PROCESSORS) {
      expect(privacy).toContain(subProcessor);
    }
    expect(privacy).not.toMatch(/Anthropic|OpenAI/);
    expect(refunds).toContain("14 days");
    for (const legal of [terms, privacy, refunds]) {
      expect(legal).toContain("Spaceson Labs");
      expect(legal).toContain(SELLER_LEGAL_NAME);
      expect(legal).not.toMatch(/SELLER_LEGAL_NAME|REPLACE_WITH/);
      expect(legal).toContain(CONTACT_EMAIL);
      expect(legal).toContain("pricedawn@spacesonlabs.com");
    }
    for (const pagePath of PUBLIC_PATHS) {
      const html = readPage(pagePath);
      for (const footerPath of FOOTER_PATHS) {
        expect(html, `${pagePath} links to ${footerPath}`).toContain(`href="${footerPath}"`);
      }
    }
  });

  it("R29: robots, sitemap and llms list the public pages", () => {
    const robots = readFile("robots.txt");
    const sitemapUrls = [...readFile("sitemap.xml").matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    const llms = readFile("llms.txt");

    expect(robots).toContain("Disallow: /app/");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(sitemapUrls.toSorted()).toEqual(PUBLIC_PATHS.map((pagePath) => buildPageUrl(pagePath)).toSorted());
    for (const plan of PLAN_ORDER) {
      expect(llms).toContain(PLANS[plan].name);
      expect(llms).toContain(formatDollars(PLANS[plan].monthlyCents));
      expect(llms).toContain(`${PLANS[plan].linkLimit.toLocaleString("en-US")} links`);
    }
    for (const pagePath of PUBLIC_PATHS) {
      expect(llms).toContain(buildPageUrl(pagePath));
    }
  });

  it("R29: the 404 page and the app shell are noindex", () => {
    const notFound = readFile("404.html");
    const shell = readFile("app-shell.html");

    expect(notFound).toContain(NOINDEX);
    expect(notFound).not.toContain('rel="canonical"');
    expect(readText(notFound)).toContain("Page not found");
    expect(notFound).toContain('href="/"');
    expect(shell).toContain(NOINDEX);
    expect(shell).toContain('<div id="root"></div>');
  });
});

function readFile(name: string) {
  const content = files.get(name);
  if (content === undefined) {
    throw new Error(`${name} was not prerendered`);
  }
  return content;
}

function readPage(pagePath: string) {
  return readFile(pagePath === "/" ? "index.html" : `${pagePath.slice(1)}.html`);
}

function buildPageUrl(pagePath: string) {
  return pagePath === "/" ? SITE_URL : `${SITE_URL}${pagePath}`;
}

function formatDollars(cents: number) {
  return `$${cents / 100}`;
}

// React separates text nodes with <!-- --> and escapes quotes, so compare the visible text instead of raw HTML.
function readText(html: string) {
  return html
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ");
}

function readJsonLd(html: string) {
  const match = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html);
  return JSON.parse(match?.[1] ?? "null");
}

// PNG stores width and height as big-endian 32-bit numbers in the IHDR chunk, right after the 16-byte header.
function readPngSize(file: string) {
  const png = readFileSync(file);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}
