import { serveHttp, parseFlags } from './deps_cli.ts';
import handler from './validator.ts';

// simple local http server to host the podcast-events validator endpoint
// to run: deno task validator-server

// parse the optional command-line options
const flags = parseFlags(Deno.args);
const { port = 8080 } = flags;
if (typeof port !== 'number') throw new Error(`Use --port <number> to specify the listening port (default: 8080)`);

// start and run the http server
console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
await serveHttp(handler.fetch, { port });
