import { isDev, type Env } from "./env";

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  send: (mail: OutboundMail) => Promise<void>;
};

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const NAME_AND_ADDRESS = /^(.*)<([^>]+)>\s*$/;
const URL_IN_TEXT = /https?:\/\/[^\s<]+/g;
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function createMailer(env: Env): Mailer {
  if (env.BREVO_API_KEY) {
    return createBrevoMailer({
      apiKey: env.BREVO_API_KEY,
      from: env.MAIL_FROM,
    });
  }
  if (isDev(env)) {
    return createLogMailer({ db: env.DB });
  }
  throw new Error("BREVO_API_KEY is not set");
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

export function createBrevoMailer({ apiKey, from }: { apiKey: string; from: string }): Mailer {
  const sender = parseSender(from);

  return {
    send: async ({ to, subject, text }) => {
      const response = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: buildHtmlFromText(text),
        }),
      });

      if (!response.ok) {
        throw new Error(`Brevo returned ${response.status}`);
      }
    },
  };
}

// "Name <address>" in MAIL_FROM becomes Brevo's { name, email } sender.
function parseSender(from: string) {
  const match = NAME_AND_ADDRESS.exec(from);
  if (!match) {
    return { email: from.trim() };
  }
  return {
    name: match[1].trim(),
    email: match[2].trim(),
  };
}

// Brevo needs an HTML body, so plain-text mails get an escaped copy with clickable links.
function buildHtmlFromText(text: string) {
  const escaped = text.replace(/[&<>"]/g, (char) => {
    return HTML_ESCAPES[char];
  });
  const linked = escaped.replace(URL_IN_TEXT, (url) => {
    return `<a href="${url}">${url}</a>`;
  });
  return `<p>${linked.replaceAll("\n", "<br>")}</p>`;
}
