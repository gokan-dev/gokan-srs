import { NavLink } from "react-router-dom";

interface TabNavProps {
    tabs: { label: string; to: string }[];
    label: string;
    className?: string;
}

/**
 * Route tabs: each tab is its own page, so they are links, and the active one
 * is the one whose route is showing. Active: ink text and a 2px accent
 * underline, the same language as the header's navigation.
 */
export function TabNav({ tabs, label, className = '' }: TabNavProps) {
    return (
        <nav aria-label={label} className={`flex gap-6 border-b border-divider ${className}`}>
            {tabs.map(tab => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    end
                    className={({ isActive }) => `-mb-px py-2 border-b-2 font-sans text-sm font-medium transition-colors ${
                        isActive ? 'border-accent text-primary' : 'border-transparent text-secondary hover:text-primary'
                    }`}
                >
                    {tab.label}
                </NavLink>
            ))}
        </nav>
    );
}
