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
import { installChunkLoadGuard } from "./services/chunkLoadGuard";

// Before the first lazy page loads, so a tab left open across a deploy recovers on its own.
installChunkLoadGuard();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
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
