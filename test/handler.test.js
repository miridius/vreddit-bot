const {
  CHAT,
  FROM,
  mocked,
  withFnMocks,
  env,
  setDefaultImpl,
} = require('./helpers');
const { message, inline } = require('../src/handler');
const { CACHE_CHAT } = require('../src/io/environment');

jest.mock('../src/video-post');
const VideoPost = mocked(require('../src/video-post'));

const id = 'hf352syjjka61';
const text = `https://v.redd.it/${id}`;
const entities = [{ offset: 0, length: 31, type: 'url' }];
const url = 'url';
const title = 'title';

let post;

beforeEach(() => {
  jest.resetAllMocks();
  // VideoPost.mockClear();
  post = new VideoPost(env, id);
  Object.assign(post, { id, url, title });
  setDefaultImpl('env.send', jest.spyOn(env, 'send'));
});

describe('handler.message', () => {
  const message_id = 42;
  const msgReply = (text, entities) =>
    // @ts-ignore
    message({ text, entities, chat: CHAT, message_id }, env);

  it('ignores messages without v.redd.it links', () => {
    return withFnMocks(
      () =>
        expect(
          msgReply('http://www.example.com', entities),
        ).resolves.toBeUndefined(),
      [
        VideoPost.fromUrls,
        [env, ['http://www.example.com']],
        [new VideoPost(env, 'http://www.example.com')],
      ],
      [jest.spyOn(env, 'send'), [{ action: 'upload_video' }]],
    );
  });

  it('ignores messages without URLs', () => {
    return withFnMocks(() => expect(msgReply('abcd')).resolves.toBeUndefined());
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
      () => expect(msgReply(text, entities)).resolves.toEqual(expected),
      [VideoPost.fromUrls, [env, [text]], [post]],
      [post.getMissingInfo, []],
      [post.sourceButton, [], { url }],
    );
  });

  it('downloads and sends a new video', async () => {
    return withFnMocks(
      () => expect(msgReply(text, entities)).resolves.toBeUndefined(),
      [VideoPost.fromUrls, [env, [text]], [post]],
      [
        jest.spyOn(env, 'send').mockName('env.send'),
        [{ action: 'upload_video' }],
        true,
      ],
      [post.downloadAndSend, [CHAT, message_id]],
    );
  });

  describe('handler.inline', () => {
    // @ts-ignore
    const inlineReply = (query) => inline({ query, from: FROM }, env);

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
        [VideoPost.findAllInText, [env, text], []],
      );
    });

    it('re-uses an existing file ID', async () => {
      post.fileId = video_file_id;
      await withFnMocks(
        () => expect(inlineReply(text)).resolves.toEqual(results),
        [VideoPost.findAllInText, [env, text], [post]],
        [post.sourceButton, [], { url }],
      );
      expect(post.downloadAndSend).toHaveBeenCalledTimes(0);
    });

    it('downloads a new video, sends it to cache, and uses the file ID', async () => {
      return withFnMocks(
        () => expect(inlineReply(text)).resolves.toEqual(results),
        [VideoPost.findAllInText, [env, text], [post]],
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
        [VideoPost.findAllInText, [env, text], [post]],
        [post.downloadAndSend, [CACHE_CHAT]],
      );
    });
  });
});
