//@ts-check
const { CHAT_ID, log, createProxyServer } = require('./helpers');
const {
  getFilePaths,
  getOutputDimensions,
  downloadVideo,
  createForm,
  sendVideo,
} = require('../src/handler/utils');

const nock = require('nock');
const filenamify = require('filenamify');
const os = require('os');
const { existsSync, unlinkSync, copyFileSync, readFileSync } = require('fs');

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

const ffmpegStderr = readFileSync(__dirname + '/data/ffmpegStderr.txt', 'utf8');

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
