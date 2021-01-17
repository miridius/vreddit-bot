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

const CACHE_CHAT = {
  id: -375023585,
  title: 'V.redd.it Video Cache',
  type: 'group',
  all_members_are_administrators: true,
};

const parseText = (text, log) => {
  const [url, videoId] =
    text?.match(/https?:\/\/v\.redd\.it\/([-a-zA-Z0-9]+)/) || [];
  log.verbose({ url, videoId });
  return { url, videoId };
};

const getCachedFileId = (videoId, log) => {
  const { metadataFile } = getFilePaths(videoId);
  let fileId = fs.existsSync(metadataFile) && require(metadataFile)?.fileId;
  if (fileId) {
    log.info('Found existing telegram file ID:', fileId);
    return fileId;
  }
};

const downloadAndSendVideo = async (
  url,
  videoId,
  { id, type },
  replyTo,
  log
) => {
  const { videoFile, metadataFile } = getFilePaths(videoId);

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
    if (type === 'private') {
      await telegramApiCall(
        `sendMessage?chat_id=${id}&text=${text}$reply_to_message_id=${replyTo}`
      );
    }
    return;
  }
  log.verbose({ size });

  // Create the sendVideo method form data
  const form = createForm(id, videoFile, size, width, height, replyTo);

  // Send the video to telegram
  const fileId = await sendVideo(form, log);
  if (fileId) fs.writeFileSync(metadataFile, JSON.stringify({ fileId }));
  return fileId;
};

/**
 * @type import('serverless-telegram').MessageHandler
 */
exports.message = async ({ text, chat, message_id }, log) => {
  log.verbose('Running on', OS_INFO);

  // Check message for a v.redd.it link
  const { url, videoId } = parseText(text, log);
  if (!url) return;

  // Check if we can re-use an existing file
  let fileId = getCachedFileId(videoId, log);
  if (fileId) return { video: fileId, reply_to_message_id: message_id };

  // Inform the users that the work is in progress since it might take a while
  // NOTE: we don't wait for this to complete, just fire it and let it run
  telegramApiCall(`sendChatAction?chat_id=${chat.id}&action=upload_video`);

  // Download and send the file
  await downloadAndSendVideo(url, videoId, chat, message_id, log);
};

/**
 * @type import('serverless-telegram').InlineHandler
 */
exports.inline = async ({ query }, log) => {
  // End early if query is empty
  if (query === '') return;

  // Check message for a v.redd.it link
  const { url, videoId } = parseText(query, log);
  if (!url) return;

  // Check if we can re-use an existing file, otherwise upload it to CACHE_CHAT
  const fileId =
    getCachedFileId(videoId, log) ||
    (await downloadAndSendVideo(url, videoId, CACHE_CHAT, undefined, log));

  // Send the results list
  if (fileId) {
    return [{ title: `Send video (${videoId}.mp4)`, video_file_id: fileId }];
  }
};
