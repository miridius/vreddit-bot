const fs = require('fs');
const { log } = require('../env');
const {
  deleteIfExisting,
  downloadVideo,
  getFilePaths,
  getOutputDimensions,
  sendVideo,
  checkSize,
} = require('./utils');

/**
 * @param {string} url
 * @param {string} videoId
 * @param {import('serverless-telegram').Chat} chat
 * @param {number} [replyTo]
 * @returns {Promise<string | void>} fileId of uploaded video, or void if it's too big
 */
module.exports = async (url, videoId, chat, replyTo) => {
  const { videoFile, metadataFile } = getFilePaths(videoId);

  // Use ffmpeg to save the video to a temp file at source quality
  deleteIfExisting(videoFile);
  const ffmpegStderr = await downloadVideo(url, videoFile);

  // Get video dimensions from ffmpeg output
  const { width, height } = getOutputDimensions(ffmpegStderr);
  log.info({ width, height });

  // Make sure the video is not too large
  if (!checkSize(videoFile, chat, replyTo)) return;

  // Send the video to telegram
  const fileId = await sendVideo(chat, videoFile, width, height, replyTo);
  if (fileId) fs.writeFileSync(metadataFile, JSON.stringify({ fileId }));
  return fileId;
};
