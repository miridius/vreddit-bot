const { createProxyServer, log } = require('../helpers');
const {
  downloadVideo,
  deleteIfExisting,
  getOutputDimensions,
} = require('../../src/io/download-video');

const nock = require('nock');
const filenamify = require('filenamify');
const { tmpdir } = require('os');
const { existsSync, copyFileSync, unlinkSync } = require('fs');
const { resolve } = require('path');

nock.back.fixtures = __dirname + '/__fixtures__/';
nock.back.setMode(process.env.CI ? 'lockdown' : 'record');

// Proxy server so that we can use to mock ffmpeg's traffic
const PROXY_PORT = 8081;
const proxyServer = createProxyServer();

beforeAll(() => {
  proxyServer.listen(PROXY_PORT);
});

afterAll(() => {
  nock.restore();
  proxyServer.close();
});

// TEST DATA
const videoId = 'hf352syjjka61';

const tempVideoFile = resolve(tmpdir(), `${videoId}.mp4`);

const width = 406;
const height = 720;
const size = 3264564;

/** @param {import("fs").PathLike} f */
const _deleteIfExisting = (f) => existsSync(f) && unlinkSync(f);

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

describe('downloadVideo', () => {
  it('saves video file from v.redd.it URL', async () => {
    _deleteIfExisting(tempVideoFile);
    await expect(
      withNockback(downloadVideo)(videoId, `http://127.0.0.1:${PROXY_PORT}`),
    ).resolves.toEqual({ path: tempVideoFile, size, width, height });
    expect(existsSync(tempVideoFile)).toBe(true);
    _deleteIfExisting(tempVideoFile);
  });
  it('throws an error in case of failure', async () => {
    return expect(
      withNockback(downloadVideo)('does not exist!'),
    ).rejects.toThrow(/Command failed/);
  });
});

describe('deleteIfExisting', () => {
  it('deletes existing files and logs a warning', () => {
    const newFile = `${__filename}.tmp`;
    copyFileSync(__filename, newFile);
    deleteIfExisting(newFile);
    expect(log.warn).toHaveBeenLastCalledWith(
      `${newFile} already exists, attempting to delete`,
    );
    expect(existsSync(newFile)).toBe(false);
  });
  it('ignores files that do not exist', () => {
    expect(deleteIfExisting('does not exist')).toBeUndefined();
  });
});

describe('getOutputDimensions', () => {
  it('fails gracefully in case of no video stream', () => {
    expect(
      getOutputDimensions(
        `ffmpeg
...
Output #0, mp4, to 'C:\\local\\Temp\\hf352syjjka61.mp4':
...`,
      ),
    ).toEqual({});
  });
  it('fails gracefully in case of no input', () => {
    expect(getOutputDimensions('')).toEqual({});
  });
});
