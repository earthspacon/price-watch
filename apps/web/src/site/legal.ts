import { CONTACT_EMAIL, REFUND_DAYS, SITE_NAME, SELLER_LEGAL_NAME } from "./config";

export type LegalSlug = "terms" | "privacy" | "refunds";

export type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
};

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  description: string;
  sections: readonly LegalSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: "terms",
    title: "Terms of service",
    description: `The rules for using ${SITE_NAME}, a competitor price tracker for Shopify stores.`,
    sections: [
      {
        heading: "The service",
        paragraphs: [
          `${SITE_NAME} checks the public product pages of the Shopify stores whose links you paste, keeps a price history, and emails you a morning digest of what changed.`,
          "You need an account with a working email address. You are responsible for the links you add and for keeping your sign-in email secure.",
        ],
      },
      {
        heading: "Payments",
        paragraphs: [
          `Paddle is the merchant of record for every payment. Paddle handles the checkout, the invoice, the card and any sales tax, and its own terms apply to the payment.`,
          `Prices are shown on the pricing page before you pay. A plan renews every month until you cancel it from the billing page.`,
        ],
      },
      {
        heading: "Fair use",
        paragraphs: [
          "Do not use the service to overload a store, to scrape data you have no right to, or to resell the price history. We may pause an account that abuses the checking limits.",
        ],
      },
      {
        heading: "Ending the agreement",
        paragraphs: [
          `You can stop at any time by cancelling the plan, and we can close an account that breaks these terms. Write to ${CONTACT_EMAIL} if you need help.`,
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy policy",
    description: `What ${SITE_NAME} stores, why it stores it, and who processes it.`,
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Your email address, the links you paste, the prices we read from those links, and the time zone your browser reports so the digest arrives at 7:00.",
          "We do not ask for a name, a phone number, a card number or any data about your customers. Paddle handles the card details.",
          "We count page views on this site with Cloudflare Web Analytics, which sets no cookies and collects no personal data.",
        ],
      },
      {
        heading: "Sub-processors",
        paragraphs: [
          "Cloudflare hosts the application and its database. Brevo sends the sign-in and digest emails. Paddle handles payments and invoices. Google is used only when you choose Google sign-in.",
          "These four are the only sub-processors. We do not sell data and we do not use it for advertising.",
        ],
      },
      {
        heading: "Keeping and deleting data",
        paragraphs: [
          `Price history stays while your account is open so the CSV export and the digest can use it. Write to ${CONTACT_EMAIL} to delete your account and all of its links and price points.`,
        ],
      },
    ],
  },
  refunds: {
    slug: "refunds",
    title: "Refund policy",
    description: `How to get your money back within ${REFUND_DAYS} days of a ${SITE_NAME} charge.`,
    sections: [
      {
        heading: `${REFUND_DAYS}-day refunds`,
        paragraphs: [
          `If ${SITE_NAME} is not useful to you, write to ${CONTACT_EMAIL} within ${REFUND_DAYS} days of a charge and we refund it in full. You do not have to explain why.`,
        ],
      },
      {
        heading: "How the refund is paid",
        paragraphs: [
          `Paddle is the merchant of record, so Paddle sends the refund back to the card or payment method you used. It usually arrives within a few business days.`,
        ],
      },
      {
        heading: "After the refund window",
        paragraphs: [
          "Cancel the plan at any time from the billing page to stop the next charge. A charge older than 14 days is not refunded automatically, but you can still write to us and we will look at it.",
        ],
      },
    ],
  },
};

export const LEGAL_SELLER_LINE = `${SITE_NAME} is a product of ${SELLER_LEGAL_NAME}. Contact: ${CONTACT_EMAIL}.`;
