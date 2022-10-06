import { generateExportableRsaKeyPair, exportKeyToPem } from './crypto.ts';
import { generateJwkSet } from './jwk.ts';

// simple file to generate the bits necessary for sending podcast-events from a strong identity
// (an RSA public/private keypair, and a corresponding JWK url set json file)
// to run: deno task keygen

// copy and paste the private key pem to a local file (needed to send events later)
// copy and paste the public key pem to a local file (not strictly needed, but included for completeness)
// copy and paste the public key jwk json to a local file, then publish this file somewhere on the public internet at a https: url
//   (you'll need this https: url to send events later)

// generate a new RSA keypair
const keypair = await generateExportableRsaKeyPair();

// output the private key in PEM format
const privateKeyPem = await exportKeyToPem(keypair.privateKey, 'private');
console.log(privateKeyPem);

// output the public key in PEM format
const publicKeyPem = await exportKeyToPem(keypair.publicKey, 'public');
console.log(publicKeyPem);

// output a JWK set json corresponding to the public key
// use a timestamp as the key id
const keyId = new Date().toISOString().replaceAll(/[^\d]+/g, ''); // e.g. 20221006160629015
const jwk = await generateJwkSet(keyId, keypair.publicKey);
console.log(JSON.stringify(jwk, undefined, 2));