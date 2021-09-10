const {
  withFnMocks,
  mocked,
  CHAT,
  setDefaultImpls,
  env,
} = require('./helpers');
const VideoPost = require('../src/video-post');
const { MAX_FILE_SIZE_BYTES } = require('../src/io/environment');

jest.mock('../src/io/file-cache');
jest.mock('../src/io/download-video');
jest.mock('../src/io/reddit-api');
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
  setDefaultImpls(cache, { downloadVideo }, reddit);
});

describe('VideoPost.findInText / fromUrl', () => {
  it('extracts v.redd.it URLs and videoId', () => {
    const text = `...${videoUrl}/blah`;
    return withFnMocks(
      () =>
        expect(VideoPost.findInText(env, text)).resolves.toEqual({ env, id }),
      [cache.read, [id], false],
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
          url: 'https://www.reddit.com/r/AnimalsBeingDerps/comments/kwxvu7/blah_blah_blah_blah/',
        }),
      [reddit.getPostData, [url], { title, videoUrl }],
      [cache.read, [id], false],
    );
  });
  it('ignores messages with other URLs', async () => {
    expect(await VideoPost.findInText(env, 'foo')).toBeUndefined();
    expect(
      await VideoPost.findInText(env, 'https://example.com/foo'),
    ).toBeUndefined();
    expect(
      await VideoPost.findInText(env, 'https://v.redd.it'),
    ).toBeUndefined();
  });
  it('ignores reddit posts without v.redd.it videos', async () => {
    return withFnMocks(
      () => expect(VideoPost.fromUrl(env, url)).resolves.toBeUndefined(),
      [
        reddit.getPostData,
        [url],
        Promise.resolve({ title, videoUrl: 'http://www.example.com' }),
      ],
    );
  });
  it('ignores undefined', async () => {
    await expect(VideoPost.findInText(env, undefined)).resolves.toBeUndefined();
    await expect(VideoPost.fromUrl(env, undefined)).resolves.toBeUndefined();
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
      [cache.read, [id], cached],
    );
  });
  it('falls back to cached data if available', () => {
    return withFnMocks(
      () =>
        expect(new VideoPost(env, id)).toEqual({ env, id, url, title, fileId }),
      [cache.read, [id], { url, title, fileId }],
    );
  });
});

describe('post.downloadAndSend', () => {
  const reply_to_message_id = 42;
  const stats = { path: 'path', width: 100, height: 200, size: 1024 };
  const bigFileStats = { ...stats, size: MAX_FILE_SIZE_BYTES * 2 };
  const sendVideoParams = {
    video: stats.path,
    width: stats.width,
    height: stats.height,
    caption: title,
    reply_to_message_id,
    reply_markup: {
      inline_keyboard: [[{ text: 'Source', url }]],
    },
  };

  it('downloads and sends the video with post.sendVideo()', () => {
    return withFnMocks(
      () => {
        const post = new VideoPost(env, id, url, title);
        return expect(
          post.downloadAndSend(CHAT, reply_to_message_id),
        ).resolves.toBeUndefined();
      },
      [cache.read, [id], false],
      [downloadVideo, [id], Promise.resolve(stats)],
      [
        jest.spyOn(env, 'send').mockName('env.send'),
        [sendVideoParams],
        { video: { file_id: fileId } },
      ],
      [cache.write, [{ env, id, title, url, fileId }]],
    );
  });
  it('fetches url/title if not provided with post.getMissingInfo()', () => {
    return withFnMocks(
      () =>
        expect(
          new VideoPost(env, id).downloadAndSend(CHAT, reply_to_message_id),
        ).resolves.toBeUndefined(),
      [cache.read, [id], false],
      [downloadVideo, [id], Promise.resolve(stats)],
      [reddit.getCommentsUrl, [id], Promise.resolve(url)],
      [reddit.getPostData, [url], Promise.resolve({ title, videoUrl })],
      [cache.write, [{ env, id, title, url }]],
      [
        jest.spyOn(env, 'send').mockName('env.send'),
        [sendVideoParams],
        { video: { file_id: fileId } },
      ],
      [cache.write, [{ env, id, title, url, fileId }]],
    );
  });
  it('skips files > max size', () => {
    withFnMocks(
      () =>
        expect(
          new VideoPost(env, id, url, title).downloadAndSend(
            CHAT,
            reply_to_message_id,
          ),
        ).resolves.toEqual({
          text: `Video too large (100.00 MB)`,
          reply_to_message_id: reply_to_message_id,
        }),
      [cache.read, [id], false],
      [downloadVideo, [id], Promise.resolve(bigFileStats)],
    );
  });
  it("doesn't send file too large error to group chats", () =>
    withFnMocks(
      () =>
        expect(
          new VideoPost(env, id).downloadAndSend(
            { ...CHAT, type: 'group' },
            reply_to_message_id,
          ),
        ).resolves.toBeFalsy(),
      [cache.read, [id], { url, title }],
      [downloadVideo, [id], Promise.resolve(bigFileStats)],
    ));
});
