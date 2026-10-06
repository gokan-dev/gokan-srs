
export type LoaderProps = {
    title: string;
    description?: string;
}

export function Loader({ title, description }: LoaderProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background transition-colors duration-200">
            <div className="flex flex-col items-center gap-10">
                {/* Breathing Seal Logo with ripple rings */}
                <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
                    {/* Ripple rings, triggered in sync with the heartbeat */}
                    <div className="absolute inset-0 rounded-full animate-ripple opacity-0" style={{ animationDelay: '0s' }} />
                    <div className="absolute inset-0 rounded-full animate-ripple opacity-0" style={{ animationDelay: '1.5s' }} />

                    {/* Circular seal: thin ring + 語感 inside */}
                    <svg
                        width="120"
                        height="120"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="animate-heartbeat relative z-10"
                    >
                        {/* Thin circle ring, the seal frame */}
                        <circle
                            cx="50"
                            cy="50"
                            r="46"
                            className="stroke-primary animate-color-stroke"
                            strokeWidth="1.2"
                            fill="none"
                        />

                        {/* 語感 side by side, centered inside the circle */}
                        <text
                            x="50"
                            y="50"
                            fontSize="34"
                            fontFamily="'Noto Serif JP', serif"
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="animate-color-breathe"
                            fontWeight="400"
                            letterSpacing="2"
                        >
                            語感
                        </text>
                    </svg>
                </div>

                {/* Loading text */}
                <div className="flex flex-col items-center gap-2">
                    <p className="text-primary font-serif text-lg animate-fade-in">
                        {title}
                    </p>
                    {description && <p className="text-secondary text-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        {description}
                    </p>}
                </div>
            </div>

            <style>{`
                /* Heartbeat: quick thump, then settle */
                @keyframes heartbeat {
                    0% {
                        transform: scale(1);
                    }
                    8% {
                        transform: scale(1.11);
                    }
                    22% {
                        transform: scale(1.0);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                /* Text color pulse, brightens at the beat */
                @keyframes color-breathe {
                    0%, 100% {
                        fill: var(--color-primary);
                        opacity: 0.85;
                    }
                    8% {
                        fill: var(--color-accent);
                        opacity: 1;
                    }
                    30% {
                        fill: var(--color-primary);
                        opacity: 0.9;
                    }
                }

                /* Circle stroke pulse, matches the text */
                @keyframes color-stroke {
                    0%, 100% {
                        stroke-opacity: 0.45;
                    }
                    8% {
                        stroke-opacity: 0.85;
                    }
                    30% {
                        stroke-opacity: 0.5;
                    }
                }

                /* Ripple: quick surge then dissolve */
                @keyframes ripple {
                    0% {
                        transform: scale(0.5);
                        opacity: 0.45;
                    }
                    70% {
                        opacity: 0.06;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 0;
                    }
                }

                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-heartbeat {
                    animation: heartbeat 3s ease-out infinite;
                    transform-origin: center;
                }

                .animate-color-breathe {
                    animation: color-breathe 3s ease-out infinite;
                    fill: var(--color-primary);
                }

                .animate-color-stroke {
                    animation: color-stroke 3s ease-out infinite;
                }

                /* Same 3s cycle, locked to the heartbeat */
                .animate-ripple {
                    animation: ripple 3s ease-out infinite;
                    color: var(--color-primary);
                    border: 1px solid currentColor;
                }

                .animate-fade-in {
                    animation: fade-in 0.6s ease-out forwards;
                    opacity: 0;
                }
            `}</style>
        </div>
    );
}
