import { fetchJson } from '../http';

/** The Google account details shown in the header, from the OAuth userinfo endpoint. */
export interface GoogleProfile {
    name?: string;
    email?: string;
    picture?: string;
}

/** The signed-in account's profile, or an empty profile if it cannot be read (the app works without it). */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    try {
        const data = await fetchJson<GoogleProfile>('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return { name: data.name, email: data.email, picture: data.picture };
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        return {};
    }
}
