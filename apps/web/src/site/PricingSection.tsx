import { formatPrice, PLANS, type Plan } from "@price-watch/contract";

const PLAN_ORDER: Plan[] = ["starter", "pro"];
const PLAN_PERKS = [
  "Every link checked once a day",
  "One email at 7:00 with what changed",
  "CSV export of the price history",
];

export const PricingSection = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PLAN_ORDER.map((plan) => {
        return <PlanCard key={plan} plan={plan} />;
      })}
    </div>
  );
};

const PlanCard = ({ plan }: { plan: Plan }) => {
  const { name, monthlyCents, linkLimit } = PLANS[plan];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-surface p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">{name}</h2>
        <p className="text-3xl font-semibold tracking-tight">{`${formatPrice(monthlyCents)}/mo`}</p>
        <p className="text-sm text-slate-500">Up to {linkLimit.toLocaleString("en-US")} links</p>
      </div>
      <ul className="space-y-1 text-sm text-slate-600">
        {PLAN_PERKS.map((perk) => {
          return <li key={perk}>{perk}</li>;
        })}
      </ul>
      <a
        href="/sign-in"
        className="mt-auto inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {`Start with ${name}`}
      </a>
    </section>
  );
};
