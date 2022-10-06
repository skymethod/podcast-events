# podcast-events
Example code and validator for the [proposed &lt;podcast:events> tag](https://github.com/Podcastindex-org/podcast-namespace/issues/396)

There are two tasks you can run to test the _sending_ side.  After cloning the repo locally and changing to the local repo directory root:

## Generate an RSA public/private keypair
`deno task keygen`: generates a new RSA keypair, and dumps out the private key pem, the public key pem, and the public key JWK set json
- Copy and paste the private key pem to a local file. This is a secret that should never leave your machine.
- Copy and paste the public key pem to another local file. Not a secret, can be used to validate a JWT on jwt.io, but otherwise unused.
- Copy and paste the public key JWK set json to a local file. Not a secret, in fact, you'll need to host this file somewhere on the public internet on an https: url.

## Send some example listen events
`deno task send`: generates a valid events payload using a keypair you manage.  Can be the keypair generated above.

---

There is one task you can run to test the _receiving_ side.   After cloning the repo locally and changing to the local repo directory root:

## Host a podcast-events validation endpoint on your local machine
`deno task validator-server`: starts a local http server
- Defaults to port 8080, but can specify with the `--port` command-line option
- Once running, this endpoint implements the receiving side of the podcast-events spec (ie an `inboxUrl` in the `<podcast:events>` tag)
- It does not send/aggregate the received events, but it does immediately validate them and return a json payload with the results
- This makes it useful to test your event sender code

The validator is also hosted on: https://podcast-events.op3.dev
