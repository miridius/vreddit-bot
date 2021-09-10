const { CHAT, FROM, mocked, withFnMocks, log, env } = require('./helpers');
const { message, inline } = require('../src/handler');
const { CACHE_CHAT } = require('../src/io/environment');

jest.mock('../src/video-post');
const VideoPost = mocked(require('../src/video-post'));

jest.mock('../src/io/telegram-api');
const telegramApi = mocked(require('../src/io/telegram-api'));

const id = 'hf352syjjka61';
const text = `https://v.redd.it/${id}`;
const url = 'url';
const title = 'title';

let post;

beforeEach(() => {
  // VideoPost.mockClear();
  post = new VideoPost(id);
  Object.assign(post, { id, url, title });
});

describe('handler.message', () => {
  const message_id = 42;
  // @ts-ignore
  const msgReply = (text) => message({ text, chat: CHAT, message_id }, env);

  it('ignores messages without v.redd.it links', () => {
    return withFnMocks(
      () => expect(msgReply('abcd')).resolves.toBeUndefined(),
      [VideoPost.findInText, ['abcd'], undefined],
    );
  });

  it('re-uses an existing file ID', async () => {
    post.fileId = `cached file ID for ${id}`;
    const expected = {
      video: post.fileId,
      caption: 'title',
      reply_to_message_id: message_id,
      url,
    };

    return withFnMocks(
      () => expect(msgReply(text)).resolves.toEqual(expected),
      [VideoPost.findInText, [text], post],
      [post.getMissingInfo, []],
      [post.sourceButton, [], { url }],
    );
  });

  it('downloads and sends a new video', async () => {
    return withFnMocks(
      () => expect(msgReply(text)).resolves.toBeUndefined(),
      [VideoPost.findInText, [text], post],
      [
        telegramApi,
        ['sendChatAction', { chat_id: CHAT.id, action: 'upload_video' }],
      ],
      [post.downloadAndSend, [CHAT, message_id]],
    );
  });

  describe('handler.inline', () => {
    // @ts-ignore
    const inlineReply = (query) => inline({ query, from: FROM }, log);

    const video_file_id = `file ID for ${id}`;
    const results = [
      { title: `Send video "${title}"`, video_file_id, caption: title, url },
      { title: `Send without caption`, video_file_id, url },
      { title: `Send without source`, video_file_id, caption: title },
      { title: `Send without caption or source (no context)`, video_file_id },
    ];

    it('returns immediately for empty queries', () =>
      expect(inlineReply('')).resolves.toBeUndefined());

    it('ignores messages without v.redd.it links', () => {
      return withFnMocks(
        () => expect(inlineReply(text)).resolves.toBeUndefined(),
        [VideoPost.findInText, [text]],
      );
    });

    it('re-uses an existing file ID', async () => {
      post.fileId = video_file_id;
      await withFnMocks(
        () => expect(inlineReply(text)).resolves.toEqual(results),
        [VideoPost.findInText, [text], post],
        [post.sourceButton, [], { url }],
      );
      expect(post.downloadAndSend).toHaveBeenCalledTimes(0);
    });

    it('downloads a new video, sends it to cache, and uses the file ID', async () => {
      return withFnMocks(
        () => expect(inlineReply(text)).resolves.toEqual(results),
        [VideoPost.findInText, [text], post],
        [
          post.downloadAndSend,
          [CACHE_CHAT],
          () => {
            post.fileId = video_file_id;
          },
        ],
        [post.sourceButton, [], { url }],
      );
    });

    it('returns nothing if the video is too large (-> no fileId)', async () => {
      return withFnMocks(
        () => expect(inlineReply(text)).resolves.toBeUndefined(),
        [VideoPost.findInText, [text], post],
        [post.downloadAndSend, [CACHE_CHAT]],
      );
    });
  });
});
