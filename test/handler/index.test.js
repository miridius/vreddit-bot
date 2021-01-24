const { CHAT, FROM, mocked, withFnMocks, log } = require('../helpers');
const { message, inline } = require('../../src/handler');
const { CACHE_CHAT } = require('../../src/env');

jest.mock('../../src/handler/utils');
jest.mock('../../src/handler/download-and-send');
jest.mock('../../src/telegram-api');
const { getCachedFileId, parseText } = mocked(
  require('../../src/handler/utils')
);
const downloadAndSend = mocked(require('../../src/handler/download-and-send'));
const telegramApi = mocked(require('../../src/telegram-api'));

describe('handler.message', () => {
  const message_id = 42;
  // @ts-ignore
  const msgReply = (text) => message({ text, chat: CHAT, message_id }, log);

  it('ignores messages without v.redd.it links', () => {
    return withFnMocks(
      () => expect(msgReply('abcd')).resolves.toBeUndefined(),
      [parseText, ['abcd'], { url: undefined, videoId: undefined }]
    );
  });

  it('re-uses an existing file ID', async () => {
    const videoId = 'hf352syjjka61';
    const url = `https://v.redd.it/${videoId}`;
    const fileId = `cached file ID for ${videoId}`;
    const expected = { reply_to_message_id: message_id, video: fileId };

    return withFnMocks(
      () => expect(msgReply(url)).resolves.toEqual(expected),
      [parseText, [url], { url, videoId }],
      [getCachedFileId, [videoId], fileId]
    );
  });

  it('downloads and sends a new video', async () => {
    const videoId = '1yfx5lqshva61';
    const url = `https://v.redd.it/${videoId}`;
    return withFnMocks(
      () => expect(msgReply(url)).resolves.toBeUndefined(),
      [parseText, [url], { url, videoId }],
      [getCachedFileId, [videoId], undefined],
      [
        telegramApi,
        ['sendChatAction', { chat_id: CHAT.id, action: 'upload_video' }],
      ],
      [downloadAndSend, [url, videoId, CHAT, message_id]]
    );
  });

  describe('handler.inline', () => {
    // @ts-ignore
    const inlineReply = (query) => inline({ query, from: FROM }, log);

    const videoId = 'inline-video-id';
    const url = `https://v.redd.it/${videoId}`;
    const fileId = `file ID for ${videoId}`;
    const results = [
      { title: `Send video (${videoId}.mp4)`, video_file_id: fileId },
    ];

    it('returns immediately for empty queries', () =>
      expect(inlineReply('')).resolves.toBeUndefined());

    it('ignores messages without v.redd.it links', () => {
      return withFnMocks(
        () => expect(inlineReply('xyz')).resolves.toBeUndefined(),
        [parseText, ['xyz'], { url: undefined, videoId: undefined }]
      );
    });

    it('re-uses an existing file ID', async () => {
      return withFnMocks(
        () => expect(inlineReply(url)).resolves.toEqual(results),
        [parseText, [url], { url, videoId }],
        [getCachedFileId, [videoId], fileId]
      );
    });

    it('downloads a new video, sends it to cache, and uses the file ID', async () => {
      return withFnMocks(
        () => expect(inlineReply(url)).resolves.toEqual(results),
        [parseText, [url], { url, videoId }],
        [getCachedFileId, [videoId], undefined],
        [downloadAndSend, [url, videoId, CACHE_CHAT], fileId]
      );
    });

    it('returns nothing if the video is too large (-> no fileId)', async () => {
      return withFnMocks(
        () => expect(inlineReply(url)).resolves.toBeUndefined(),
        [parseText, [url], { url, videoId }],
        [getCachedFileId, [videoId], undefined],
        [downloadAndSend, [url, videoId, CACHE_CHAT], undefined]
      );
    });
  });
});
