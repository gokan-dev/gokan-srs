import { Chip } from "./ui/Chip";

interface JlptChipProps {
    level: number;
}

export function JlptChip({ level }: JlptChipProps) {
    return <Chip>N{level}</Chip>;
}
