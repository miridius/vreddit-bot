//@ts-check
const { CHAT_ID, log, mocked } = require('./helpers');
const handler = require('../src/handler');
jest.mock('../src/handler/utils');
const {
  getFilePaths,
  getOutputDimensions,
  downloadVideo,
  createForm,
  sendVideo,
  telegramApiCall,
} = mocked(require('../src/handler/utils'));

const { existsSync, unlinkSync, copyFileSync } = require('fs');
const os = require('os');
const FormData = require('form-data');

// TEST DATA
const sep = os.platform().startsWith('win') ? '\\' : '/';
const testDataDir = `${__dirname}${sep}data${sep}`;
const getTestDataPaths = (videoId) => ({
  videoFile: `${testDataDir}/${videoId}.mp4`,
  metadataFile: `${testDataDir}/${videoId}.json`,
});

const deleteIfExisting = (file) => existsSync(file) && unlinkSync(file);

describe('handler', () => {
  const message_id = 3;
  const msgReply = (text, type) =>
    // @ts-ignore
    handler({ text, chat: { id: CHAT_ID, type }, message_id }, log);

  it('ignores messages without v.redd.it links', async () => {
    expect(await msgReply('foo')).toBeUndefined();
    expect(await msgReply('https://example.com/foo')).toBeUndefined();
    expect(await msgReply('https://v.redd.it')).toBeUndefined();
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

    getFilePaths.mockReturnValueOnce({ videoFile, metadataFile });
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

  it('re-uses an existing file ID', async () => {
    getFilePaths.mockImplementationOnce(getTestDataPaths);
    expect(await msgReply('...https://v.redd.it/hf352syjjka61/blah')).toEqual({
      reply_to_message_id: 3,
      video:
        'BAACAgIAAxkDAAPdX_7_uS4ZUhWLumHZqKJOSPgWFhsAAscLAAIBhPlLfmhpHOQ0Tt8eBA',
    });
  });
});
