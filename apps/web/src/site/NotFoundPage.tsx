export const NotFoundPage = () => {
  return (
    <section className="mx-auto max-w-xl space-y-4 px-4 py-24 text-center lg:px-8">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-slate-600">The page you asked for does not exist, or it moved.</p>
      <a
        href="/"
        className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to the home page
      </a>
    </section>
  );
};
