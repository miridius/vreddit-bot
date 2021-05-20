const {
  CHAT,
  env,
  fnMock,
  mocked,
  setDefaultImpls,
  withFnMocks,
} = require('./helpers');
const VideoPost = require('../src/video-post');
const { MAX_FILE_SIZE_BYTES } = require('../src/io/environment');

jest.mock('fs');
jest.mock('../src/io/file-cache');
jest.mock('../src/io/download-video');
jest.mock('../src/io/reddit-api');
const { createReadStream } = require('fs');
const cache = mocked(require('../src/io/file-cache'));
const { downloadVideo } = mocked(require('../src/io/download-video'));
const reddit = mocked(require('../src/io/reddit-api'));

const id = 's090h1f828b61';
const videoUrl = `https://v.redd.it/${id}`;
const url =
  'https://www.reddit.com/r/AnimalsBeingDerps/comments/kwxvu7/blah_blah_blah_blah/';
const title = 'Blah blah blah blah...';
const fileId = 'file ID';

beforeEach(() => {
  jest.resetAllMocks();
  setDefaultImpls({ createReadStream }, cache, { downloadVideo }, reddit, env);
});

describe('VideoPost.findInText / fromUrl', () => {
  it('extracts v.redd.it URLs and videoId', () => {
    const text = `...${videoUrl}/blah`;
    return withFnMocks(
      () =>
        expect(VideoPost.findInText(env, text)).resolves.toEqual({ env, id }),
      fnMock(cache.read, [id], false),
    );
  });
  it('extracts reddit comments urls and converts to ID', () => {
    const text = `${title}\n${url}gj722jl?utm_source=share&utm_medium=web2x&context=3`;
    return withFnMocks(
      () =>
        expect(VideoPost.findInText(env, text)).resolves.toEqual({
          env,
          fileId: undefined,
          id: 's090h1f828b61',
          title: 'Blah blah blah blah...',
          url:
            'https://www.reddit.com/r/AnimalsBeingDerps/comments/kwxvu7/blah_blah_blah_blah/',
        }),
      fnMock(
        reddit.getPostData,
        [{ env, url }],
        Promise.resolve({ title, videoUrl }),
      ),
      fnMock(cache.read, [id], false),
    );
  });
  it('ignores messages with other URLs', async () => {
    expect(await VideoPost.findInText(env, 'foo')).toBeFalsy();
    expect(
      await VideoPost.findInText(env, 'https://example.com/foo'),
    ).toBeFalsy();
    expect(await VideoPost.findInText(env, 'https://v.redd.it')).toBeFalsy();
  });
  it('ignores reddit posts without v.redd.it videos', async () => {
    return withFnMocks(
      () => expect(VideoPost.fromUrl(env, url)).resolves.toBeFalsy(),
      fnMock(
        reddit.getPostData,
        [{ env, url }],
        Promise.resolve({ title, videoUrl: 'http://www.example.com' }),
      ),
    );
  });
  it('ignores undefined', async () => {
    await expect(VideoPost.findInText(env)).resolves.toBeFalsy();
    await expect(VideoPost.fromUrl(env)).resolves.toBeFalsy();
  });
});

describe('new VideoPost', () => {
  it('prefers new data over cache', () => {
    const expected = { env, id, url, title, fileId };
    const cached = {
      url: 'cached url',
      title: 'cached title',
      fileId: 'cached fileId',
    };
    return withFnMocks(
      () =>
        expect(new VideoPost(env, id, url, title, fileId)).toEqual(expected),
      fnMock(cache.read, [id], cached),
      fnMock(env.info, ['Found existing video info for', id, cached]),
    );
  });
  it('falls back to cached data if available', () => {
    return withFnMocks(
      () =>
        expect(new VideoPost(env, id)).toEqual({ env, id, url, title, fileId }),
      fnMock(cache.read, [id], { url, title, fileId }),
      fnMock(env.info, [
        'Found existing video info for',
        id,
        { url, title, fileId },
      ]),
    );
  });
});

describe('post.downloadAndSend', () => {
  const replyTo = 42;
  const stats = { path: 'path', width: 100, height: 200, size: 1024 };
  const bigFileStats = { ...stats, size: MAX_FILE_SIZE_BYTES * 2 };
  /** @type {import('fs').ReadStream} */
  // @ts-ignore
  const readStream = `ReadStream for ${stats.path}`;
  const videoParams = {
    chat_id: CHAT.id,
    video: readStream,
    width: stats.width,
    height: stats.height,
    caption: title,
    reply_to_message_id: replyTo,
    reply_markup: {
      inline_keyboard: [[{ text: 'Source', url }]],
    },
  };
  const post = withFnMocks(
    () => new VideoPost(env, id, url, title),
    fnMock(cache.read, [id], false),
  );

  it('downloads and sends the video with post.sendVideo()', () => {
    return withFnMocks(
      async () => {
        await expect(post.downloadAndSend(CHAT, replyTo)).resolves.toBeFalsy();
        return expect(post).toEqual({ env, id, url, title, fileId });
      },
      fnMock(downloadVideo, [post], Promise.resolve(stats)),
      fnMock(createReadStream, [stats.path], videoParams.video),
      fnMock(
        env.send,
        [videoParams],
        Promise.resolve({ video: { file_id: fileId } }),
      ),
      fnMock(env.debug, ['fileId:', fileId]),
      fnMock(cache.write, [post]),
    );
  });
  it('fetches url/title if not provided with post.getMissingInfo()', async () => {
    const post = await withFnMocks(
      () => new VideoPost(env, id),
      fnMock(cache.read, [id], false),
    );
    return withFnMocks(
      async () => {
        await expect(post.downloadAndSend(CHAT, replyTo)).resolves.toBeFalsy();
        return expect(post).toEqual({ env, id, title, url, fileId });
      },
      fnMock(downloadVideo, [post], Promise.resolve(stats)),
      fnMock(reddit.getCommentsUrl, [post], Promise.resolve(url)),
      fnMock(reddit.getPostData, [post], Promise.resolve({ title, videoUrl })),
      fnMock(cache.write, [post]),
      fnMock(createReadStream, [stats.path], videoParams.video),
      fnMock(
        env.send,
        [videoParams],
        Promise.resolve({ video: { file_id: fileId } }),
      ),
      fnMock(env.debug, ['fileId:', fileId]),
      fnMock(cache.write, [post]),
    );
  });
  it('skips files > max size', () => {
    return withFnMocks(
      () =>
        expect(post.downloadAndSend(CHAT, replyTo)).resolves.toEqual({
          text: `Video too large (100.00 MB)`,
          reply_to_message_id: replyTo,
        }),
      fnMock(downloadVideo, [post], Promise.resolve(bigFileStats)),
      fnMock(env.error, ['Video too large (100.00 MB)']),
    );
  });
  it("doesn't send file too large error to group chats", () => {
    return withFnMocks(
      () =>
        expect(
          post.downloadAndSend({ ...CHAT, type: 'group' }, replyTo),
        ).resolves.toBeFalsy(),
      fnMock(downloadVideo, [post], Promise.resolve(bigFileStats)),
      fnMock(env.error, ['Video too large (100.00 MB)']),
    );
  });
});
