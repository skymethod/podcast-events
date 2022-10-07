import { isStringRecord, isValidIso8601, isValidUrl, isValidUuid, tryDecodeText, tryParseJson, tryParseUrl } from './check.ts';
import { importPublicJwk } from './crypto.ts';
import { decodeJwt } from './jwt.ts';

// simple endpoint handler that implements the receivng side of a podcast-events inboxUrl
// instead of processing the events, it validates the payload meets the podcast-events spec and returns the result

export default {
    
    async fetch(request: Request): Promise<Response> {
        try {
            const { method, headers } = request;

            // the podcast-events protocol only supports POST
            if (method !== 'POST') throw new ClientError('This endpoint only supports POST requests', 405);

            // check for a JWT-looking Authorization header
            const authorization = headers.get('authorization');
            if (typeof authorization !== 'string') throw new ClientError('Expected Authorization header', 401);
            const m = /^Bearer ([^\s]+)$/.exec(authorization);
            if (!m) throw new ClientError(`Bad Authorization header, expected 'Bearer <jwt>`, 403);
            const [ _, jwt ] = m;

            // read request body payload as raw bytes
            const contentBytes = await ClientError.wrapWith(400, async () => await request.arrayBuffer())();

            // decode JWT passed in Authorization header, validate it has all of the claims needed by the podcast-events spec
            // also verifies the contentSha256 claim matches what we received in the request body
            const { sub, jku, kid } = await ClientError.wrapWith(403, async () => await decodeJwt({ jwt, contentBytes, publicKeyProvider: fetchPublicKeyFromJwkSetUrl }))();
            if (typeof sub !== 'string') throw new ClientError(`Missing 'sub' claim in JWT`);
            if (typeof jku !== 'string') throw new ClientError(`Missing 'jku' claim in JWT`);
            if (typeof kid !== 'string') throw new ClientError(`Missing 'kid' claim in JWT`);

            // at this point, we know the request is signed properly with a strong identity (jku), and could ignore non-trusted entities
            // however, since this is a validator, we let all entities through in order to return a useful response

            // check the subject, this would typically need to be a feed url we know about
            // however, since this is a validator, we let all feed urls through in order to return a useful response
            // (as long as it looks like a valid url)
            if (!isValidUrl(sub)) throw new ClientError(`Bad 'sub' claim, expected feedUrl`);

            // this payload can be trusted since we verified it above, try to decode it into the expected json object
            const json = tryDecodeText(contentBytes);
            if (json ===  undefined) throw new ClientError('Bad request body, expected json text');
            const obj = tryParseJson(json);
            if (obj === undefined) throw new ClientError('Bad request body, expected valid json');
            if (!isStringRecord(obj)) throw new ClientError('Bad request body, expected json object');

            // we have the expected json object payload, now validate each event one by one
            const { events, ...rest } = obj;
            if (!Array.isArray(events)) throw new ClientError(`Bad request body, expected top-level 'events' array`);

            // ensure each event in the array is a valid 'listen' event according to the spec
            events.forEach((v, i) => {
                const newEventLevelError = (msg: string) => new ClientError(`Bad request body event number ${i + 1}, ${msg}`);
                if (!isStringRecord(v)) throw newEventLevelError(`expected json object`);
                const rec = { ...rest, ...v };
                const { kind, feedUrl, episodeUrl, userAgent, referer, time, quartile, listenerId } = rec;
                if (typeof kind !== 'string') throw newEventLevelError(`expected 'kind' string`);
                if (kind !== 'listen') throw newEventLevelError(`this validator only supports the 'listen' event kind`);
                if (typeof feedUrl !== 'string') throw newEventLevelError(`expected 'feedUrl' string`);
                if (feedUrl !== sub) throw newEventLevelError(`expected feedUrl ${feedUrl} to match sub ${sub}`);
                if (typeof episodeUrl !== 'string') throw newEventLevelError(`expected 'episodeUrl' string`);
                if (typeof userAgent !== 'string') throw newEventLevelError(`expected 'userAgent' string`);
                if (referer !== undefined && typeof referer !== 'string') throw newEventLevelError(`expected 'referer' string`);
                if (typeof time !== 'string') throw newEventLevelError(`expected 'time' string`);
                if (!isValidIso8601(time)) throw newEventLevelError(`invalid time ${time}`);
                if (typeof quartile !== 'string') throw newEventLevelError(`expected 'quartile' string`);
                if (typeof listenerId !== 'string') throw newEventLevelError(`expected 'listenerId' string`);
                if (!isValidUuid(listenerId)) throw newEventLevelError(`invalid listenerId ${listenerId}`);
            });

            // we now know the data is valid, so we're done
            // this is where the trusted events would be sent somewhere else for downstream processing/aggregation

            return newJsonResponse({ validListenEvents: events.length, feedUrl: sub, jwk: `${jku}#${kid}` });
        } catch (e) {
            return newJsonResponse({ 'error': e.message }, e instanceof ClientError ? e.status : 500);
        }
    }

}

async function fetchPublicKeyFromJwkSetUrl(jku: string, kid: string): Promise<CryptoKey> {
    // ensure the jku is a https url
    const u = tryParseUrl(jku);
    if (u === undefined) throw new Error(`Bad jku ${jku}, expected url`);
    if (u.protocol !== 'https:') throw new Error(`Bad jku ${jku}, expected https url`);

    // fetch the JWK Set and make sure it has the expected 'keys' array
    // https://www.rfc-editor.org/rfc/rfc7517
    const res = await fetch(jku);
    const { keys } = await res.json();
    if (!Array.isArray(keys)) throw new Error(`No 'keys' key found at ${jku}`);

    // find the key specified by 'kid'
    const key = keys.find(v => v.kid === kid);
    if (!key) throw new Error(`Key ID ${kid} not found at ${jku}`);

    // load the key
    return await importPublicJwk(key);
}

function newJsonResponse(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj, undefined, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
}

//

class ClientError extends Error {
    readonly status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }

    static wrapWith<T>(status: number, fn: () => Promise<T>): () => Promise<T> {
        return async () => {
            try {
                return await fn();
            } catch (e) {
                throw new ClientError(e.message, status);
            }
        }
    }

}
