/* eslint-disable jest/no-standalone-expect */
const http = require('http');

/**
 * @template T
 * @param {T} val
 * @returns {T extends (...args: any[]) => any ? jest.MockInstance<ReturnType<T>, Parameters<T>> : jest.Mocked<T>}
 */
// @ts-ignore
const mocked = (val) => val;

/** @type import('serverless-telegram').Chat */
const CHAT = {
  id: parseInt(process.env.BOT_ERROR_CHAT_ID || '123456') || 123456,
  first_name: 'Dave',
  last_name: 'Rolle',
  username: 'DavidRolle',
  type: 'private',
};
/** @type import('serverless-telegram').User */
// @ts-ignore
const FROM = { ...CHAT, is_bot: false, language_code: 'en' };
process.env.BOT_ERROR_CHAT_ID = CHAT.id.toString();
process.env.BOT_API_TOKEN = process.env.BOT_API_TOKEN || '54321:fake_token';
process.env.HOME = process.env.HOME || __dirname;

/** @type import("serverless-telegram").Logger */
const log = Object.assign(jest.fn(), {
  verbose: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/** @type import("serverless-telegram").Context */
// @ts-ignore
const ctx = { log };

/** @type import("serverless-telegram").Env */
// @ts-ignore
const _env = {
  context: ctx,
  debug: log.verbose,
  info: log.info,
  warn: log.warn,
  error: log.error,
  send: jest.fn(),
};
const env = mocked(_env);

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
  /**
   * @param {any} r
   */
  const passThroughRetVal = (r) => {
    codeToRun();
    return r;
  };
  return typeof retValOrPromise?.then === 'function'
    ? retValOrPromise.then(passThroughRetVal)
    : passThroughRetVal(retValOrPromise);
};

/**
 * @param {{ (): void; (): void; (): void; (): any; }} fn
 * @param {string} message
 */
const expectWithMessage = (fn, message) => {
  try {
    return fn();
  } catch (error) {
    throw new Error(`${message}:\n${error}`);
  }
};

/**
 * @template {any[]} A, R
 * @typedef {{
 *   fn: jest.MockInstance<R, A>,
 *   args?: A,
 *   retVal?: R | ((...args: A) => R)
 * }} FnMock
 */

// /**
//  * @param {() => any} testFn
//  */
// const mockTest = (testFn) => ({
//   _testFn: testFn,
//   /** @type {FnMock<any[], any>[]} */
//   _fnMocks: [],
//   _numCalls: 0,

//   /**
//    * @template {any[]} A, R
//    * @param {jest.MockInstance<R, A>} fn
//    * @param {A} args
//    * @param {R} [retVal]
//    */
//   mock(fn, args, retVal) {
//     /** @type {FnMock<A, R>} */
//     const fnMock = { fn, args, retVal };
//     this._fnMocks.push(fnMock);
//     fn.mockImplementationOnce((...calledArgs) => {
//       expectWithMessage(
//         () => expect(calledArgs).toEqual(args),
//         `Function "${fn.getMockName()}" called with incorrect args`,
//       );
//       expectWithMessage(
//         () => expect(++this._numCalls).toBe(this._fnMocks.length),
//         `Function "${fn.getMockName()}" called in the wrong order`,
//       );
//       return typeof retVal === 'function' ? retVal(...calledArgs) : retVal;
//     });
//     return this;
//   },

//   run() {
//     const result = this.testFn();
//     return after(result, () =>
//       expectWithMessage(
//         () => expect(this._numCalls).toBe(this._fnMocks.length),
//         'Not all mocked functions were called',
//       ),
//     );
//   },
// });

/**
 * @template {any[]} A, R
 * @param {jest.MockInstance<R, A> | ((...args: A) => R)} fn
 * @param {A} [args]
 * @param {R | ((...args: A) => R)} [retVal]
 * @returns {FnMock<A, R>}
 */
const fnMock = (fn, args, retVal) => ({ fn: mocked(fn), args, retVal });

/**
 * @param {() => any} testFn
 * @param {FnMock<any[], any>[]} fnMocks
 */
const withFnMocks = (testFn, ...fnMocks) => {
  // skip any empty/falsy specs
  fnMocks = fnMocks.filter((spec) => spec?.fn);
  let numCalls = 0;
  fnMocks.forEach(({ fn, args, retVal }, i) => {
    fn.mockImplementationOnce((...testArgs) => {
      expectWithMessage(
        () => args && expect(testArgs).toEqual(args),
        `Function "${fn.getMockName()}" called with incorrect args`,
      );
      expectWithMessage(
        () => expect(++numCalls).toBe(i + 1),
        `Function "${fn.getMockName()}" called in the wrong order`,
      );
      return typeof retVal === 'function' ? retVal(...testArgs) : retVal;
    });
  });
  const result = testFn();
  return after(result, () =>
    expectWithMessage(
      () => expect(numCalls).toBe(fnMocks.length),
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
  setDefaultImpls,
  fnMock,
  withFnMocks,
};
