import { DISPOSABLE_DOMAINS_TEXT } from "./disposable-domains";

const DISPOSABLE_DOMAINS = new Set(DISPOSABLE_DOMAINS_TEXT.split("\n").filter(Boolean));

// A subdomain of a listed domain (x.mailinator.com) counts too.
export function isDisposableEmail(email: string) {
  const domain = email.split("@").at(-1) ?? "";
  const labels = domain.split(".");

  return labels.some((_, index) => {
    return DISPOSABLE_DOMAINS.has(labels.slice(index).join("."));
  });
}
