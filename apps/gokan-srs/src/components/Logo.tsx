import React from "react";
import { useResponsive } from "../context/Responsive/useResponsive";

const LogoMark: React.FC<{ size?: number }> = ({ size = 48 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Gokan SRS Logo"
    >
        <title>Gokan SRS - Japanese Vocabulary Learning</title>
        {/* Thin circle ring, same seal as the loader */}
        <circle cx="50" cy="50" r="46" className="stroke-primary" strokeWidth="3" fill="none" />
        <text
            x="50"
            y="50"
            fontSize="34"
            fontFamily="'Noto Serif JP', serif"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-primary"
            fontWeight="400"
            letterSpacing="2"
        >
            語感
        </text>
    </svg>
);

/**
 * The mark and the name. `compact` is the app header's version (a smaller mark,
 * and just "Gokan" on a phone, where the header also holds search); onboarding
 * shows the full size.
 */
export const Logo: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => {
    const { isMobile } = useResponsive();
    const markSize = compact ? (isMobile ? 28 : 32) : (isMobile ? 32 : 48);

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <LogoMark size={markSize} />
            <span className={`font-serif text-primary ${compact ? 'text-lg' : 'text-xl md:text-2xl'}`}>
                {compact && isMobile ? 'Gokan' : 'Gokan SRS'}
            </span>
        </div>
    );
};
