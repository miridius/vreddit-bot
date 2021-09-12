const {
  withFnMocks,
  mocked,
  CHAT,
  setDefaultImpls,
  env,
  setDefaultImpl,
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
const url = `https://v.redd.it/${id}`;
const redditUrl =
  'https://www.reddit.com/r/AnimalsBeingDerps/comments/kwxvu7/blah_blah_blah_blah/';
const title = 'Blah blah blah blah...';
const fileId = 'file ID';

beforeEach(() => {
  jest.resetAllMocks();
  setDefaultImpls(cache, { downloadVideo }, reddit);
  setDefaultImpl('env.send', jest.spyOn(env, 'send'));
});

describe('VideoPost.findAllInText / fromUrl', () => {
  it('extracts v.redd.it URLs and videoId', () => {
    const text = `...${url}/blah`;
    return withFnMocks(
      () =>
        expect(
          VideoPost.findAllInText(env, text).then((posts) =>
            posts[0]?.getVredditId(),
          ),
        ).resolves.toEqual(id),
      [cache.read, [text], false],
    );
  });
  it('extracts reddit comments urls and gets the video info', () => {
    const text = `${title}\n${redditUrl}gj722jl?utm_source=share&utm_medium=web2x&context=3`;
    return withFnMocks(
      () =>
        expect(VideoPost.findAllInText(env, text)).resolves.toEqual([
          {
            env,
            url: 'https://v.redd.it/s090h1f828b61',
            redditUrl:
              'https://www.reddit.com/r/AnimalsBeingDerps/comments/kwxvu7/blah_blah_blah_blah/',
            title: 'Blah blah blah blah...',
            fileId: undefined,
          },
        ]),
      [reddit.getPostData, [redditUrl], { title, videoUrl: url }],
      [cache.read, [url], false],
    );
  });
  it('finds all URLs', () => {
    return withFnMocks(
      async () => {
        expect(await VideoPost.findAllInText(env, 'foo')).toEqual([]);
        expect(
          await VideoPost.findAllInText(
            env,
            'https://example.com/foo https://example.com?bar',
          ),
        ).toEqual([
          { env, url: 'https://example.com/foo' },
          { env, url: 'https://example.com?bar' },
        ]);
      },
      [cache.read, ['https://example.com/foo'], false],
      [cache.read, ['https://example.com?bar'], false],
    );
  });
  it('treats reddit posts without v.redd.it videos as unknown URLs', async () => {
    const url = 'http://www.example.com';
    return withFnMocks(
      () =>
        expect(VideoPost.fromUrl(env, redditUrl)).resolves.toEqual({
          env,
          url,
          redditUrl,
          title,
        }),
      [
        reddit.getPostData,
        [redditUrl],
        Promise.resolve({ title, videoUrl: url }),
      ],
      [cache.read, [url], false],
    );
  });
  it('returns empty array when given no input', async () => {
    await expect(VideoPost.findAllInText(env, undefined)).resolves.toEqual([]);
    await expect(VideoPost.findAllInText(env, '')).resolves.toEqual([]);
  });
});

describe('new VideoPost', () => {
  it('prefers new data over cache', () => {
    const expected = { env, url, redditUrl, title, fileId };
    const cached = {
      redditUrl: 'cached url',
      title: 'cached title',
      fileId: 'cached fileId',
    };
    return withFnMocks(
      () =>
        expect(new VideoPost(env, url, redditUrl, title, fileId)).toEqual(
          expected,
        ),
      [cache.read, [url], cached],
    );
  });
  it('falls back to cached data if available', () => {
    return withFnMocks(
      () =>
        expect(new VideoPost(env, url)).toEqual({
          env,
          url,
          redditUrl,
          title,
          fileId,
        }),
      [cache.read, [url], { redditUrl, title, fileId }],
    );
  });
});

describe('post.downloadAndSend', () => {
  const reply_to_message_id = 42;
  const stats = { path: 'path', width: 100, height: 200, size: 1024 };
  const bigFileStats = { ...stats, size: MAX_FILE_SIZE_BYTES * 2 };
  const sendVideoParams = {
    chat_id: CHAT.id,
    video: stats.path,
    width: stats.width,
    height: stats.height,
    caption: title,
    reply_to_message_id,
    reply_markup: {
      inline_keyboard: [[{ text: 'Source', url: redditUrl }]],
    },
  };

  it('downloads and sends the video with post.sendVideo()', () => {
    return withFnMocks(
      () => {
        const post = new VideoPost(env, url, redditUrl, title);
        return expect(
          post.downloadAndSend(CHAT, reply_to_message_id),
        ).resolves.toBeUndefined();
      },
      [cache.read, [url], false],
      [downloadVideo, [{ env, url, redditUrl, title }], Promise.resolve(stats)],
      [
        jest.spyOn(env, 'send').mockName('env.send'),
        [sendVideoParams],
        { video: { file_id: fileId } },
      ],
      [cache.write, [{ env, url, redditUrl, title, fileId }]],
    );
  });
  it('fetches url/title if not provided with post.getMissingInfo()', () => {
    return withFnMocks(
      () =>
        expect(
          new VideoPost(env, url).downloadAndSend(CHAT, reply_to_message_id),
        ).resolves.toBeUndefined(),
      [cache.read, [url], false],
      [downloadVideo, [{ env, url }], Promise.resolve(stats)],
      [reddit.getCommentsUrl, [id], Promise.resolve(redditUrl)],
      [
        reddit.getPostData,
        [redditUrl],
        Promise.resolve({ title, videoUrl: url }),
      ],
      [cache.write, [{ env, url, redditUrl, title }]],
      [
        jest.spyOn(env, 'send').mockName('env.send'),
        [sendVideoParams],
        { video: { file_id: fileId } },
      ],
      [cache.write, [{ env, url, redditUrl, title, fileId }]],
    );
  });
  it('skips files > max size', () => {
    return withFnMocks(
      () =>
        expect(
          new VideoPost(env, url, redditUrl, title).downloadAndSend(
            CHAT,
            reply_to_message_id,
          ),
        ).resolves.toEqual({
          text: `Video too large (100.00 MB)`,
          reply_to_message_id: reply_to_message_id,
        }),
      [cache.read, [url], false],
      [
        downloadVideo,
        [{ env, url, redditUrl, title }],
        Promise.resolve(bigFileStats),
      ],
    );
  });
  it("doesn't send file too large error to group chats", () => {
    return withFnMocks(
      () =>
        expect(
          new VideoPost(env, url).downloadAndSend(
            { ...CHAT, type: 'group' },
            reply_to_message_id,
          ),
        ).resolves.toBeFalsy(),
      [cache.read, [url], { url, title, redditUrl }],
      [
        downloadVideo,
        [{ env, url, title, redditUrl }],
        Promise.resolve(bigFileStats),
      ],
    );
  });
});
