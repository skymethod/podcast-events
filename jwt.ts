import { computeSha256Hex, rsaSign, rsaVerify } from './crypto.ts';
import { decodeBase64Url, encodeBase64Url } from './deps.ts';
import { isStringRecord, tryParseJson } from './check.ts';

export async function encodeJwt({ subject, jwkSetUrl, keyId, privateKey, contentBytes }: { subject: string, jwkSetUrl: string, keyId: string, privateKey: CryptoKey, contentBytes: BufferSource }): Promise<string> {
    // construct the JWT header
    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    // construct the JWT payload (claims needed for the podcast-events spec)
    const payload = {
        sub: subject,
        jku: jwkSetUrl,
        kid: keyId,
        contentSha256: await computeSha256Hex(contentBytes),
    };

    // sign the first two parts using the private key to generate the third part (signature)
    const dataToSign = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
    const signature = await rsaSign(privateKey, new TextEncoder().encode(dataToSign));

    // return the JWT, all three parts: HEADER.PAYLOAD.SIGNATURE
    return `${dataToSign}.${encodeBase64Url(signature)}`;
}

export type PublicKeyProvider = (jku: string, kid: string) => Promise<CryptoKey>;

export async function decodeJwt({ jwt, publicKeyProvider, contentBytes }: { jwt: string, publicKeyProvider: PublicKeyProvider, contentBytes: BufferSource }): Promise<Record<string, unknown>> {
    // split the jwt into the three parts: HEADER.PAYLOAD.SIGNATURE
    const m = /^([0-9a-zA-Z_-]+)\.([0-9a-zA-Z_-]+)\.([0-9a-zA-Z_-]+)$/.exec(jwt);
    if (!m) throw new Error(`Unexpected JWT format`);
    const [ _, header64, payload64, signature64 ] = m;

    // validate the JWT header object
    const header = tryParseRecordFromBase64UrlEncodedJson(header64);
    if (header === undefined) throw new Error(`Bad JWT header: ${header}`);
    const { alg, typ } = header;
    if (typ !== 'JWT') throw new Error(`Bad JWT header typ: ${typ}, expected JWT`);
    if (alg !== 'RS256') throw new Error(`Bad JWT header alg: ${alg}, expected RS256`);

    // validate the JWT payload object
    // ensure it has the claims required by the podcast-events spec
    const payload = tryParseRecordFromBase64UrlEncodedJson(payload64);
    if (payload === undefined) throw new Error(`Bad JWT payload: ${payload}`);
    const { jku, kid, sub, contentSha256 } = payload;
    if (typeof jku !== 'string') throw new Error(`Bad JWT payload jku: ${jku}, expected string`);
    if (typeof kid !== 'string') throw new Error(`Bad JWT payload kid: ${kid}, expected string`);
    if (typeof sub !== 'string') throw new Error(`Bad JWT payload sub: ${sub}, expected string`);
    if (typeof contentSha256 !== 'string') throw new Error(`Bad JWT payload contentSha256: ${contentSha256}, expected string`);

    // fetch the public key specified by the JWK set url and keyId
    const publicKey = await publicKeyProvider(jku, kid);

    // verify the signature using the specified publicKey
    const signature = decodeBase64Url(signature64);
    const verified = await rsaVerify(publicKey, signature, new TextEncoder().encode(`${header64}.${payload64}`));
    if (!verified) throw new Error(`Bad JWT: RSA signature verification failed`);

    // verify the contentSha256 claim matches the actual content bytes received
    const actualContentSha256 = await computeSha256Hex(contentBytes);
    if (actualContentSha256 !== contentSha256) throw new Error(`Content sha ${actualContentSha256} does not match sha from header ${contentSha256}`);

    // everything checked out, return the payload object (the claims)
    return payload;
}

//

function tryParseRecordFromBase64UrlEncodedJson(base64UrlEncodedJson: string): Record<string, unknown> | undefined {
    const json = new TextDecoder().decode(decodeBase64Url(base64UrlEncodedJson));
    const obj = tryParseJson(json);
    return isStringRecord(obj) ? obj : undefined;
}
