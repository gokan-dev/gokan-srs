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

    // One hue per direction; 'default' is the reading colour. Both loops share it.
    const loopColor: string = THEME.mastery[variant === 'default' ? 'reading' : variant].loop1;

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
                    style={{ stroke: p2 > 0 ? THEME.mastery.track : loopColor }}
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
                        style={{ stroke: loopColor }}
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
                        className="font-bold leading-none text-subtle select-none"
                        style={{ fontSize: fontSize }}
                    >
                        {displayPercentage}
                    </span>
                </div>
            )}
        </div>
    );
};