//@ts-check
const { CHAT_ID, log, mocked } = require('./helpers');
const { message, inline } = require('../src/handler');
jest.mock('../src/handler/utils');
const {
  getFilePaths,
  getOutputDimensions,
  downloadVideo,
  createForm,
  sendVideo,
  telegramApiCall,
} = mocked(require('../src/handler/utils'));

const { existsSync, unlinkSync, copyFileSync, writeFileSync } = require('fs');
const os = require('os');
const FormData = require('form-data');

// TEST DATA
const sep = os.platform().startsWith('win') ? '\\' : '/';
const testDataDir = `${__dirname}${sep}data${sep}`;
const getTestDataPaths = (videoId) => ({
  videoFile: `${testDataDir}/${videoId}.mp4`,
  metadataFile: `${testDataDir}/${videoId}.json`,
});
getFilePaths.mockImplementation(getTestDataPaths);

const deleteIfExisting = (file) => existsSync(file) && unlinkSync(file);

describe('handler.message', () => {
  const message_id = 3;
  const msgReply = (text, type) =>
    // @ts-ignore
    message({ text, chat: { id: CHAT_ID, type }, message_id }, log);

  it('ignores messages without v.redd.it links', async () => {
    expect(await msgReply('foo')).toBeUndefined();
    expect(await msgReply('https://example.com/foo')).toBeUndefined();
    expect(await msgReply('https://v.redd.it')).toBeUndefined();
  });

  it('re-uses an existing file ID', async () => {
    expect(await msgReply('...https://v.redd.it/hf352syjjka61/blah')).toEqual({
      reply_to_message_id: 3,
      video:
        'BAACAgIAAxkDAAPdX_7_uS4ZUhWLumHZqKJOSPgWFhsAAscLAAIBhPlLfmhpHOQ0Tt8eBA',
    });
  });

  it('downloads and sends a new video, saving the file ID', async () => {
    const videoId = '1yfx5lqshva61';
    const url = `https://v.redd.it/${videoId}`;
    const { videoFile, metadataFile } = getTestDataPaths(videoId);
    const width = 123;
    const height = 456;
    const form = new FormData();
    form.append('a', 1);
    const size = 35;

    downloadVideo.mockImplementationOnce((_, outputFile) => {
      copyFileSync(outputFile + '.txt', outputFile);
      return Promise.resolve('ffmpeg stderr');
    });
    getOutputDimensions.mockReturnValueOnce({ width, height });
    createForm.mockReturnValueOnce(form);
    telegramApiCall.mockReturnValueOnce(Promise.resolve({ ok: true }));
    sendVideo.mockReturnValueOnce(Promise.resolve('new file ID'));

    deleteIfExisting(videoFile);
    deleteIfExisting(metadataFile);
    expect(await msgReply(`Cute! ${url}`)).toBeUndefined();
    expect(existsSync(metadataFile)).toBe(true);
    expect(require(metadataFile)).toEqual({ fileId: 'new file ID' });
    deleteIfExisting(metadataFile);

    expect(getFilePaths).toHaveBeenLastCalledWith(videoId);
    expect(downloadVideo).toHaveBeenLastCalledWith(url, videoFile, log);
    expect(getOutputDimensions).toHaveBeenLastCalledWith('ffmpeg stderr', log);
    expect(createForm).toHaveBeenLastCalledWith(
      CHAT_ID,
      videoFile,
      size,
      width,
      height,
      message_id
    );
    expect(telegramApiCall).toHaveBeenLastCalledWith(
      'sendChatAction?chat_id=123456&action=upload_video'
    );
    expect(sendVideo).toHaveBeenLastCalledWith(form, log);
  });
});

describe('handler.inline', () => {
  // @ts-ignore
  const inlineReply = (query) => inline({ query }, log);

  it('ignores messages without v.redd.it links', async () => {
    expect(await inlineReply('')).toBeUndefined();
    expect(await inlineReply('foo')).toBeUndefined();
    expect(await inlineReply('https://example.com/foo')).toBeUndefined();
    expect(await inlineReply('https://v.redd.it')).toBeUndefined();
  });

  it('re-uses an existing file ID', async () => {
    expect(
      await inlineReply('...https://v.redd.it/hf352syjjka61/blah')
    ).toEqual([
      {
        title: 'Send video (hf352syjjka61.mp4)',
        video_file_id:
          'BAACAgIAAxkDAAPdX_7_uS4ZUhWLumHZqKJOSPgWFhsAAscLAAIBhPlLfmhpHOQ0Tt8eBA',
      },
    ]);
  });

  it('downloads and sends a new video, saving the file ID', async () => {
    const videoId = 'inline-video-id';
    const url = `https://v.redd.it/${videoId}`;
    const { videoFile, metadataFile } = getTestDataPaths(videoId);
    const width = 111;
    const height = 222;
    const form = new FormData();
    form.append('a', 2);
    const size = 10;

    downloadVideo.mockImplementationOnce((_, outputFile) => {
      writeFileSync(outputFile, 'dummy data');
      return Promise.resolve('inline stderr');
    });
    getOutputDimensions.mockReturnValueOnce({ width, height });
    createForm.mockReturnValueOnce(form);
    sendVideo.mockReturnValueOnce(Promise.resolve('new file ID'));

    deleteIfExisting(videoFile);
    deleteIfExisting(metadataFile);
    expect(await inlineReply(url)).toEqual([
      {
        title: `Send video (${videoId}.mp4)`,
        video_file_id: 'new file ID',
      },
    ]);
    expect(existsSync(metadataFile)).toBe(true);
    expect(require(metadataFile)).toEqual({ fileId: 'new file ID' });
    deleteIfExisting(metadataFile);

    expect(getFilePaths).toHaveBeenLastCalledWith(videoId);
    expect(downloadVideo).toHaveBeenLastCalledWith(url, videoFile, log);
    expect(getOutputDimensions).toHaveBeenLastCalledWith('inline stderr', log);
    expect(createForm).toHaveBeenLastCalledWith(
      -375023585,
      videoFile,
      size,
      width,
      height,
      undefined
    );
    expect(sendVideo).toHaveBeenLastCalledWith(form, log);
  });
});
