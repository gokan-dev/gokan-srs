/** One pitch pattern in words, for screen readers: "heiban", "drop after mora 2". */
export function downstepLabel(downstep: number): string {
    return downstep === 0 ? 'heiban' : `drop after mora ${downstep}`;
}

/** A reading's patterns in words, most usual first: "Pitch accent: drop after mora 4, or drop after mora 3". */
export function pitchAccentLabel(downsteps: number[]): string {
    return `Pitch accent: ${downsteps.map(downstepLabel).join(', or ')}`;
}
