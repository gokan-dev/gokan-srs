import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * The one Back. It pops history when the previous entry is inside this app,
 * and only falls back to `parentPath` for a page opened directly, so Back never
 * lands somewhere the learner did not come from.
 */
export function BackLink({ parentPath }: { parentPath: string }) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleBack = () => {
        if (location.key !== 'default') void navigate(-1);
        else void navigate(parentPath);
    };

    return (
        <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1 font-sans text-sm text-accent hover:text-accent-hover mb-2 cursor-pointer"
        >
            <ArrowLeft size={14} aria-hidden="true" />
            Back
        </button>
    );
}
