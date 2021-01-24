const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const { resolve } = require('path');

const { FFMPEG, MAX_FILE_SIZE_BYTES, log } = require('../env');
const telegramApi = require('../telegram-api');

/**
 * @param {string} videoId
 */
const getFilePaths = (videoId) => ({
  videoFile: resolve(os.tmpdir(), `${videoId}.mp4`),
  metadataFile: resolve(process.env.HOME, `data/${videoId}.json`),
});

/**
 * Delete the video if it exists in case it is from a failed previous execution
 * @param {fs.PathLike} videoFile
 */
const deleteIfExisting = (videoFile) => {
  if (fs.existsSync(videoFile)) {
    log.warn(`${videoFile} already exists, attempting to delete`);
    fs.unlinkSync(videoFile);
  }
};

/**
 * @param {string} url dash playlist URL
 * @param {any} outputFile full path to save the video to
 * @param {string} [httpProxy] optional proxy URL e.g. http://127.0.0.1:8080
 */
const downloadVideo = (url, outputFile, httpProxy) => {
  const dashUrl = `${url}/DASHPlaylist.mpd`;
  httpProxy = httpProxy ? `-http_proxy ${httpProxy}` : '';
  log.info('Saving:', dashUrl, 'to:', outputFile, 'using:', FFMPEG, httpProxy);
  return new Promise((resolve, reject) =>
    exec(
      `${FFMPEG} ${httpProxy} -i "${dashUrl}" -c copy ${outputFile}`,
      (err, stdout, stderr) => {
        if (err) reject(err);
        log.debug(`stdout: ${stdout}`);
        log.debug(`stderr: ${stderr}`);
        resolve(stderr);
      }
    )
  );
};

/**
 * @param {string} ffmpegStderr
 */
const getOutputDimensions = (ffmpegStderr) => {
  const output = ffmpegStderr?.split('Output #0')?.[1];
  const [, w, h] = output?.match(/Video:\s.*\s(\d+)x(\d+)\s/) || [];
  log.debug({ w, h });
  const nanToUndef = (n) => (isNaN(n) ? undefined : n);
  return { width: nanToUndef(parseInt(w)), height: nanToUndef(parseInt(h)) };
};

const checkSize = async (videoFile, { id, type }, replyTo) => {
  const { size } = fs.statSync(videoFile);
  log.debug({ size });
  if (size > MAX_FILE_SIZE_BYTES) {
    const text = `Video too large (${(size / 1024 / 1024).toFixed(2)} MB)`;
    log.error(text);
    if (type === 'private') {
      await telegramApi('sendMessage', {
        chat_id: id,
        text,
        reply_to_message_id: replyTo,
      });
    }
    return false;
  }
  return true;
};

/**
 * @param {import('serverless-telegram').Chat} chat
 * @param {fs.PathLike} video
 * @param {number} [width]
 * @param {number} [height]
 * @param {number} [replyTo] ID of the original message to reply to
 */
const sendVideo = async (chat, video, width, height, replyTo) => {
  log.info('Sending message to telegram server');
  const json = await telegramApi(
    'sendVideo',
    { chat_id: chat.id, width, height, reply_to_message_id: replyTo },
    { video }
  );
  const fileId = json?.result?.video?.file_id;
  log.debug('fileId:', fileId);
  return fileId;
};

/**
 * @param {string} text
 */
const parseText = (text) => {
  const [url, videoId] =
    text?.match(/https?:\/\/v\.redd\.it\/([-a-zA-Z0-9]+)/) || [];
  log.debug({ url, videoId });
  return { url, videoId };
};

/**
 * @param {string} videoId
 */
const getCachedFileId = (videoId) => {
  const { metadataFile } = getFilePaths(videoId);
  let fileId = fs.existsSync(metadataFile) && require(metadataFile)?.fileId;
  if (fileId) {
    log.info('Found existing telegram file ID:', fileId);
    return fileId;
  }
};

module.exports = {
  checkSize,
  deleteIfExisting,
  downloadVideo,
  getCachedFileId,
  getFilePaths,
  getOutputDimensions,
  parseText,
  sendVideo,
};
