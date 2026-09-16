import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { LocaleProvider } from "./i18n/locale";
import { MeasureProvider } from "./i18n/measure";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocaleProvider>
          <MeasureProvider>
            <App />
          </MeasureProvider>
        </LocaleProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
