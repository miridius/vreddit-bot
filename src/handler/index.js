//@ts-check
const fs = require('fs');
const { MAX_FILE_SIZE_BYTES, OS_INFO } = require('../env');
const {
  getFilePaths,
  downloadVideo,
  getOutputDimensions,
  createForm,
  telegramApiCall,
  sendVideo,
} = require('./utils');

/**
 * @type import('serverless-telegram').MessageHandler
 */
module.exports = async ({ text, chat: { id, type }, message_id }, log) => {
  log.verbose('Running on', OS_INFO);

  // Check message for a v.redd.it link
  const [url, videoId] =
    text?.match(/https?:\/\/v\.redd\.it\/([-a-zA-Z0-9]+)/) || [];
  log.verbose({ url, videoId });
  if (!url) return;

  // Get local paths for temp video file and persisted json metadata file
  const { videoFile, metadataFile } = getFilePaths(videoId);

  // Check if we can re-use an existing file
  let fileId = fs.existsSync(metadataFile) && require(metadataFile)?.fileId;
  if (fileId) {
    log.info('Re-sending existing telegram file ID:', fileId);
    return { video: fileId, reply_to_message_id: message_id };
  }

  // Inform the users that the work is in progress since it might take a while
  // NOTE: we don't wait for this to complete, just fire it and let it run
  telegramApiCall(`sendChatAction?chat_id=${id}&action=upload_video`);

  // If the video exists, it might be from a failed previous execution
  if (fs.existsSync(videoFile)) {
    log.warn(`${videoFile} already exists, attempting to delete`);
    fs.unlinkSync(videoFile);
  }

  // Use ffmpeg to save the video to a temp file at source quality
  const ffmpegStderr = await downloadVideo(url, videoFile, log);

  // Get video dimensions from ffmpeg output
  const { width, height } = getOutputDimensions(ffmpegStderr, log);
  log.info({ width, height });

  // Check file size
  const { size } = fs.statSync(videoFile);
  if (size > MAX_FILE_SIZE_BYTES) {
    const text = `Video too large (${(size / 1024 / 1024).toFixed(2)} MB) :(`;
    log.error(text);
    return type === 'private' && { reply_to_message_id: message_id, text };
  }
  log.verbose({ size });

  // Create the sendVideo method form data
  const form = createForm(id, videoFile, size, width, height, message_id);

  // Send the video to telegram
  fileId = await sendVideo(form, log);
  if (fileId) fs.writeFileSync(metadataFile, JSON.stringify({ fileId }));
};
