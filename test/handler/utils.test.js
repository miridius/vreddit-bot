const {
  createProxyServer,
  CHAT,
  log,
  mocked,
  withFnMocks,
} = require('../helpers');
const {
  deleteIfExisting,
  downloadVideo,
  getCachedFileId,
  getFilePaths,
  getOutputDimensions,
  parseText,
  sendVideo,
  checkSize,
} = require('../../src/handler/utils');

const nock = require('nock');
const filenamify = require('filenamify');
const os = require('os');
const { existsSync, copyFileSync, readFileSync } = require('fs');
const { FFMPEG } = require('../../src/env');

jest.mock('../../src/telegram-api');
const telegramApi = mocked(require('../../src/telegram-api'));

nock.back.fixtures = __dirname + '/__fixtures__/';
nock.back.setMode(process.env.CI ? 'lockdown' : 'record');

// Proxy server so that we can use to mock ffmpeg's traffic
const PROXY_PORT = 8081;
const proxyServer = createProxyServer();

const { HOME } = process.env;

beforeAll(() => {
  proxyServer.listen(PROXY_PORT);
  process.env.HOME = __dirname;
});

afterAll(() => {
  proxyServer.close();
  process.env.HOME = HOME;
  nock.restore();
});

/**
 * @template {any[]} Args, Ret
 * @param {(...args: Args) => Promise<Ret>} fn
 * @returns {(...args: Args) => Promise<Ret>} fn
 */
const withNockback = (fn) => async (...args) => {
  const fixture = `${filenamify(expect.getState().currentTestName)}.json`;
  const { nockDone, context } = await nock.back(fixture);
  const result = await fn(...args);
  nockDone();
  context.assertScopesFinished();
  return result;
};

// TEST DATA

const videoId = 'hf352syjjka61';
// Normally URL would be https but ffmpeg will only use a proxy for http URLs
const url = `http://v.redd.it/${videoId}`;

const sep = os.platform().startsWith('win') ? '\\' : '/';
const tempVideoFile = `${os.tmpdir()}${sep}${videoId}.mp4`;
const metadataFile = `${__dirname}${sep}data${sep}${videoId}.json`;

const ffmpegStderr = readFileSync(__dirname + '/data/ffmpegStderr.txt', 'utf8');

const width = 406;
const height = 720;

const fileId =
  'BAACAgIAAxkDAAPZX_7y45KDltDw9kn2Q41TT6za5YsAAqELAAIBhPlLbEBMY3KuURYeBA';

describe('getFilePaths', () => {
  it('returns videoFile', () => {
    expect(getFilePaths(videoId)).toHaveProperty('videoFile', tempVideoFile);
  });
  it('returns metadataFile', () => {
    expect(getFilePaths(videoId)).toHaveProperty('metadataFile', metadataFile);
  });
});

describe('deleteIfExisting', () => {
  it('deletes files that exist', () => {
    const newFile = `${metadataFile}.tmp`;
    copyFileSync(metadataFile, newFile);
    deleteIfExisting(newFile);
    expect(log.warn).toHaveBeenLastCalledWith(
      `${newFile} already exists, attempting to delete`
    );
    expect(existsSync(newFile)).toBe(false);
  });
  it('ignores files that do not exist', () => {
    expect(deleteIfExisting('does not exist')).toBeUndefined();
  });
});

describe('downloadVideo', () => {
  it('saves video file from v.redd.it URL', async () => {
    deleteIfExisting(tempVideoFile);
    let output = await withNockback(downloadVideo)(
      url,
      tempVideoFile,
      `http://127.0.0.1:${PROXY_PORT}`
    );
    expect(output).toContain(`Input #0, dash, from '${url}/DASHPlaylist.mpd':`);
    expect(output).toContain(`Output #0, mp4, to '${tempVideoFile}':`);
    expect(existsSync(tempVideoFile)).toBe(true);
  });
  it('throws an error in case of failure', async () => {
    delete process.env.HTTP_PROXY;
    return expect(downloadVideo('foo', 'bar')).rejects.toThrow(
      /No such file or directory/
    );
  });
});

describe('getOutputDimensions', () => {
  it('works with real output', () => {
    expect(getOutputDimensions(ffmpegStderr)).toEqual({ width, height });
  });
  it('works with no video stream', () => {
    expect(
      getOutputDimensions(
        `ffmpeg
...
Output #0, mp4, to 'C:\\local\\Temp\\hf352syjjka61.mp4':
...`
      )
    ).toEqual({});
  });
  it('works with no input', () => {
    expect(getOutputDimensions(undefined)).toEqual({});
  });
});

describe('checkSize', () => {
  const ffmpegExe = FFMPEG.endsWith('.exe') ? FFMPEG : `${FFMPEG}.exe`;
  const size = '72.10 MB';
  const text = `Video too large (${size})`;

  it('accepts small files', () => {
    return expect(checkSize(metadataFile, CHAT, 123)).resolves.toBe(true);
  });

  it('rejects files above max size', async () => {
    await expect(
      checkSize(ffmpegExe, { id: CHAT.id, type: 'group' }, 123)
    ).resolves.toBe(false);
    expect(log.error).toHaveBeenLastCalledWith(text);
  });

  it('sends error to private chats for files above max size', () => {
    return withFnMocks(
      () => expect(checkSize(ffmpegExe, CHAT, 35)).resolves.toBe(false),
      [
        telegramApi,
        ['sendMessage', { chat_id: CHAT.id, text, reply_to_message_id: 35 }],
      ]
    );
  });
});

describe('sendVideo', () => {
  it('sends a video message and returns the file ID', () => {
    const video = 'video.mp4';
    return withFnMocks(
      () =>
        expect(sendVideo(CHAT, video, width, height)).resolves.toEqual(fileId),
      [
        telegramApi,
        [
          'sendVideo',
          { chat_id: CHAT.id, width, height, reply_to_message_id: undefined },
          { video },
        ],
        { result: { video: { file_id: fileId } } },
      ]
    );
  });
});

describe('parseText', () => {
  it('extracts v.redd.it URLs and videoId', () => {
    expect(parseText(`Cute! ${url}`)).toEqual({ url, videoId });
    expect(parseText('...https://v.redd.it/hf352syjjka61/blah')).toEqual({
      url: 'https://v.redd.it/hf352syjjka61',
      videoId: 'hf352syjjka61',
    });
  });
  it('ignores messages without full v.redd.it links', () => {
    expect(parseText('foo')).toEqual({});
    expect(parseText('https://example.com/foo')).toEqual({});
    expect(parseText('https://v.redd.it')).toEqual({});
  });
  it('ignores undefined', () => {
    expect(parseText(undefined)).toEqual({});
  });
});

describe('getCachedFileId', () => {
  it('works with files that exist', () => {
    expect(getCachedFileId('hf352syjjka61')).toEqual(
      'cached file ID for hf352syjjka61'
    );
  });
  it('works with non existant files', () => {
    expect(getCachedFileId('does not exist')).toBeUndefined();
  });
  it('handles files with missing data', () => {
    expect(getCachedFileId('bad-data')).toBeUndefined();
  });
});
