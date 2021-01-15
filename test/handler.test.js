//@ts-check
const CHAT_ID = process.env.BOT_ERROR_CHAT_ID ?? 123456;
process.env.BOT_ERROR_CHAT_ID = CHAT_ID.toString();
process.env.BOT_API_TOKEN = process.env.BOT_API_TOKEN ?? '54321:fake_token';

const handler = require('../src/handler');
const {
  getFilePaths,
  getOutputDimensions,
  downloadVideo,
  createForm,
  sendVideo,
} = require('../src/handler/utils');

const ctx = require('./defaultContext');
const log = ctx.log;
const createProxyServer = require('./createProxyServer');

const nock = require('nock');
const filenamify = require('filenamify');
const os = require('os');
const { existsSync, unlinkSync, copyFileSync } = require('fs');

nock.back.fixtures = __dirname + '/__fixtures__/';
// Allow new fixtures to be created but only when not running in CI mode
nock.back.setMode(process.env.CI ? 'lockdown' : 'record');

// Proxy server so that we can use to mock ffmpeg's traffic
const PROXY_PORT = 8081;
const proxyServer = createProxyServer();

const { HTTP_PROXY, HOME } = process.env;

beforeAll(() => {
  proxyServer.listen(PROXY_PORT);
  process.env.HTTP_PROXY = `http://127.0.0.1:${PROXY_PORT}`;
  process.env.HOME = __dirname;
});

afterAll(() => {
  proxyServer.close();
  process.env.HTTP_PROXY = HTTP_PROXY;
  process.env.HOME = HOME;
  nock.restore();
});

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

// Since form boundary is generated randomly we need to make it deterministic
Math.random = jest.fn(() => 0.5);

// TEST DATA

const videoId = 'hf352syjjka61';
// Normally URL would be https but ffmpeg will only use a proxy for http URLs
const url = `http://v.redd.it/${videoId}`;

const sep = os.platform().startsWith('win') ? '\\' : '/';
const tempVideoFile = `${os.tmpdir()}${sep}${videoId}.mp4`;
const metadataFile = `${__dirname}${sep}data${sep}${videoId}.json`;

const ffmpegStderr = `ffmpeg version 2021-01-09-git-2e2891383e-essentials_build-www.gyan.dev Copyright (c) 2000-2021 the FFmpeg developers
built with gcc 10.2.0 (Rev6, Built by MSYS2 project)
configuration: --enable-gpl --enable-version3 --enable-static --disable-w32threads --disable-autodetect --enable-fontconfig --enable-iconv --enable-gnutls --enable-libxml2 --enable-gmp --enable-lzma --enable-zlib --enable-libsrt --enable-libssh --enable-libzmq --enable-avisynth --enable-sdl2 --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxvid --enable-libaom --enable-libopenjpeg --enable-libvpx --enable-libass --enable-libfreetype --enable-libfribidi --enable-libvidstab --enable-libvmaf --enable-libzimg --enable-amf --enable-cuda-llvm --enable-cuvid --enable-ffnvcodec --enable-nvdec --enable-nvenc --enable-d3d11va --enable-dxva2 --enable-libmfx --enable-libgme --enable-libopenmpt --enable-libopencore-amrwb --enable-libmp3lame --enable-libtheora --enable-libvo-amrwbenc --enable-libgsm --enable-libopencore-amrnb --enable-libopus --enable-libspeex --enable-libvorbis --enable-librubberband
libavutil      56. 63.100 / 56. 63.100
libavcodec     58.115.102 / 58.115.102
libavformat    58. 65.101 / 58. 65.101
libavdevice    58. 11.103 / 58. 11.103
libavfilter     7. 95.100 /  7. 95.100
libswscale      5.  8.100 /  5.  8.100
libswresample   3.  8.100 /  3.  8.100
libpostproc    55.  8.100 / 55.  8.100
Input #0, dash, from 'https://v.redd.it/hf352syjjka61/DASHPlaylist.mpd':
Duration: 00:00:10.00, start: -0.021333, bitrate: 2 kb/s
Program 0 
  Stream #0:0: Video: h264 (Main) (avc1 / 0x31637661), yuv420p, 136x240 [SAR 135:136 DAR 9:16], 225 kb/s, 30 fps, 30 tbr, 3k tbn, 60 tbc (default)
  Metadata:
    variant_bitrate : 611140
    id              : video_611140
  Stream #0:1: Video: h264 (Main) (avc1 / 0x31637661), yuv420p, 202x360 [SAR 1:1 DAR 101:180], 299 kb/s, 30 fps, 30 tbr, 3k tbn, 60 tbc (default)
  Metadata:
    variant_bitrate : 810514
    id              : video_810514
  Stream #0:2: Video: h264 (Main) (avc1 / 0x31637661), yuv420p, 270x480 [SAR 1:1 DAR 9:16], 719 kb/s, 30 fps, 30 tbr, 3k tbn, 60 tbc (default)
  Metadata:
    variant_bitrate : 1211509
    id              : video_1211509
  Stream #0:3: Video: h264 (Main) (avc1 / 0x31637661), yuv420p, 406x720 [SAR 405:406 DAR 9:16], 1230 kb/s, 30 fps, 30 tbr, 3k tbn, 60 tbc (default)
  Metadata:
    variant_bitrate : 2411479
    id              : video_2411479
  Stream #0:4: Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 63 kb/s (default)
  Metadata:
    variant_bitrate : 132840
    id              : audio_0_132840
Output #0, mp4, to 'C:\\local\\Temp\\hf352syjjka61.mp4':
Metadata:
  encoder         : Lavf58.65.101
  Stream #0:0: Video: h264 (Main) (avc1 / 0x31637661), yuv420p, 406x720 [SAR 405:406 DAR 9:16], q=2-31, 1230 kb/s, 30 fps, 30 tbr, 12k tbn, 3k tbc (default)
  Metadata:
    variant_bitrate : 2411479
    id              : video_2411479
  Stream #0:1: Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 63 kb/s (default)
  Metadata:
    variant_bitrate : 132840
    id              : audio_0_132840
Stream mapping:
Stream #0:3 -> #0:0 (copy)
Stream #0:4 -> #0:1 (copy)
Press [q] to stop, [?] for help
frame=    0 fps=0.0 q=-1.0 size=       0kB time=00:00:00.00 bitrate=N/A speed=   0x    
[dash @ 0000029bfb9dfd00] No longer receiving stream_index 0
[dash @ 0000029bfb9dfd00] No longer receiving stream_index 1
[dash @ 0000029bfb9dfd00] No longer receiving stream_index 2
frame=  307 fps=0.0 q=-1.0 Lsize=    3188kB time=00:00:10.22 bitrate=2555.1kbits/s speed=83.1x    
video:3017kB audio:161kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: 0.314720%`;
const width = 406;
const height = 720;
const size = 3264564;

const deleteIfExisting = (file) => existsSync(file) && unlinkSync(file);

describe('getFilePaths', () => {
  it('returns videoFile', () => {
    expect(getFilePaths(videoId)).toHaveProperty('videoFile', tempVideoFile);
  });
  it('returns metadataFile', () => {
    expect(getFilePaths(videoId)).toHaveProperty('metadataFile', metadataFile);
  });
});

describe('downloadVideo', () => {
  it('saves video file from v.redd.it URL', async () => {
    deleteIfExisting(tempVideoFile);
    let output = await downloadVideo(url, tempVideoFile, log);
    expect(output).toContain(`Input #0, dash, from '${url}/DASHPlaylist.mpd':`);
    expect(output).toContain(`Output #0, mp4, to '${tempVideoFile}':`);
    expect(existsSync(tempVideoFile)).toBe(true);
  });
});

describe('getOutputDimensions', () => {
  it('works with real output', () => {
    expect(getOutputDimensions(ffmpegStderr, log)).toEqual({ width, height });
  });
  it('works with no video stream', () => {
    expect(
      getOutputDimensions(
        `ffmpeg
...
Output #0, mp4, to 'C:\\local\\Temp\\hf352syjjka61.mp4':
...`,
        log
      )
    ).toEqual({});
  });
  it('works with no input', () => {
    expect(getOutputDimensions(undefined, log)).toEqual({});
  });
});

describe('createForm', () => {
  it('creates a form for a video reply', () => {
    const form = createForm(1, tempVideoFile, size, width, height, 2);
    // remove nodejs internals from snapshot to fix test failing in CI
    // @ts-ignore
    form._streams.map((s) => s?.source && delete s.source);
    expect(form).toMatchSnapshot();
  });
});

describe('sendVideo', () => {
  it('sends a video message and returns the file ID', async () => {
    const videoFile = `${__dirname}/data/${videoId}.mp4`;
    if (!existsSync(videoFile)) copyFileSync(videoFile + '.save', videoFile);
    const form = createForm(CHAT_ID, videoFile, size, width, height);
    expect(await sendVideo(form, log)).toMatchInlineSnapshot(
      `"BAACAgIAAxkDAAPZX_7y45KDltDw9kn2Q41TT6za5YsAAqELAAIBhPlLbEBMY3KuURYeBA"`
    );
  });
});

describe('handler', () => {
  const msgReply = (text, type) =>
    // @ts-ignore
    handler({ text, chat: { id: CHAT_ID, type }, message_id: 3 }, log);

  it('ignores messages without v.redd.it links', async () => {
    expect(await msgReply('foo')).toBeUndefined();
    expect(await msgReply('https://example.com/foo')).toBeUndefined();
    expect(await msgReply('https://v.redd.it')).toBeUndefined();
  });

  it('downloads and sends a new video, saving the file ID', async () => {
    const id = '1yfx5lqshva61';
    const { videoFile, metadataFile } = getFilePaths(id);
    deleteIfExisting(videoFile);
    deleteIfExisting(metadataFile);
    expect(await msgReply(`Cute! http://v.redd.it/${id}`)).toBeUndefined();
    expect(existsSync(metadataFile)).toBe(true);
    expect(require(metadataFile)).toMatchInlineSnapshot(`
      Object {
        "fileId": "BAACAgIAAxkDAAPeX_8BA6oNZF4IzIq3o8l1w2B4zCQAAs0LAAIBhPlLmB1a-VH1ErweBA",
      }
    `);
    deleteIfExisting(metadataFile);
  });

  it('re-uses an existing file ID', async () => {
    expect(await msgReply(`...${url}/blah`)).toMatchInlineSnapshot(`
      Object {
        "reply_to_message_id": 3,
        "video": "BAACAgIAAxkDAAPdX_7_uS4ZUhWLumHZqKJOSPgWFhsAAscLAAIBhPlLfmhpHOQ0Tt8eBA",
      }
    `);
  });
});
