// Patches DNS to return localhost for Cloudflare dev infrastructure hostnames
// that are blocked by the network, allowing wrangler pages dev to start locally.
const dns = require('dns');
const origLookup = dns.lookup.bind(dns);
const origLookupAll = dns.resolve4 ? dns.resolve4.bind(dns) : null;

const BLOCKED = new Set([
  'tail.developers.workers.dev',
  'workers.cloudflare.com',
]);

dns.lookup = function patchedLookup(hostname, optionsOrCb, maybeCb) {
  if (BLOCKED.has(hostname)) {
    const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
    // Return 127.0.0.1 so the connection attempt fails fast (connection refused)
    // instead of hanging on DNS timeout
    process.nextTick(() => cb(null, '127.0.0.1', 4));
    return;
  }
  return origLookup(hostname, optionsOrCb, maybeCb);
};
