const { CACHE_CHAT, OS_INFO, setLogMethods, log } = require('./io/environment');
const telegram = require('./io/telegram-api');
const VideoPost = require('./video-post');

/** @type import('serverless-telegram').MessageHandler */
exports.message = async ({ text, chat, message_id }, _log) => {
  setLogMethods(_log);
  log.debug('Running on', OS_INFO);

  // Check message for a v.redd.it link or reddit comments link
  const post = await VideoPost.findInText(text);
  if (!post) return;

  // Check if we can re-use an existing file
  if (post.fileId) {
    await post.getMissingInfo();
    return {
      video: post.fileId,
      caption: post.title,
      reply_to_message_id: message_id,
      ...post.commentsButton(),
    };
  }

  // Inform the users that the work is in progress since it might take a while
  // NOTE: we don't wait for this to complete, just fire it and let it run
  telegram('sendChatAction', { chat_id: chat.id, action: 'upload_video' });

  // Download and send the file
  return post.downloadAndSend(chat, message_id);
};

/** @type import('serverless-telegram').InlineHandler */
exports.inline = async ({ query }, _log) => {
  setLogMethods(_log);

  // Check message for a v.redd.it link
  const post = await VideoPost.findInText(query);
  if (!post) return;

  // Check if we can re-use an existing file, otherwise upload it to CACHE_CHAT
  if (!post.fileId) await post.downloadAndSend(CACHE_CHAT);

  // Send the results list
  if (post.fileId) {
    const common = { video_file_id: post.fileId, ...post.commentsButton() };
    return [
      { ...common, title: `Send video "${post.title}"`, caption: post.title },
      { ...common, title: `Send without caption` },
    ];
  }
};
