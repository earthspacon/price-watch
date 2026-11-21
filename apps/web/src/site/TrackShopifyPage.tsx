const MANUAL_STEPS = [
  "Open each competitor's product page in a separate tab.",
  "Write today's price where you can compare it with yesterday's.",
  "Do it again tomorrow, and hope you did not miss a sale that lasted a few hours.",
];

const SPREADSHEET_STEPS = [
  "Keep one row per product and one column per day.",
  "Copy the price into the new column every morning.",
  "Watch the sheet grow, and still miss a change when you skip a day.",
];

const TRACKED_STEPS = [
  "Paste the product links once.",
  "PriceDawn checks each link every day through the store's public product data.",
  "At 7:00 you get one email with the store, the old price, the new price and the size of the change.",
];

export const TrackShopifyPage = () => {
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-14 lg:px-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How to track Shopify competitor prices</h1>
        <p className="text-slate-600">
          You sell on Shopify and you want to know when a competitor changes a price. There are three ways to do it, and
          they take very different amounts of your morning.
        </p>
      </div>
      <Method
        title="The manual way"
        steps={MANUAL_STEPS}
        note="Free, and the first thing everyone tries. It works until you have more than a handful of products, or until a busy week makes you skip a day."
      />
      <Method
        title="The spreadsheet way"
        steps={SPREADSHEET_STEPS}
        note="A little more organised, but someone still has to open every page and type every number. The history is only as good as your memory of it."
      />
      <Method
        title="The tracked way with PriceDawn"
        steps={TRACKED_STEPS}
        note="You paste a link once. From then on the check runs without you, the price history is kept, and the morning email tells you what changed. Quiet days send no email."
      />
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold">What you still do by hand</h2>
        <p className="text-sm text-slate-700">
          You decide what to do about a price change. PriceDawn does not change your prices or promise to match a
          competitor; it tells you what happened so you can choose.
        </p>
      </section>
      <p className="text-sm text-slate-600">
        Ready to stop checking tabs?{" "}
        <a href="/pricing" className="font-medium text-brand-700 hover:underline">
          See the plans
        </a>{" "}
        or{" "}
        <a href="/sign-in" className="font-medium text-brand-700 hover:underline">
          start with your email
        </a>
        .
      </p>
    </article>
  );
};

const Method = ({ title, steps, note }: { title: string; steps: readonly string[]; note: string }) => {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ol className="list-decimal space-y-1 pl-5 text-slate-700">
        {steps.map((step) => {
          return <li key={step}>{step}</li>;
        })}
      </ol>
      <p className="text-sm text-slate-600">{note}</p>
    </section>
  );
};
