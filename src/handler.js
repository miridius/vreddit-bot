const { CACHE_CHAT, OS_INFO, setLogMethods } = require('./io/environment');
const VideoPost = require('./video-post');

/** @type import('serverless-telegram').MessageHandler */
exports.message = async ({ text, chat, message_id }, env) => {
  setLogMethods(env);
  env.debug('Running', process.title, process.version, 'on', OS_INFO);

  // Check message for a v.redd.it link or reddit comments link
  const post = await VideoPost.findInText(env, text);
  if (!post) return;

  // Check if we can re-use an existing file
  if (post.fileId) {
    await post.getMissingInfo();
    return {
      video: post.fileId,
      caption: post.title,
      reply_to_message_id: message_id,
      ...post.sourceButton(),
    };
  }

  // Inform the users that the work is in progress since it might take a while
  // NOTE: we don't wait for this to complete, just fire it and let it run
  env.send({ action: 'upload_video' });

  // Download and send the file
  return post.downloadAndSend(chat, message_id);
};

/** @type import('serverless-telegram').InlineHandler */
exports.inline = async ({ query }, env) => {
  setLogMethods(env);

  // Check message for a v.redd.it link
  const post = await VideoPost.findInText(env, query);
  if (!post) return;

  // Check if we can re-use an existing file, otherwise upload it to CACHE_CHAT
  if (!post.fileId) await post.downloadAndSend(CACHE_CHAT);

  // Send the results list
  if (post.fileId) {
    const video_file_id = post.fileId;
    const caption = post.title;
    const src = post.sourceButton();
    return [
      { title: `Send video "${post.title}"`, video_file_id, caption, ...src },
      { title: `Send without caption`, video_file_id, ...src },
      { title: `Send without source`, video_file_id, caption },
      { title: `Send without caption or source (no context)`, video_file_id },
    ];
  }
};
