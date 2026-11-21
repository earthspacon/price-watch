import { PricingSection } from "./PricingSection";

export const PricingPage = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-14 lg:px-8">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing for a daily price check</h1>
        <p className="text-slate-600">
          Every plan checks each link once a day and sends one email at 7:00 in your time zone. A link is one product
          variant, so a shirt in three sizes counts as three links.
        </p>
      </div>
      <PricingSection />
      <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Paid through Paddle</h2>
          <p>
            Checkout, invoices, cards and sales tax run through Paddle, the merchant of record. You can switch plans or
            cancel from the billing page at any time.
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">14-day refunds</h2>
          <p>
            If the digest does not save you time, write to us within 14 days of a charge and we refund it in full
            through Paddle.
          </p>
        </div>
      </div>
      <p className="text-center text-sm text-slate-600">
        Questions before you pay? Read the{" "}
        <a href="/track-shopify-competitor-prices" className="font-medium text-brand-700 hover:underline">
          guide
        </a>{" "}
        or{" "}
        <a href="/sign-in" className="font-medium text-brand-700 hover:underline">
          start with an email sign-in
        </a>
        .
      </p>
    </div>
  );
};
