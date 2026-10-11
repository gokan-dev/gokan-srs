import { THEME } from "../commons/theme";
import { calculateMasteryLoops } from "../utils/srs.utils";

interface MasteryRingProps {
    memoryStrength: number; // SRS Memory Strength
    size?: number;
    showText?: boolean;
    variant?: 'default' | 'reading' | 'meaning' | 'production';
    /** What the ring measures ("Reading", "Mastery"), read out with its value: "Reading 72%". */
    label?: string;
}

/**
 * A direction's mastery. The number and the outer arc always show the same
 * quantity, loop 1 (learning). Once loop 1 is complete the outer ring is drawn
 * full, and loop 2 (refining) is a thinner concentric inner arc, with its own
 * value in the tooltip, never in the number.
 */
export const MasteryRing: React.FC<MasteryRingProps> = ({ memoryStrength, size = 30, showText = true, variant = 'default', label }) => {
    const { p1, p2 } = calculateMasteryLoops(memoryStrength);

    const strokeWidth = Math.max(1.5, size / 16);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset1 = circumference - (p1 / 100) * circumference;

    // The refining arc sits inside the outer ring, thinner, with a small gap.
    const innerStroke = Math.max(1, strokeWidth * 0.6);
    const innerRadius = radius - strokeWidth / 2 - innerStroke / 2 - Math.max(1, size / 30);
    const innerCircumference = 2 * Math.PI * innerRadius;
    const offset2 = innerCircumference - (p2 / 100) * innerCircumference;

    const shouldShowText = showText && size >= 30;
    const fontSize = size * 0.32;
    const displayPercentage = Math.round(p1);

    // One hue per direction; 'default' is the reading colour. Both loops share it.
    const loopColor: string = THEME.mastery[variant === 'default' ? 'reading' : variant].loop1;
    const refining = p2 > 0 ? `Refining: ${Math.round(p2)}%` : undefined;
    const accessibleName = [label ? `${label} ${displayPercentage}%` : `${displayPercentage}%`, refining].filter(Boolean).join(', ');

    return (
        <div
            className="relative flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
            role="img"
            aria-label={accessibleName}
            title={refining ?? (label ? `${label}: ${displayPercentage}%` : undefined)}
        >
            <svg
                className="w-full h-full"
                style={{ transform: 'rotate(-90deg) translateZ(0)' }}
                viewBox={`0 0 ${size} ${size}`}
                aria-hidden="true"
            >
                <circle
                    style={{ stroke: THEME.mastery.track }}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    shapeRendering="geometricPrecision"
                />

                {/* Loop 1: learning. Full once complete. */}
                {p1 > 0 && (
                    <circle
                        className="transition-all duration-200 ease-in-out"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset1}
                        strokeLinecap={p1 >= 100 ? 'butt' : 'round'}
                        style={{ stroke: loopColor }}
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                        shapeRendering="geometricPrecision"
                    />
                )}

                {/* Loop 2: refining, inside. */}
                {p2 > 0 && innerRadius > 0 && (
                    <circle
                        className="transition-all duration-200 ease-in-out"
                        strokeWidth={innerStroke}
                        strokeDasharray={innerCircumference}
                        strokeDashoffset={offset2}
                        strokeLinecap="round"
                        style={{ stroke: loopColor }}
                        fill="transparent"
                        r={innerRadius}
                        cx={size / 2}
                        cy={size / 2}
                        shapeRendering="geometricPrecision"
                    />
                )}
            </svg>

            {shouldShowText && (
                <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <span
                        className="font-sans font-semibold leading-none text-secondary tabular-nums select-none"
                        style={{ fontSize }}
                    >
                        {displayPercentage}
                    </span>
                </div>
            )}
        </div>
    );
};
