import React from "react";
import { Link } from "react-router-dom";

/**
 * A status card (waiting, session complete, caught up) filling the area under
 * the header, not the whole screen, so these screens never scroll.
 */
export const CenteredCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex-1 w-full flex items-center justify-center py-8">
        <div className="border rounded-md p-8 max-w-md w-full text-center bg-surface border-divider">
            {children}
        </div>
    </div>
);

/** The way back from a status card to the Study hub. */
export const BackToStudyLink: React.FC = () => (
    <Link to="/" className="font-sans text-sm text-accent hover:underline">
        Back to Study
    </Link>
);
