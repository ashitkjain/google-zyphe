/**
 * Per-file setup for batch integration tests.
 * Polyfills FileReader for Node.js environment.
 * Vitest uses Node environment (not jsdom) for batch tests, so browser
 * APIs like FileReader are unavailable. This minimal polyfill converts
 * blobs to base64 using Buffer, enabling urlToBase64 to work without
 * the Firebase Cloud Function proxy.
 */

// Only polyfill if we're in Node (FileReader not defined)
if (typeof globalThis.FileReader === 'undefined') {
    class FileReaderPolyfill {
        result: string | ArrayBuffer | null = null;
        error: any = null;
        onloadend: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;

        readAsDataURL(blob: Blob) {
            // Use blob.arrayBuffer() which is available in Node 18+ fetch Blob
            blob.arrayBuffer().then(buf => {
                const base64 = Buffer.from(buf).toString('base64');
                const mimeType = (blob as any).type || 'image/jpeg';
                this.result = `data:${mimeType};base64,${base64}`;
                if (this.onloadend) this.onloadend({ target: this });
            }).catch(err => {
                this.error = err;
                if (this.onerror) this.onerror({ target: this });
            });
        }
    }

    (globalThis as any).FileReader = FileReaderPolyfill;
    console.log('[BatchSetup] FileReader polyfill installed for Node environment');
}
