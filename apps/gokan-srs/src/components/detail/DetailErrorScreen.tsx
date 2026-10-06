import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";

/** A detail page whose item could not be loaded. */
export function DetailErrorScreen({ message }: { message: string }) {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex items-center justify-center p-4 text-center">
            <div>
                <h2 className="text-xl font-bold text-error mb-2">Error</h2>
                <p className="text-secondary mb-4">{message}</p>
                <Button onClick={() => void navigate(-1)}>Go Back</Button>
            </div>
        </div>
    );
}
