module.exports = {
  log: {
    debug: jest.fn(),
    verbose: jest.fn(),
    info: jest.fn(),
    warn: console.warn,
    error: console.error,
  },
};
