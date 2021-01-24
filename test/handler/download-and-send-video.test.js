const { existsSync, unlinkSync, copyFileSync } = require('fs');
const { CHAT, mocked, withFnMocks } = require('../helpers');
const downloadAndSend = require('../../src/handler/download-and-send');
const { resolve } = require('path');

jest.mock('../../src/handler/utils');
const {
  checkSize,
  downloadVideo,
  getFilePaths,
  getOutputDimensions,
  sendVideo,
} = mocked(require('../../src/handler/utils'));

// TEST DATA
const testDataDir = resolve(__dirname, 'data');
const getTestDataPaths = (videoId) => ({
  videoFile: `${testDataDir}/${videoId}.mp4`,
  metadataFile: `${testDataDir}/${videoId}.json`,
});

const deleteIfExisting = (...files) =>
  files.forEach((file) => existsSync(file) && unlinkSync(file));

/**
 * @param {boolean} sizeCheckPass
 * @param {boolean} returnFileId
 */
const downloadTest = async (sizeCheckPass, returnFileId) => {
  // TEST DATA
  const id = '1yfx5lqshva61';
  const url = `https://v.redd.it/${id}`;
  const { videoFile, metadataFile } = getTestDataPaths(id);
  const ffmpegStderr = 'ffmpeg stderr';
  const width = 123;
  const height = 456;
  const fileId = returnFileId ? 'new file ID' : undefined;
  /**@type import('serverless-telegram').Message['chat'] */
  const chat = { id: CHAT.id, type: 'group' };
  const replyTo = 42;

  return withFnMocks(
    async () => {
      deleteIfExisting(videoFile, metadataFile);
      expect(await downloadAndSend(url, id, chat, replyTo)).toEqual(fileId);
      expect(existsSync(videoFile)).toBe(true);
      expect(existsSync(metadataFile)).toBe(returnFileId);
      if (returnFileId) expect(require(metadataFile)).toEqual({ fileId });
      deleteIfExisting(videoFile, metadataFile);
    },
    [getFilePaths, [id], { videoFile, metadataFile }],
    [
      downloadVideo,
      [url, videoFile],
      (_, outputFile) => {
        copyFileSync(outputFile + '.txt', outputFile);
        return Promise.resolve(ffmpegStderr);
      },
    ],
    [getOutputDimensions, [ffmpegStderr], { width, height }],
    [checkSize, [videoFile, chat, replyTo], sizeCheckPass],
    sizeCheckPass && [
      sendVideo,
      [chat, videoFile, width, height, replyTo],
      Promise.resolve(fileId),
    ]
  );
};

describe('downloadAndSend', () => {
  it('downloads and sends a new video, returning the file ID', () => {
    expect.assertions(9);
    return downloadTest(true, true);
  });

  it('handles missing file IDs', () => {
    expect.assertions(8);
    return downloadTest(true, false);
  });

  it('does not send files that are too big', () => {
    expect.assertions(7);
    return downloadTest(false, false);
  });
});
