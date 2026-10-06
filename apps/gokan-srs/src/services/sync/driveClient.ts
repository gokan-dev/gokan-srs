import { readJson } from '../http';
import { GoogleAuthError } from './types';

export interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}

/** The subset of a Drive `files.list` response this client reads. */
interface DriveFileList {
    files?: DriveFile[];
}

/**
 * Thin wrapper around the Google Drive v3 REST API. No merge/business logic
 * lives here - just HTTP calls and auth-error translation, so mergeProgress.ts
 * and GoogleDriveSync can both be tested without a network.
 */
export class DriveClient {
    private readonly accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    private authHeader(): { Authorization: string } {
        return { Authorization: `Bearer ${this.accessToken}` };
    }

    private checkOk(response: Response, action: string): void {
        if (response.ok) return;
        if (response.status === 401 || response.status === 403) {
            throw new GoogleAuthError('Authentication failed or token expired', response.status);
        }
        throw new Error(`Failed to ${action}: ${response.status}`);
    }

    async findFolder(name: string): Promise<string | null> {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            { headers: this.authHeader() }
        );
        this.checkOk(response, 'list folders');
        const { files } = await readJson<DriveFileList>(response);
        return files?.[0]?.id ?? null;
    }

    async createFolder(name: string): Promise<string> {
        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { ...this.authHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
        });
        this.checkOk(response, 'create folder');
        const { id } = await readJson<{ id: string }>(response);
        return id;
    }

    /** Returns ALL non-trashed files matching the name (may be >1 on a duplicate-file split-brain). */
    async listFilesByName(folderId: string, name: string): Promise<DriveFile[]> {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(name)}' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime)`,
            { headers: this.authHeader() }
        );
        this.checkOk(response, 'list files');
        const { files } = await readJson<DriveFileList>(response);
        return files ?? [];
    }

    async getFileMetadata(fileId: string): Promise<{ modifiedTime: string }> {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
            { headers: this.authHeader() }
        );
        this.checkOk(response, 'fetch file metadata');
        return readJson<{ modifiedTime: string }>(response);
    }

    /** The file's parsed JSON. Its shape is the caller's to check: it is whatever any build of the app last wrote. */
    async downloadFileContent(fileId: string): Promise<unknown> {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: this.authHeader() }
        );
        this.checkOk(response, 'fetch file content');
        return readJson<unknown>(response);
    }

    async uploadNewFile(folderId: string, name: string, content: unknown): Promise<string> {
        const metadata = { name, mimeType: 'application/json', parents: [folderId] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: this.authHeader(),
            body: form,
        });
        this.checkOk(response, 'upload new file');
        const result = await readJson<{ id: string }>(response);
        return result.id;
    }

    async updateFile(fileId: string, content: unknown): Promise<void> {
        const metadata = { name: undefined }; // no rename
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }));

        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: this.authHeader(),
            body: form,
        });
        this.checkOk(response, 'update file');
    }

    async trashFile(fileId: string): Promise<void> {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: { ...this.authHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
        });
        this.checkOk(response, 'trash duplicate file');
    }
}
