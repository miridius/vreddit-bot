const { CACHE_CHAT, OS_INFO, setLogMethods } = require('./io/environment');
const VideoPost = require('./video-post');

/** @type import('serverless-telegram').MessageHandler */
exports.message = async ({ text, chat, message_id, entities }, env) => {
  if (!text) return;
  setLogMethods(env);

  env.debug('Running Node.js', process.version, 'on', OS_INFO);

  // Find all URLs in the message
  const urls =
    entities
      ?.filter((e) => e.type === 'url')
      .map((e) => text.substr(e.offset, e.length)) || [];
  env.debug('urls:', urls);
  if (!urls.length) return;

  // try to download (or load from cache) each one
  const results = await Promise.all(
    urls.map(async (url) => {
      // Load the video info
      const post = await VideoPost.loadCachedInfo(env, url);

      // Check if we can re-use an existing file, otherwise download and send it
      return post.fileId
        ? {
            video: post.fileId,
            caption: post.title,
            reply_to_message_id: message_id,
            ...post.sourceButton(),
          }
        : post.downloadAndSend(chat, message_id);
    }),
  );

  // filter any responses to be sent to the TG api
  const responses = results.filter((r) => r);

  // if there's exactly one API response we can just return it
  // otherwise we need to send them to the API individually
  if (responses.length === 1) {
    return responses[0];
  } else {
    await Promise.all(responses.map((r) => env.send(r)));
  }
};

const urlRegex =
  /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,63}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g;

/** @param {string} text */
const findUrls = (text) => [...text.matchAll(urlRegex)].map((m) => m[0]);

/** @type import('serverless-telegram').InlineHandler */
exports.inline = async ({ query }, env) => {
  if (!query) return;
  setLogMethods(env);

  // Check message for URLs
  const urls = findUrls(query);
  env.debug('urls:', urls);
  if (!urls.length) return;

  // Try each one until one works
  for (const url of urls) {
    // Load the video info
    const post = await VideoPost.loadCachedInfo(env, url);

    // Check if we can re-use an existing file, otherwise upload it to CACHE_CHAT
    if (!post.fileId) await post.downloadAndSend(CACHE_CHAT);

    // If we have an existing file ID or download succeeded, return the inline query result
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
  }
};
