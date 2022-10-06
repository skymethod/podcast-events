import { exportPublicJwk } from './crypto.ts';

// the jwk exported by subtle crypto is not exactly the format we need for our public jwk
// tweak it a bit for export
export async function generateJwkSet(keyId: string, key: CryptoKey) {
    if (!/^[A-Za-z0-9_.+/=-]+$/.test(keyId)) throw new Error(`Bad keyId: ${keyId}, expected a non-empty string with no whitespace or special characters`);
    const jwk = await exportPublicJwk(key);
    const { kty, alg, n, e } = jwk;
    if (kty !== 'RSA') throw new Error(`Expected RSA public key, found ${kty}`);
    if (alg !== 'RS256') throw new Error(`Expected RS256 algorithm, found ${alg}`);
    if (typeof n !== 'string') throw new Error(`Expected RSA n parameter`);
    if (typeof e !== 'string') throw new Error(`Expected RSA e parameter`);

    return {
        keys: [
            {
                kty,
                kid: keyId,
                use: 'sig',
                alg,
                n,
                e,
            }
        ]
    }
}
