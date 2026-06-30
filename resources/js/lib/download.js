import api from './api';

/**
 * Download a file through the authenticated axios instance.
 * Avoids the "Route [login] not defined" error that occurs when
 * an <a href> opens a protected endpoint without the Bearer token.
 *
 * When the server returns a JSON error (4xx/5xx) the response arrives as a
 * Blob because of responseType:'blob'. We read it as text and re-throw with
 * the parsed message so callers / the global interceptor can surface it.
 */
export async function downloadFile(url, filename) {
    try {
        const response = await api.get(url, { responseType: 'blob' });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename || 'download');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        // Axios puts the raw Blob in err.response.data when responseType is 'blob'.
        // Read it as text so we can surface the real JSON error message.
        if (err.response?.data instanceof Blob) {
            try {
                const text = await err.response.data.text();
                const json = JSON.parse(text);
                err.response.data = json;
            } catch {
                // blob wasn't JSON — leave original error intact
            }
        }
        throw err;
    }
}
