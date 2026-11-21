import type { Plan } from "./domain";

export const PLANS: Record<Plan, { name: string; monthlyCents: number; linkLimit: number }> = {
  starter: {
    name: "Starter",
    monthlyCents: 1900,
    linkLimit: 100,
  },
  pro: {
    name: "Pro",
    monthlyCents: 4900,
    linkLimit: 1000,
  },
};
