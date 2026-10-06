import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QuizProvider } from "./context/quiz/QuizProvider"
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleDriveProvider } from "./context/GoogleDriveContext";
import { ThemeProvider } from "./context/ThemeContext";
import { App } from './App';
import { ResponsiveProvider } from "./context/Responsive/ResponsiveProvider";
import { BrowserRouter } from "react-router-dom";


// Import Google Fonts
export const FONT_IMPORTS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Sawarabi+Gothic&display=swap');
`;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <style>{FONT_IMPORTS}</style>
        <ThemeProvider defaultTheme="system">
            <GoogleOAuthProvider
                clientId="1088130501377-pe580cj85dt179hltgba6v153m12esmh.apps.googleusercontent.com"
                onScriptLoadError={() => console.error("[GoogleOAuth] Script failed to load")}
            >
                <GoogleDriveProvider>
                    <BrowserRouter>
                        <ResponsiveProvider>
                            <QuizProvider>
                                <App />
                            </QuizProvider>
                        </ResponsiveProvider>
                    </BrowserRouter>
                </GoogleDriveProvider>
            </GoogleOAuthProvider>
        </ThemeProvider>
    </StrictMode>
);
