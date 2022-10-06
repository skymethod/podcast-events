import { encodeJwt } from './jwt.ts';
import { importKeyFromPem } from './crypto.ts';
import { isValidUrl } from './check.ts';
import { parseFlags } from './deps_cli.ts';

// simple file to send podcast-events to a target inboxUrl
// to run: deno task send

// parse the required command-line options
const flags = parseFlags(Deno.args, { string: 'key-id' });
const { 'private-key': privateKeyFile, 'jwk-set-url': jwkSetUrl, 'key-id': keyId, 'target-inbox-url': targetInboxUrl } = flags;
if (typeof privateKeyFile !== 'string') throw new Error(`Use --private-key <file> to specify path to private key pem file`);
if (typeof jwkSetUrl !== 'string') throw new Error(`Use --jwk-set-url <url> to specify the URL to the associated JWK set json`);
if (!isValidUrl(jwkSetUrl)) throw new Error(`Bad --jwk-set-url ${jwkSetUrl}, expected a URL`);
if (typeof keyId !== 'string') throw new Error(`Use --key-id <kid> to specify the key id (kid) of the key to use in the associated JWK set json`);
if (typeof targetInboxUrl !== 'string') throw new Error(`Use --target-inbox-url <url> to specify the URL where the events should be sent`);
if (!isValidUrl(targetInboxUrl)) throw new Error(`Bad --target-inbox-url ${targetInboxUrl}, expected a URL`);

// load the private key used for signing
// should be associated with the public key specified in the jwkSetUrl + keyId
const privateKey = await importKeyFromPem(await Deno.readTextFile(privateKeyFile), 'private');

// define an example payload to send, one listen event
const content = {
    kind: 'listen',
    userAgent: 'send.ts',
    feedUrl: 'https://example.com/feed.xml',
    events: [
        {
            episodeUrl: 'https://example.com/path/to/episode1.mp3',
            time: '2022-10-05T17:31:16.254Z',
            quartile: '50%',
            listenerId: 'fb4b9a2d-bb72-48f4-96e7-482f7c7f8db9'
        }
    ]
};

// compute the JWT, and the Authorization header
const contentBytes = new TextEncoder().encode(JSON.stringify(content, undefined, 2));
const jwt = await encodeJwt({ subject: content.feedUrl, privateKey, jwkSetUrl, keyId, contentBytes });
const authorization = `Bearer ${jwt}`;

// send the events request to the server using POST
const res = await fetch(targetInboxUrl, { method: 'POST', body: contentBytes, headers: { authorization } });

// output the response status and response text
console.log(res.status);
console.log(await res.text());
