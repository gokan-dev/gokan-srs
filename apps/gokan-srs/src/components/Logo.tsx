import React from "react";
import { useResponsive } from "../context/Responsive/useResponsive";

export const LogoMark: React.FC<{ size?: number }> = ({ size = 48 }) => (
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

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { isMobile } = useResponsive()

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <LogoMark size={isMobile ? 24 : 48} />
            <span className="md:text-2xl tracking-wide font-serif text-primary">
                Gokan SRS
            </span>
        </div>
    )
};
