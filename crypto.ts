import { chunk, decodeBase64, encodeBase64 } from './deps.ts';

export async function generateExportableRsaKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
        {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // equivalent to 65537
            hash: { name: 'SHA-256' },
        },
        true, // extractable
        ['sign', 'verify'],
    );
}

export async function exportKeyToPem(key: CryptoKey, type: 'private' | 'public'): Promise<string> {
    const exported = await crypto.subtle.exportKey(type === 'private' ? 'pkcs8' : 'spki', key);
    const b64 = encodeBase64(exported);
    const typeUpper = type.toUpperCase();
    return [`-----BEGIN ${typeUpper} KEY-----`, ...chunk([...b64], 64).map(v => v.join('')), `-----END ${typeUpper} KEY-----`].join('\n');
}

export async function exportPublicJwk(key: CryptoKey): Promise<JsonWebKey> {
    if (key.type !== 'public') throw new Error(`Expected public key`);
    return await crypto.subtle.exportKey('jwk', key);
}

export async function importPublicJwk(obj: unknown): Promise<CryptoKey> {
    const h: RsaHashedImportParams = { name: 'RSASSA-PKCS1-v1_5',  hash: { name: 'SHA-256' }};
    return await crypto.subtle.importKey('jwk', obj as JsonWebKey, h, false, [ 'verify' ]);
}

export async function rsaSign(privateKey: CryptoKey, data: BufferSource): Promise<ArrayBuffer> {
    return await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
}

export async function rsaVerify(publicKey: CryptoKey, signature: BufferSource, data: BufferSource) {
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data);
}

export async function importKeyFromPem(pemText: string, type: 'private' | 'public'): Promise<CryptoKey> {
    pemText = pemText.trim();
    const typeUpper = type.toUpperCase();
    const b64 = pemText.substring(`-----BEGIN ${typeUpper} KEY-----`.length, pemText.length - `-----END ${typeUpper} KEY-----`.length).replaceAll(/\s+/g, '');
    const pemBytes = decodeBase64(b64);
    return await crypto.subtle.importKey(
        type === 'private' ? 'pkcs8' : 'spki',
        pemBytes,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false, // extractable
        [ type === 'private' ? 'sign' : 'verify' ],
    );
}

export async function computeSha256Hex(data: BufferSource): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hex(new Uint8Array(hash));
}

export function hex(data: Uint8Array): string {
    const a = Array.from(data);
    return a.map(b => b.toString(16).padStart(2, '0')).join('');
}
