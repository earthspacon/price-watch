import {
  formatCents,
  PRICE_CHECKER_RUNS_PER_DAY,
  type PriceCheckDto,
  type PriceCheckVariantDto,
} from "@price-watch/contract";
import { useUnit } from "effector-react";
import type { FormEvent } from "react";

import { TurnstileWidget } from "../shared/TurnstileWidget";
import { Banner, BUTTON_PRIMARY, Card, INPUT } from "../shared/ui";
import {
  $checkError,
  $result,
  $turnstileRound,
  $turnstileToken,
  $url,
  checkPriceFx,
  checkSubmitted,
  turnstileExpired,
  turnstileSolved,
  urlChanged,
} from "../tools/price-checker-model";

export const PRICE_CHECKER_TITLE = "See the current price of any Shopify product";

const URL_PLACEHOLDER = "https://store.com/products/linen-shirt";
const ONLY_OPTION_LABEL = "Only option";
const NO_COMPARE_AT = "None";

const STEPS = [
  "Paste the link of a product page from any Shopify store.",
  "We read the store's public product data, the same data its own product page uses.",
  'You see every variant with its current price and its compare-at price, the crossed-out "was" price, if the store set one.',
];

const QUESTIONS = [
  {
    question: "Do I need an account?",
    answer: `No sign-up. You can run ${PRICE_CHECKER_RUNS_PER_DAY} checks a day from one internet connection, counted by IP address.`,
  },
  {
    question: "What if the store blocks the request?",
    answer:
      "The result says blocked and shows no price. We never guess a price, here or in the daily email. Try again later: most blocks are short.",
  },
  {
    question: "What do you keep?",
    answer:
      "Not the link and not the prices. To hold the daily limit we keep a count per IP address, stored as a one-way code, and delete it after a day.",
  },
  {
    question: "Which stores work?",
    answer: "Shopify stores only. A link from another kind of store says no product data was found.",
  },
];

export const PriceCheckerPage = () => {
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-14 lg:px-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{PRICE_CHECKER_TITLE}</h1>
        <p className="text-slate-600">
          Paste a product link and see each variant&apos;s current price and compare-at price, straight from the
          store&apos;s public product data. Free, no sign-up, {PRICE_CHECKER_RUNS_PER_DAY} checks a day.
        </p>
      </div>
      <CheckForm />
      <CheckResult />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          {STEPS.map((step) => {
            return <li key={step}>{step}</li>;
          })}
        </ol>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Questions</h2>
        <dl className="space-y-4">
          {QUESTIONS.map((item) => {
            return (
              <div key={item.question}>
                <dt className="font-medium">{item.question}</dt>
                <dd className="text-sm text-slate-600">{item.answer}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      <DailyEmailCall />
    </article>
  );
};

const CheckForm = () => {
  const { error, isChecking, round, token, url } = useUnit({
    error: $checkError,
    isChecking: checkPriceFx.pending,
    round: $turnstileRound,
    token: $turnstileToken,
    url: $url,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    checkSubmitted();
  };

  return (
    <Card className="space-y-3 p-6">
      {error && <Banner tone="danger">{error}</Banner>}
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Product link</span>
          <input
            required
            type="url"
            inputMode="url"
            placeholder={URL_PLACEHOLDER}
            value={url}
            onChange={(event) => urlChanged(event.target.value)}
            className={INPUT}
          />
        </label>
        <TurnstileWidget key={round} onSolved={turnstileSolved} onExpired={turnstileExpired} />
        <button type="submit" disabled={isChecking || !token} className={`${BUTTON_PRIMARY} w-full sm:w-auto`}>
          {isChecking ? "Checking…" : "Check the price"}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        {PRICE_CHECKER_RUNS_PER_DAY} checks a day per internet connection. Shopify stores only.
      </p>
    </Card>
  );
};

const CheckResult = () => {
  const { result } = useUnit({
    result: $result,
  });

  if (!result) {
    return null;
  }
  if (result.status === "ok") {
    return <ProductPrices result={result} />;
  }
  if (result.status === "blocked") {
    return (
      <Banner tone="warning">
        Blocked: {result.storeHost} refused the request or didn&apos;t answer in time, so there is no price to show. We
        never guess a price.
      </Banner>
    );
  }
  return (
    <Banner tone="info">
      No product data found at this link on {result.storeHost}. Check that it is a product page on a Shopify store.
    </Banner>
  );
};

const ProductPrices = ({ result }: { result: Extract<PriceCheckDto, { status: "ok" }> }) => {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-xl font-semibold">{result.title}</h2>
        <p className="text-sm text-slate-500">{result.storeHost}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2 pr-4 font-medium">Variant</th>
            <th className="py-2 pr-4 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Compare-at price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {result.variants.map((variant) => {
            return <VariantRow key={variant.id} variant={variant} />;
          })}
        </tbody>
      </table>
    </Card>
  );
};

const VariantRow = ({ variant }: { variant: PriceCheckVariantDto }) => {
  const compareAt = variant.compareAtCents === null ? NO_COMPARE_AT : formatCents({ cents: variant.compareAtCents });

  return (
    <tr>
      <td className="py-2 pr-4">{variant.title ?? ONLY_OPTION_LABEL}</td>
      <td className="py-2 pr-4 text-right font-medium tabular-nums">{formatCents({ cents: variant.priceCents })}</td>
      <td className="py-2 text-right tabular-nums text-slate-500">{compareAt}</td>
    </tr>
  );
};

const DailyEmailCall = () => {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-xl font-semibold">Get an email when it changes</h2>
      <p className="text-sm text-slate-700">
        PriceDawn checks your competitors&apos; product links every day and sends one email at 7:00 with every price
        that moved. Quiet days send nothing.
      </p>
      <a href="/pricing" className={BUTTON_PRIMARY}>
        See the plans
      </a>
    </section>
  );
};
