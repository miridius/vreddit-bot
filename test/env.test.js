const { mocked } = require('./helpers');

const envPath = '../src/env';

beforeEach(() => {
  jest.resetModules();
  expect.getState().oldEnv = JSON.parse(JSON.stringify(process.env));
});

afterEach(() => {
  process.env = expect.getState().oldEnv;
});

describe('env', () => {
  it('throws an error if secrets are missing', () => {
    delete process.env.BOT_API_TOKEN;
    expect(() => require(envPath)).toThrowErrorMatchingInlineSnapshot(
      `"BOT_API_TOKEN environment variable not set!"`
    );
  });

  it('throws an error if secrets are not valid', () => {
    process.env.BOT_ERROR_CHAT_ID = 'not a number';
    expect(() => require(envPath)).toThrowErrorMatchingInlineSnapshot(
      `"BOT_ERROR_CHAT_ID env var is not a valid integer"`
    );
  });

  [
    ['win32', 'ffmpeg.exe'],
    ['linux', 'ffmpeg'],
  ].forEach(([platform, binary]) => {
    it(`uses ${binary} on ${platform}`, () => {
      jest.mock('os');
      // @ts-ignore
      mocked(require('os')).platform.mockReturnValue(platform);
      expect(require(envPath).FFMPEG).toMatch(new RegExp(`${binary}$`));
    });
  });
});
