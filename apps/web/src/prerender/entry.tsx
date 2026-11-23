import { formatPrice, PLANS, type Plan } from "@price-watch/contract";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LandingPage } from "../site/LandingPage";
import { LegalPage } from "../site/LegalPage";
import { NotFoundPage } from "../site/NotFoundPage";
import { PRICE_CHECKER_TITLE, PriceCheckerPage } from "../site/PriceCheckerPage";
import { PricingPage } from "../site/PricingPage";
import { PrisyncAlternativePage } from "../site/PrisyncAlternativePage";
import { SiteLayout } from "../site/SiteLayout";
import { TrackShopifyPage } from "../site/TrackShopifyPage";
import { FAQ_ITEMS } from "../site/faq";
import { LEGAL_DOCUMENTS } from "../site/legal";
import { PAGE_LABELS, PUBLIC_PATHS, SITE_NAME, SITE_URL, type PublicPath } from "../site/config";
import { buildAppShellDocument, buildDocument, buildPageUrl, buildRobots, buildSitemap } from "../site/seo";

export type PrerenderedFile = {
  file: string;
  content: string;
};

type PageDefinition = {
  path: PublicPath;
  file: string;
  title: string;
  description: string;
  render: () => ReactElement;
  jsonLd?: unknown;
};

const PLAN_ORDER: Plan[] = ["starter", "pro"];

const LANDING_TITLE = "PriceDawn: your competitors' price changes every morning";
const LANDING_DESCRIPTION =
  "PriceDawn checks your competitors' Shopify product prices every day and emails you what changed each morning.";

const PAGES: readonly PageDefinition[] = [
  {
    path: "/",
    file: "index.html",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    render: () => <LandingPage />,
    jsonLd: buildLandingJsonLd(),
  },
  {
    path: "/pricing",
    file: "pricing.html",
    title: "Pricing: $9 or $19 a month — PriceDawn",
    description:
      "Starter is $9 a month for 250 links, Pro is $19 a month for 1,000. Every plan checks each link daily.",
    render: () => <PricingPage />,
  },
  {
    path: "/prisync-alternative",
    file: "prisync-alternative.html",
    title: "PriceDawn compared with Prisync and PriceMole",
    description: "Side-by-side prices for PriceDawn, Prisync and PriceMole, with the source of every number.",
    render: () => <PrisyncAlternativePage />,
  },
  {
    path: "/track-shopify-competitor-prices",
    file: "track-shopify-competitor-prices.html",
    title: "How to track Shopify competitor prices — PriceDawn",
    description: "The manual way, the spreadsheet way and the tracked way to follow a competitor's Shopify prices.",
    render: () => <TrackShopifyPage />,
  },
  {
    path: "/tools/shopify-price-checker",
    file: "tools/shopify-price-checker.html",
    title: `${PRICE_CHECKER_TITLE}, free | PriceDawn`,
    description:
      "Paste a Shopify product link and see each variant's current price and compare-at price. Free, no sign-up.",
    render: () => <PriceCheckerPage />,
  },
  {
    path: "/terms",
    file: "terms.html",
    title: `${LEGAL_DOCUMENTS.terms.title} — PriceDawn`,
    description: LEGAL_DOCUMENTS.terms.description,
    render: () => <LegalPage slug="terms" />,
  },
  {
    path: "/privacy",
    file: "privacy.html",
    title: `${LEGAL_DOCUMENTS.privacy.title} — PriceDawn`,
    description: LEGAL_DOCUMENTS.privacy.description,
    render: () => <LegalPage slug="privacy" />,
  },
  {
    path: "/refunds",
    file: "refunds.html",
    title: `${LEGAL_DOCUMENTS.refunds.title} — PriceDawn`,
    description: LEGAL_DOCUMENTS.refunds.description,
    render: () => <LegalPage slug="refunds" />,
  },
];

export function buildPrerenderedFiles(template: string): PrerenderedFile[] {
  const pages = PAGES.map((page) => {
    return {
      file: page.file,
      content: buildDocument({
        template,
        path: page.path,
        title: page.title,
        description: page.description,
        body: renderToStaticMarkup(<SiteLayout>{page.render()}</SiteLayout>),
        jsonLd: page.jsonLd,
      }),
    };
  });

  return [
    ...pages,
    {
      file: "404.html",
      content: buildDocument({
        template,
        path: "/404",
        title: "Page not found — PriceDawn",
        description: "The page you asked for does not exist.",
        body: renderToStaticMarkup(
          <SiteLayout>
            <NotFoundPage />
          </SiteLayout>,
        ),
        isNoIndex: true,
      }),
    },
    {
      file: "app-shell.html",
      content: buildAppShellDocument(template),
    },
    {
      file: "robots.txt",
      content: buildRobots(),
    },
    {
      file: "sitemap.xml",
      content: buildSitemap(PUBLIC_PATHS),
    },
    {
      file: "llms.txt",
      content: buildLlms(),
    },
  ];
}

function buildLandingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: LANDING_DESCRIPTION,
        offers: PLAN_ORDER.map((plan) => {
          return {
            "@type": "Offer",
            name: PLANS[plan].name,
            price: String(PLANS[plan].monthlyCents / 100),
            priceCurrency: "USD",
            url: `${SITE_URL}/pricing`,
          };
        }),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => {
          return {
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          };
        }),
      },
    ],
  };
}

function buildLlms() {
  const plans = PLAN_ORDER.map((plan) => {
    const { name, monthlyCents, linkLimit } = PLANS[plan];
    return `- ${name}: ${formatPrice(monthlyCents)}/mo, ${linkLimit.toLocaleString("en-US")} links`;
  });
  const pages = PUBLIC_PATHS.map((path) => {
    return `- ${PAGE_LABELS[path]}: ${buildPageUrl(path)}`;
  });

  return [
    "# PriceDawn",
    "",
    "> PriceDawn checks your competitors' Shopify product prices every day and emails you what changed each morning at 7:00 in your time zone.",
    "",
    "## Plans",
    ...plans,
    "",
    "## Pages",
    ...pages,
    "",
    "## Notes",
    "- A link is one product variant.",
    "- Shopify stores only.",
    "- A price is shown as the plain number from the store's product data; a link is only compared with itself.",
    "- Every plan includes the CSV export of the full price history.",
    "",
  ].join("\n");
}
