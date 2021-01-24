const { CACHE_CHAT, OS_INFO, setLogMethods, log } = require('../env');
const { getCachedFileId, parseText } = require('./utils');
const telegramApi = require('../telegram-api');
const downloadAndSend = require('./download-and-send');

/**
 * @type import('serverless-telegram').MessageHandler
 */
exports.message = async ({ text, chat, message_id }, _log) => {
  setLogMethods(_log);
  log.debug('Running on', OS_INFO);

  // Check message for a v.redd.it link
  const { url, videoId } = parseText(text);
  if (!url) return;

  // Check if we can re-use an existing file
  let fileId = getCachedFileId(videoId);
  if (fileId) return { video: fileId, reply_to_message_id: message_id };

  // Inform the users that the work is in progress since it might take a while
  // NOTE: we don't wait for this to complete, just fire it and let it run
  telegramApi('sendChatAction', { chat_id: chat.id, action: 'upload_video' });

  // Download and send the file
  await downloadAndSend(url, videoId, chat, message_id);
};

/**
 * @type import('serverless-telegram').InlineHandler
 */
exports.inline = async ({ query }, _log) => {
  setLogMethods(_log);

  // End early if query is empty
  if (query === '') return;

  // Check message for a v.redd.it link
  const { url, videoId } = parseText(query);
  if (!url) return;

  // Check if we can re-use an existing file, otherwise upload it to CACHE_CHAT
  const fileId =
    getCachedFileId(videoId) ||
    (await downloadAndSend(url, videoId, CACHE_CHAT));

  // Send the results list
  if (fileId) {
    return [{ title: `Send video (${videoId}.mp4)`, video_file_id: fileId }];
  }
};
