const { mocked, CHAT, withFnMocks, ctx, FROM } = require('./helpers');
const webhook = require('../src/webhook');
const { MessageEnv, InlineEnv } = require('serverless-telegram');

jest.mock('../src/handler');
const handler = mocked(require('../src/handler'));

describe('webhook', () => {
  it('works with messages', () => {
    /** @type {import('serverless-telegram').Message} */
    const message = {
      message_id: 35,
      from: FROM,
      chat: CHAT,
      date: 1611414446,
      text: 'https://v.redd.it/rk2repuuvc261',
      entities: [],
    };
    const msgBotResponse = {
      video: Array(50).fill('a').join(''), // 50+ chars in a row is recoginsed as a video ID
      reply_to_message_id: 35,
    };
    /** @type {any} */
    const msgHttpReq = { body: { update_id: 411306077, message } };
    const msgHttpRes = {
      body: { method: 'sendVideo', chat_id: CHAT.id, ...msgBotResponse },
      headers: { 'Content-Type': 'application/json' },
    };
    return withFnMocks(
      () => expect(webhook(ctx, msgHttpReq)).resolves.toEqual(msgHttpRes),
      [
        handler.message,
        [message, new MessageEnv(ctx, message)],
        msgBotResponse,
      ],
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
    /** @type {any} */

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
      () => expect(webhook(ctx, inlineHttpReq)).resolves.toEqual(inlineHttpRes),
      [
        handler.inline,
        [inline_query, new InlineEnv(ctx, inline_query)],
        inlineBotResponse,
      ],
    );
  });

  it('ignores other updates', () => {
    return expect(webhook(ctx, {})).resolves.toBeUndefined();
  });
});
