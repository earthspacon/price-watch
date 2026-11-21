import type { Env } from "./env";
import { createMailer, type Mailer } from "./mailer";

export type Deps = {
  env: Env;
  db: D1Database;
  mailer: Mailer;
  now: () => Date;
  schedule: (task: Promise<unknown>) => void;
};

export function createDeps({ env, ctx }: { env: Env; ctx: ExecutionContext }): Deps {
  return {
    env,
    db: env.DB,
    mailer: createMailer(env),
    now: () => new Date(),
    schedule: (task) => {
      ctx.waitUntil(task);
    },
  };
}
