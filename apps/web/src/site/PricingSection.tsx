import { PlanCard } from "../pricing/PlanCard";

export const PricingSection = () => {
  return (
    <PlanCard
      action={
        <a
          href="/sign-in"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Start tracking
        </a>
      }
    />
  );
};
