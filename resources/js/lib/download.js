import api from './api';

/**
 * Download a file through the authenticated axios instance.
 * Avoids the "Route [login] not defined" error that occurs when
 * an <a href> opens a protected endpoint without the Bearer token.
 */
export async function downloadFile(url, filename) {
    const response = await api.get(url, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename || 'download');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
}
