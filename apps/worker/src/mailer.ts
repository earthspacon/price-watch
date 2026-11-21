import { isDev, type Env } from "./env";

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  send: (mail: OutboundMail) => Promise<void>;
};

const RESEND_URL = "https://api.resend.com/emails";

export function createMailer(env: Env): Mailer {
  if (env.RESEND_API_KEY) {
    return createResendMailer({
      apiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
    });
  }
  if (isDev(env)) {
    return createLogMailer({ db: env.DB });
  }
  throw new Error("RESEND_API_KEY is not set");
}

export function createLogMailer({ db }: { db: D1Database }): Mailer {
  return {
    send: async ({ to, subject, text }) => {
      await db
        .prepare("INSERT INTO dev_outbox (to_address, subject, body, created_at) VALUES (?, ?, ?, ?)")
        .bind(to, subject, text, new Date().toISOString())
        .run();
    },
  };
}

export function createResendMailer({ apiKey, from }: { apiKey: string; from: string }): Mailer {
  return {
    send: async ({ to, subject, text }) => {
      const response = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend returned ${response.status}`);
      }
    },
  };
}
