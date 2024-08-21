const http = require('http');
const { Env } = require('serverless-telegram');

/** @type import('serverless-telegram').User */
const FROM = {
  id: parseInt(process.env.BOT_ERROR_CHAT_ID || '123456') || 123456,
  first_name: 'Dave',
  last_name: 'Rolle',
  username: 'DavidRolle',
  is_bot: false,
  language_code: 'en',
};

/** @type import('serverless-telegram').Chat */
const CHAT = {
  ...FROM,
  type: 'private',
};

process.env.BOT_ERROR_CHAT_ID = CHAT.id.toString();
process.env.BOT_API_TOKEN = process.env.BOT_API_TOKEN || '54321:fake_token';
process.env.HOME = process.env.HOME || __dirname;

/** @type import("serverless-telegram").AzureLogger */
const log = Object.assign(jest.fn(), {
  verbose: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/** @type import("serverless-telegram").AzureContext */
// @ts-ignore
const ctx = { log };

// @ts-ignore
// const env = new MessageEnv(ctx, { chat: CHAT });
const env = new Env(ctx);

require('../src/io/environment').setLogMethods(env);

// note this does not start the server, to do so call .listen(port).
const createProxyServer = () =>
  http.createServer((req, res) => {
    // console.debug('Serving:', req.url);
    req.url &&
      req.pipe(
        http.request(req.url, req, (remoteRes) => {
          res.writeHead(remoteRes.statusCode || 200, remoteRes.headers);
          remoteRes.pipe(res, { end: true });
        }),
        { end: true },
      );
  });

/**
 * @template T
 * @param {T} val
 * @returns {T extends (...args: any[]) => any ? jest.MockInstance<T> : jest.Mocked<T>}
 */
// @ts-ignore
const mocked = (val) => val;

/**
 * @param {string} name
 * @param {jest.MockInstance} mockFn */
const setDefaultImpl = (name, mockFn) =>
  mockFn.mockName(name).mockImplementation((...args) => {
    throw new Error(
      `Un-mocked call to function "${name}"
(args: ${JSON.stringify(args)})`,
    );
  });

/** @param {jest.Mocked<any>[]} mockModules */
const setDefaultImpls = (...mockModules) => {
  mockModules.forEach((m) =>
    Object.entries(m).forEach(
      ([k, v]) => typeof v === 'function' && setDefaultImpl(k, v),
    ),
  );
};

const after = (retValOrPromise, codeToRun) => {
  const passThroughRetVal = (r) => {
    codeToRun();
    return r;
  };
  return typeof retValOrPromise?.then === 'function'
    ? retValOrPromise.then(passThroughRetVal)
    : passThroughRetVal(retValOrPromise);
};

const expectWithMessage = (fn, message) => {
  try {
    return fn();
  } catch (error) {
    throw new Error(`${message}:\n${error}`);
  }
};

/**
 * @param {() => any} testFn
 * @param {Array<[jest.MockInstance, any[], any?]>} mockSpecs
 */
const withFnMocks = (testFn, ...mockSpecs) => {
  // skip any empty/falsy specs
  mockSpecs = mockSpecs.filter((spec) => spec?.[0]);
  let numCalls = 0;
  mockSpecs.forEach(([mockFn, mockArgs, mockReturn], i) => {
    mockFn.mockImplementationOnce((...args) => {
      expectWithMessage(
        () => expect(args).toEqual(mockArgs),
        `Function "${mockFn.getMockName()}" called with incorrect args`,
      );
      expectWithMessage(
        () => expect(++numCalls).toBe(i + 1),
        `Function "${mockFn.getMockName()}" called in the wrong order`,
      );
      return typeof mockReturn === 'function'
        ? mockReturn(...args)
        : mockReturn;
    });
  });
  const result = testFn();
  return after(result, () =>
    expectWithMessage(
      () => expect(numCalls).toBe(mockSpecs.length),
      'Not all mocked functions were called',
    ),
  );
  // mockSpecs.forEach(([mockFn, mockArgs]) => {
  //   if (!Array.isArray(mockArgs)) mockArgs = [mockArgs];
  //   if (mockFn) expect(mockFn).toHaveBeenCalledWith(...mockArgs);
  // })
  // );
};

module.exports = {
  CHAT,
  createProxyServer,
  ctx,
  env,
  FROM,
  log,
  mocked,
  setDefaultImpl,
  setDefaultImpls,
  withFnMocks,
};
