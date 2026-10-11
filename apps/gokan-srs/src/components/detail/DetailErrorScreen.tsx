import { Page } from "../Page";
import { BackLink } from "../BackLink";

/** A detail page whose item could not be loaded. */
export function DetailErrorScreen({ message }: { message: string }) {
    return (
        <Page width="narrow">
            <BackLink parentPath="/" />
            <h1 className="type-page-title">Not available</h1>
            <p className="type-support mt-2">{message}</p>
        </Page>
    );
}
