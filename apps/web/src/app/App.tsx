import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LinksPage } from "../pages/LinksPage";
import { SignInPage } from "../pages/SignInPage";
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
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/app" element={<RequireSession />}>
          <Route element={<AppShell />}>
            <Route index element={<LinksPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      <ToastView />
    </>
  );
};
