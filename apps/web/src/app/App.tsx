import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import { BillingPage } from "../pages/BillingPage";
import { LinksPage } from "../pages/LinksPage";
import { SignInPage } from "../pages/SignInPage";
import { LandingPage } from "../site/LandingPage";
import { LegalPage } from "../site/LegalPage";
import { NotFoundPage } from "../site/NotFoundPage";
import { PriceCheckerPage } from "../site/PriceCheckerPage";
import { PricingPage } from "../site/PricingPage";
import { PrisyncAlternativePage } from "../site/PrisyncAlternativePage";
import { SiteLayout } from "../site/SiteLayout";
import { TrackShopifyPage } from "../site/TrackShopifyPage";
import { AppShell, RequireSession } from "./AppShell";
import { ToastView } from "./ToastView";

export const App = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

export const AppRoutes = () => {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/prisync-alternative" element={<PrisyncAlternativePage />} />
          <Route path="/track-shopify-competitor-prices" element={<TrackShopifyPage />} />
          <Route path="/tools/shopify-price-checker" element={<PriceCheckerPage />} />
          <Route path="/terms" element={<LegalPage slug="terms" />} />
          <Route path="/privacy" element={<LegalPage slug="privacy" />} />
          <Route path="/refunds" element={<LegalPage slug="refunds" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/app" element={<RequireSession />}>
          <Route element={<AppShell />}>
            <Route index element={<LinksPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>
        </Route>
      </Routes>
      <ToastView />
    </>
  );
};

const PublicLayout = () => {
  return (
    <SiteLayout>
      <Outlet />
    </SiteLayout>
  );
};
