const { MAX_FILE_SIZE_BYTES } = require('./io/environment');
const cache = require('./io/file-cache');
const reddit = require('./io/reddit-api');
const { downloadVideo } = require('./io/download-video');

const idRegex = /https?:\/\/v\.redd\.it\/(\w+)/;
const urlRegex =
  /https?:\/\/(www\.)?reddit\.com\/r\/\w+\/comments\/\w+\/\w+\/?/;
/** @param {string} [text] */
const findId = (text) => text?.match(idRegex)?.[1];
/** @param {string} [text] */
const findUrl = (text) => text?.match(urlRegex)?.[0];

class VideoPost {
  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} [text]
   */
  static async findInText(env, text) {
    if (!text) return;
    const id = findId(text);
    return id ? new VideoPost(env, id) : VideoPost.fromUrl(env, findUrl(text));
  }

  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} [url]
   */
  static async fromUrl(env, url) {
    if (!url) return;
    const { videoUrl, title } = await reddit.getPostData(url);
    const id = findId(videoUrl);
    if (id) return new VideoPost(env, id, url, title);
  }

  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} id
   * @param {string} [url]
   * @param {string} [title]
   * @param {string} [fileId]
   */
  constructor(env, id, url, title, fileId) {
    this.env = env;
    this.id = id;
    const cachedInfo = cache.read(this.id);
    this.url = url || cachedInfo.url;
    this.title = title || cachedInfo.title;
    this.fileId = fileId || cachedInfo.fileId;
  }

  /**
   * @param {import('serverless-telegram').Chat} chat
   * @param {number} [replyTo] ID of the original message to reply to
   */
  async downloadAndSend(chat, replyTo) {
    const [{ path, width, height, size }] = await Promise.all([
      downloadVideo(this.id),
      this.getMissingInfo(),
    ]);
    if (size > MAX_FILE_SIZE_BYTES) {
      const text = `Video too large (${(size / 1024 / 1024).toFixed(2)} MB)`;
      this.env.error(text);
      return chat.type === 'private' && { text, reply_to_message_id: replyTo };
    }
    // Send the video to telegram
    return this.sendVideo(chat, path, width, height, replyTo);
  }

  async getMissingInfo() {
    if (!this.url) {
      this.url = await reddit.getCommentsUrl(this.id);
    }
    if (this.url && !this.title) {
      this.title = (await reddit.getPostData(this.url)).title;
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
        inline_keyboard: [[{ text: 'Source', url: this.url }]],
      },
    };
  }
}

module.exports = VideoPost;
