import { LEGAL_DOCUMENTS, LEGAL_SELLER_LINE, type LegalSlug } from "./legal";

export const LegalPage = ({ slug }: { slug: LegalSlug }) => {
  const document = LEGAL_DOCUMENTS[slug];

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{document.title}</h1>
        <p className="text-slate-600">{document.description}</p>
      </div>
      {document.sections.map((section) => {
        return (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => {
              return (
                <p key={paragraph} className="leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              );
            })}
          </section>
        );
      })}
      <p className="border-t border-slate-200 pt-6 text-sm text-slate-600">{LEGAL_SELLER_LINE}</p>
    </article>
  );
};
