import { FAQ_ITEMS } from "./faq";

export const HERO_TEXT =
  "Wake up to your competitors' price changes: a daily email for Shopify store owners who check rival prices by hand.";
export const EXAMPLE_DIGEST_LINE = "Linen Shirt — Blue / M: 24.99 → 19.99 (-5.00, -20.0%)";

const MANUAL_TABS = [
  { host: "rival.example", product: "Linen Shirt — Blue / M", price: "24.99" },
  { host: "northwind.example", product: "Canvas Tote — Natural", price: "39.00" },
  { host: "paper-and-co.example", product: "Wool Scarf — Grey", price: "18.50" },
  { host: "trails.example", product: "Leather Belt — Brown / 34", price: "42.00" },
];

const STEPS = [
  "Paste the product links you want to follow.",
  "We check each link once a day through the store's public product data.",
  "At 7:00 in your time zone you get one email with who changed price and by how much.",
];

export const LandingPage = () => {
  return (
    <>
      <Hero />
      <BeforeAfter />
      <HowItWorks />
      <Faq />
      <ClosingCall />
    </>
  );
};

const Hero = () => {
  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 pb-12 pt-16 text-center lg:px-8 lg:pt-24">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{HERO_TEXT}</h1>
      <p className="text-lg text-slate-600">
        One email before your day starts. No dashboards, no spreadsheets, no checking four tabs by hand.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/sign-in"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Start tracking prices
        </a>
        <a
          href="/pricing"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700"
        >
          See pricing
        </a>
      </div>
    </section>
  );
};

const BeforeAfter = () => {
  return (
    <section className="bg-slate-50 py-14">
      <div className="mx-auto max-w-5xl space-y-8 px-4 lg:px-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Before and after</h2>
          <p className="text-slate-600">Same four products. One is a hand check, the other is the morning email.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-surface p-6 shadow-sm">
            <h3 className="font-semibold">By hand: four tabs, every morning</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {MANUAL_TABS.map((tab) => {
                return (
                  <li key={tab.host} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                    <span>{`${tab.product} at ${tab.host}`}</span>
                    <span className="font-mono text-slate-500">{tab.price}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-500">
              You open each tab, read the price and try to remember yesterday's number.
            </p>
          </div>
          <div className="space-y-3 rounded-xl border border-brand-100 bg-surface p-6 shadow-sm">
            <h3 className="font-semibold">PriceDawn: one email at 7:00</h3>
            <div className="space-y-1 rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-700">
              <p>rival.example</p>
              <p>{EXAMPLE_DIGEST_LINE}</p>
              <p className="break-all text-slate-500">https://rival.example/products/linen-shirt?variant=1001</p>
            </div>
            <p className="text-xs text-slate-500">
              The same example digest that lands in your inbox, with the store, the change and the link.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  return (
    <section className="mx-auto max-w-5xl space-y-8 px-4 py-14 lg:px-8">
      <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => {
          return (
            <li key={step} className="space-y-2 rounded-xl border border-slate-200 bg-surface p-6 shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-ink">
                {index + 1}
              </span>
              <p className="text-sm text-slate-700">{step}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const Faq = () => {
  return (
    <section className="bg-slate-50 py-14">
      <div className="mx-auto max-w-3xl space-y-6 px-4 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => {
            return (
              <details key={item.question} className="rounded-xl border border-slate-200 bg-surface p-4">
                <summary className="cursor-pointer font-medium">{item.question}</summary>
                <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const ClosingCall = () => {
  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center lg:px-8">
      <h2 className="text-2xl font-semibold tracking-tight">Know about the change before your customers do</h2>
      <p className="text-slate-600">Plans start at $9 a month, and every plan checks each link once a day.</p>
      <a
        href="/pricing"
        className="inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Compare the plans
      </a>
    </section>
  );
};
