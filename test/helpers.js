//@ts-check
const http = require('http');

const CHAT_ID = 123456;
process.env.BOT_ERROR_CHAT_ID = CHAT_ID.toString();
process.env.BOT_API_TOKEN = process.env.BOT_API_TOKEN ?? '54321:fake_token';

/**
 * @type import("serverless-telegram").Logger
 */
const log = Object.assign(jest.fn(), {
  verbose: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
});

// note this does not start the server, to do so call .listen(port).
const createProxyServer = () =>
  http.createServer((req, res) => {
    // console.debug('Serving:', req.url);
    req.pipe(
      http.request(req.url, req, (remoteRes) => {
        res.writeHead(remoteRes.statusCode, remoteRes.headers);
        remoteRes.pipe(res, { end: true });
      }),
      { end: true }
    );
  });

/**
 * @template T
 * @param {T} val
 * @returns {T extends (...args: any[]) => any ? jest.MockInstance<T> : jest.Mocked<T>}
 */
// @ts-ignore
const mocked = (val) => val;

module.exports = { CHAT_ID, log, createProxyServer, mocked };
