const { mocked, CHAT, withFnMocks, ctx, FROM, fnMock } = require('./helpers');
const webhook = require('../src/webhook');

jest.mock('../src/handler');
const handler = mocked(require('../src/handler'));

let newCtx = ctx;

beforeEach(() => (newCtx = { ...ctx }));

describe('webhook', () => {
  it('works with messages', () => {
    /** @type {import('serverless-telegram').Message} */
    // @ts-ignore
    const message = {
      message_id: 35,
      from: FROM,
      chat: CHAT,
      date: 1611414446,
      text: 'https://v.redd.it/rk2repuuvc261',
      entities: [],
    };
    const msgBotResponse = { video: '<file ID>', reply_to_message_id: 35 };
    /** @type {import('serverless-telegram').HttpRequest} */
    // @ts-ignore
    const msgHttpReq = { body: { update_id: 411306077, message } };
    const msgHttpRes = {
      body: { method: 'sendVideo', chat_id: CHAT.id, ...msgBotResponse },
      headers: { 'Content-Type': 'application/json' },
    };
    return withFnMocks(
      () => expect(webhook(newCtx, msgHttpReq)).resolves.toEqual(msgHttpRes),
      fnMock(handler.message, undefined, (msg) => {
        expect(msg).toEqual(message);
        return msgBotResponse;
      }),
    );
  });

  it('works with inline queries', () => {
    const inline_query = {
      id: '260980482508873432',
      from: FROM,
      query: 'https://v.redd.it/rk2repuuvc261',
      offset: '',
    };
    const inlineBotResponse = [
      { title: 'Send video (rk2repuuvc261.mp4)', video_file_id: '<file ID>' },
    ];
    /** @type {import('serverless-telegram').HttpRequest} */
    // @ts-ignore
    const inlineHttpReq = { body: { update_id: 411306081, inline_query } };
    const inlineHttpRes = {
      body: {
        method: 'answerInlineQuery',
        inline_query_id: '260980482508873432',
        results: [{ type: 'video', id: '0', ...inlineBotResponse[0] }],
      },
      headers: { 'Content-Type': 'application/json' },
    };
    return withFnMocks(
      () =>
        expect(webhook(newCtx, inlineHttpReq)).resolves.toEqual(inlineHttpRes),
      fnMock(handler.inline, undefined, (inline) => {
        expect(inline).toEqual(inline_query);
        return inlineBotResponse;
      }),
    );
  });

  it('ignores other updates', () => {
    /** @type {import('serverless-telegram').HttpRequest} */
    // @ts-ignore
    const emptyHttpReq = {};
    return expect(webhook(newCtx, emptyHttpReq)).resolves.toBeUndefined();
  });
});
