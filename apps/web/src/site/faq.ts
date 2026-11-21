export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "What counts as a link?",
    answer:
      "A link is one product variant in a competitor's Shopify store. If a shirt comes in three sizes, each size is its own link and its own price check.",
  },
  {
    question: "Does PriceDawn work with stores that are not on Shopify?",
    answer: "No. PriceDawn reads Shopify's public product data, so only Shopify stores are supported in this version.",
  },
  {
    question: "What happens when a store blocks our checks?",
    answer:
      "The link is marked as blocked and shown in your list and in the digest. PriceDawn never invents a price when a store refuses the request.",
  },
  {
    question: "Can I get a refund?",
    answer: "Yes. Write to us within 14 days of a charge and we refund it through Paddle, no questions asked.",
  },
];
