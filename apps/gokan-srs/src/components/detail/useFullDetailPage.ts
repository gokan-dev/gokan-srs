import { useResponsive } from "../../context/Responsive/useResponsive";

/**
 * Whether a detail page is one full page (from Tailwind's `lg`, 1024px, where DetailBody's 8/4
 * grid starts) rather than tabs (below it, tablets included): the one switch every tabbed detail
 * page reads, for its body (`DetailBody` `full`) and its frame's width alike.
 */
export function useFullDetailPage(): boolean {
    const { isMobile, isTablet } = useResponsive();
    return !isMobile && !isTablet;
}
