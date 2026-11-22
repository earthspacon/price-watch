const SOURCE_LINKS = [
  { label: "prisync.com/pricing", href: "https://prisync.com/pricing" },
  { label: "pricemole.io/pricing", href: "https://pricemole.io/pricing" },
];

const COMPARISON_ROWS = [
  {
    vendor: "PriceDawn",
    plans: "Starter $19/mo, 100 links. Pro $49/mo, 1,000 links.",
    email: "A daily digest at 7:00 in your time zone.",
  },
  {
    vendor: "Prisync",
    plans: "Professional $99/mo for up to 100 products. Premium $199/mo for 1,000. Platinum $399/mo for 5,000.",
    email: "Daily email notifications start on Premium.",
  },
  {
    vendor: "PriceMole",
    plans: "Solo $99/mo for 100 SKUs. Team $199 for 500. Professional $299 for 1,000. Business $499 for 5,000.",
    email: "Alerts are part of the paid plans.",
  },
];

export const PrisyncAlternativePage = () => {
  return (
    <article className="mx-auto max-w-4xl space-y-10 px-4 py-14 lg:px-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          A simpler alternative to Prisync and PriceMole
        </h1>
        <p className="text-slate-600">
          Both tools are built for teams that watch hundreds of products and want dashboards. If you run a small Shopify
          store and only need to know what changed overnight, you can pay a lot less.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Tool
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Plans and prices
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Email
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {COMPARISON_ROWS.map((row) => {
              return (
                <tr key={row.vendor}>
                  <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                    {row.vendor}
                  </th>
                  <td className="px-4 py-3 text-slate-700">{row.plans}</td>
                  <td className="px-4 py-3 text-slate-700">{row.email}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Where the numbers come from</h2>
        <p className="text-sm text-slate-700">
          {`Prices checked November 21, 2026: `}
          {SOURCE_LINKS.map((source, index) => {
            return (
              <span key={source.href}>
                {index > 0 && " and "}
                <a href={source.href} className="font-medium text-brand-ink hover:underline">
                  {source.label}
                </a>
              </span>
            );
          })}
          .
        </p>
        <p className="text-sm text-slate-600">
          Prices change, so check each vendor's page before you decide. PriceDawn does one job: a daily check of the
          Shopify product links you paste, and one morning email with what changed.
        </p>
      </section>
      <p className="rounded-xl border border-brand-100 bg-brand-50 p-5 text-sm text-brand-ink">
        Want the daily email without the enterprise plan?{" "}
        <a href="/pricing" className="font-semibold underline">
          See PriceDawn pricing
        </a>
        .
      </p>
    </article>
  );
};
