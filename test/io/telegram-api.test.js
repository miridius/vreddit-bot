const { CHAT } = require('../helpers');
const telegramApi = require('../../src/io/telegram-api');
const { existsSync, copyFileSync } = require('fs');
const nock = require('nock');
const filenamify = require('filenamify');

nock.back.fixtures = __dirname + '/__fixtures__/';
nock.back.setMode(process.env.CI ? 'lockdown' : 'record');

// Use nock.back to mock all HTTP requests (if any) for each test
beforeEach(async () => {
  const state = expect.getState();
  state.nockBack = await nock.back(`${filenamify(state.currentTestName)}.json`);
});

afterEach(() => {
  const { nockBack } = expect.getState();
  nockBack.nockDone();
  nockBack.context.assertScopesFinished();
});

afterAll(nock.restore);

// Since form boundary is generated randomly we need to make it deterministic
Math.random = jest.fn(() => 0.5);

describe('telegramApi', () => {
  it('works with no params (getMe)', () => {
    return expect(telegramApi('getMe')).resolves.toMatchSnapshot();
  });

  it('works with normal params (sendMessage)', () => {
    const method = 'sendMessage';
    const text = 'Test Message';
    const params = {
      chat_id: CHAT.id,
      text,
      reply_to_message_id: 35,
      reply_markup: {
        inline_keyboard: [[{ text: 'Click me', url: 'https://example.com' }]],
      },
    };
    return expect(telegramApi(method, params)).resolves.toMatchSnapshot();
  });

  it('works with file params (sendVideo)', () => {
    const video = `${__dirname}/__fixtures__/hf352syjjka61.mp4`;
    if (!existsSync(video)) copyFileSync(video + '.save', video);
    const method = 'sendVideo';
    const params = {
      chat_id: CHAT.id,
      width: 406,
      height: 720,
      reply_to_message_id: undefined,
    };
    return expect(
      telegramApi(method, params, { video }),
    ).resolves.toMatchSnapshot();
  });

  it('throws an error if result is not ok', () => {
    return expect(telegramApi).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Telegram API error: Unauthorized"`,
    );
  });
});
