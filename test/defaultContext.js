/**
 * @type import("serverless-telegram").Context
 */
module.exports = {
  log: {
    verbose: jest.fn(),
    info: jest.fn(),
    warn: console.warn,
    error: console.error,
  },
};
