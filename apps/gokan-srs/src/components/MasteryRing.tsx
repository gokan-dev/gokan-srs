import { THEME } from "../commons/theme";
import { calculateMasteryLoops } from "../utils/srs.utils";

interface MasteryRingProps {
    memoryStrength: number; // SRS Memory Strength
    size?: number;
    showText?: boolean;
    variant?: 'default' | 'reading' | 'meaning' | 'production';
}

export const MasteryRing: React.FC<MasteryRingProps> = ({ memoryStrength, size = 30, showText = true, variant = 'default' }) => {
    const { p1, p2 } = calculateMasteryLoops(memoryStrength);

    // Stroke width relative to size
    const strokeWidth = Math.max(1.5, size / 16);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Offsets
    const offset1 = circumference - (p1 / 100) * circumference;
    const offset2 = circumference - (p2 / 100) * circumference;

    // Text Visibility logic
    const shouldShowText = showText && size >= 30;
    // Increased font size matching body weight
    const fontSize = size * 0.35;

    // Percentage text to show
    const displayPercentage = Math.round(p1);

    // Color Logic
    let loop1Color: string = THEME.mastery.loop1;
    let loop2Color: string = THEME.mastery.reading.loop1; // Default fallback for loop2 now solid

    // We simplified THEME.mastery colors. Now we just use the solid loop1 color.
    if (variant === 'reading') {
        loop1Color = THEME.mastery.reading.loop1;
        loop2Color = THEME.mastery.reading.loop1;
    } else if (variant === 'meaning') {
        loop1Color = THEME.mastery.meaning.loop1;
        loop2Color = THEME.mastery.meaning.loop1;
    } else if (variant === 'production') {
        loop1Color = THEME.mastery.production.loop1;
        loop2Color = THEME.mastery.production.loop1;
    }

    return (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg
                className="w-full h-full"
                style={{ transform: 'rotate(-90deg) translateZ(0)' }}
                viewBox={`0 0 ${size} ${size}`}
            >
                {/* Background Track */}
                <circle
                    className="text-divider"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    shapeRendering="geometricPrecision"
                />

                {/* Loop 1 (Learning Progress) */}
                <circle
                    className="transition-all duration-700 ease-out"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset1}
                    strokeLinecap="round"
                    stroke={p2 > 0 ? THEME.mastery.track : loop1Color}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    shapeRendering="geometricPrecision"
                />

                {/* Loop 2 (Refining / Diamond / Shiny) */}
                {p2 > 0 && (
                    <circle
                        className="transition-all duration-700 ease-out"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset2}
                        strokeLinecap="round"
                        stroke={loop2Color}
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                        shapeRendering="geometricPrecision"
                    />
                )}
            </svg>

            {shouldShowText && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="font-bold leading-none text-slate-600 select-none"
                        style={{ fontSize: fontSize }}
                    >
                        {displayPercentage}
                    </span>
                </div>
            )}
        </div>
    );
};