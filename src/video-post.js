const { MAX_FILE_SIZE_BYTES } = require('./io/environment');
const cache = require('./io/file-cache');
const reddit = require('./io/reddit-api');
const { downloadVideo } = require('./io/download-video');

const urlRegex =
  /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,63}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g;
const vredditIdRegex = /https?:\/\/v\.redd\.it\/(\w+)/;
const redditUrlRegex =
  /https?:\/\/(www\.)?reddit\.com\/r\/\w+\/comments\/\w+\/\w+\/?/;

/** @param {string} text */
const findUrls = (text) => [...text.matchAll(urlRegex)].map((m) => m?.[0]);

class VideoPost {
  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} [text] message/inline text from user input
   * @returns {Promise<VideoPost[]>} a VideoPost for each URL found in the text
   */
  static async findAllInText(env, text) {
    if (!text) return [];
    return VideoPost.fromUrls(env, findUrls(text));
  }

  /**
   * @param {import("serverless-telegram").Env<any>} env
   * @param {string[]} urls
   */
  static async fromUrls(env, urls) {
    return Promise.all(urls.map((url) => VideoPost.fromUrl(env, url)));
  }

  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} url reddit comments URL
   */
  static async fromUrl(env, url) {
    const redditUrl = url.match(redditUrlRegex)?.[0];
    if (redditUrl) {
      const { videoUrl, title } = await reddit.getPostData(redditUrl);
      if (videoUrl) {
        return new VideoPost(env, videoUrl, redditUrl, title);
      }
    }
    return new VideoPost(env, url);
  }

  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} url video URL
   * @param {string} [redditUrl] reddit comments URL
   * @param {string} [title] reddit post title
   * @param {string} [fileId] telegram file ID for previously uploaded videos
   */
  constructor(env, url, redditUrl, title, fileId) {
    this.env = env;
    this.url = url;
    const cachedInfo = cache.read(this.url);
    this.redditUrl = redditUrl || cachedInfo.redditUrl;
    this.title = title || cachedInfo.title;
    this.fileId = fileId || cachedInfo.fileId;
  }

  getVredditId() {
    return this.url.match(vredditIdRegex)?.[1];
  }

  /**
   * @param {import('serverless-telegram').Chat} chat
   * @param {number} [replyTo] ID of the original message to reply to
   * @returns {Promise<import('serverless-telegram').MessageResponse>}
   */
  async downloadAndSend(chat, replyTo) {
    const [video] = await Promise.all([
      downloadVideo(this),
      this.getMissingInfo(),
    ]);
    if (!video) return;
    if (video.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (video.size / 1024 / 1024).toFixed(2);
      const text = `Video too large (${sizeMb} MB)`;
      this.env.error(text);
      return chat.type === 'private' && { text, reply_to_message_id: replyTo };
    }
    // Send the video to telegram
    return this.sendVideo(chat, video.path, video.width, video.height, replyTo);
  }

  async getMissingInfo() {
    if (!this.redditUrl) {
      const vredditId = this.getVredditId();
      if (vredditId) this.redditUrl = await reddit.getCommentsUrl(vredditId);
    }
    if (this.redditUrl && !this.title) {
      this.title = (await reddit.getPostData(this.redditUrl)).title;
      cache.write(this);
    }
  }

  /**
   * @param {import('serverless-telegram').Chat} chat
   * @param {import('fs').PathLike} path
   * @param {number} [width]
   * @param {number} [height]
   * @param {number} [replyTo]
   */
  async sendVideo(chat, path, width, height, replyTo) {
    const result = await this.env.send({
      chat_id: chat.id,
      video: path,
      width,
      height,
      caption: this.title,
      reply_to_message_id: replyTo,
      ...this.sourceButton(),
    });
    this.fileId = result?.video?.file_id;
    this.env.debug('fileId:', this.fileId);
    cache.write(this);
  }

  sourceButton() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Source', url: this.redditUrl || this.url }],
        ],
      },
    };
  }
}

module.exports = VideoPost;
