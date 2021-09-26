const { MAX_FILE_SIZE_BYTES } = require('./io/environment');
const cache = require('./io/ddb-cache');
const reddit = require('./io/reddit-api');
const { downloadVideo } = require('./io/download-video');
const { unlink } = require('fs/promises');

const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_MS || '150');

const vredditIdRegex = /https?:\/\/v\.redd\.it\/(\w+)/;

class VideoPost {
  /**
   * Create a new VideoPost, including any cached info (if present)
   * @param {import('serverless-telegram').Env} env
   * @param {string} url video URL
   */
  static async loadCachedInfo(env, url) {
    const { sourceUrl, title, fileId } = (await cache.read(url)) || {};
    return new VideoPost(env, url, sourceUrl, title, fileId);
  }

  /**
   * @param {import('serverless-telegram').Env} env
   * @param {string} url video URL
   * @param {string} [sourceUrl] reddit comments URL for v.redd.it links
   * @param {string} [title] video title
   * @param {string} [fileId] telegram file ID for previously uploaded videos
   */
  constructor(env, url, sourceUrl, title, fileId) {
    this.env = env;
    this.url = url;
    this.sourceUrl = sourceUrl;
    this.title = title;
    this.fileId = fileId;
    this.status = '';
    this.statusMsg = undefined;
    this.timer = undefined;
  }

  statusLog(/** @type {string} */ message = '', debounceMs = DEBOUNCE_MS) {
    this.env.info(message);
    this.status += message + '\n';
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._updateStatus(this.status), debounceMs);
  }

  setStatus(/** @type {string} */ text, chat, replyTo) {
    if (this.timer) clearTimeout(this.timer);
    this.status = text + '\n';
    return this._updateStatus(this.status, chat, replyTo);
  }

  async _updateStatus(/** @type {string} */ text, chat, replyTo) {
    // @ts-ignore
    if (!this.env.message) return;
    const content = {
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: true,
    };
    if (!this.statusMsg) {
      if (!chat) return;
      return (this.statusMsg = this.env.send({
        chat_id: chat.id,
        reply_to_message_id: replyTo,
        ...content,
      }));
    } else {
      return this.env.send({
        method: 'editMessageText',
        message_id: (await this.statusMsg).message_id,
        ...content,
      });
    }
  }

  /**
   * @param {import('serverless-telegram').Chat} chat
   * @param {number} [replyTo] ID of the original message to reply to
   * @returns {Promise<import('serverless-telegram').MessageResponse>}
   */
  async downloadAndSend(chat, replyTo) {
    // Inform the users that the work is in progress since it might take a while
    // NOTE: we don't wait for this to complete, just fire it and let it run
    // @ts-ignore
    if (this.env.message) this.env.send({ action: 'upload_video' });

    this.setStatus(`Downloading ${this.url}...`, chat, replyTo);

    let title, video;
    try {
      [{ title, ...video }] = await Promise.all([
        downloadVideo(this),
        this.getVredditInfo(),
      ]);
      if (video.error) {
        await this.setStatus(video.error);
        return;
      }
      if (video.size > MAX_FILE_SIZE_BYTES) {
        const sizeMb = (video.size / 1024 / 1024).toFixed(2);
        await this.setStatus(`Video too large (${sizeMb} MB): ${this.url}`);
        return;
      }

      if (this.sourceUrl) this.statusLog(`<b>source</b>: ${this.sourceUrl}`);
      if (this.title) {
        this.statusLog(`<b>title</b>: ${this.title}`);
      } else {
        this.title = title;
      }

      // Send the video to telegram
      await this.sendVideo(chat, video, replyTo);
    } catch (e) {
      this.statusLog('An unexpected error occurred, please try again later');
      throw e;
    } finally {
      if (video?.video) await unlink(video.video).catch(() => {});
    }
  }

  /**
   * @param {string} text
   * @param {import('serverless-telegram').Chat} chat
   * @param {number} [replyTo]
   * @returns {import('serverless-telegram').MessageResponse}
   */
  errorResponse(text, chat, replyTo) {
    this.env.error(text);
    return chat.type === 'private' && { text, reply_to_message_id: replyTo };
  }

  /** For v.redd.it urls, gets the comments url and title from reddit */
  async getVredditInfo() {
    if (!this.sourceUrl) {
      const vredditId = this.url.match(vredditIdRegex)?.[1];
      if (vredditId) this.sourceUrl = await reddit.getCommentsUrl(vredditId);
    }
    if (this.sourceUrl && !this.title) {
      this.title = (await reddit.getPostData(this.sourceUrl)).title;
      cache.write(this);
    }
  }

  /**
   * @param {import('serverless-telegram').Chat} chat
   * @param {{video: import('fs').PathLike, width?: number, height?: number,
   *  duration?: number }} video
   * @param {number} [replyTo]
   */
  async sendVideo(chat, video, replyTo) {
    this.statusLog('\nUploading...');
    const result = await this.env.send({
      method: 'sendVideo', // necessary for inline queries
      ...video,
      caption: this.title,
      chat_id: chat.id,
      reply_to_message_id: replyTo,
      allow_sending_without_reply: replyTo && 'true',
      ...this.sourceButton(),
    });
    this.fileId = result?.video?.file_id;
    this.env.debug('fileId:', this.fileId);
    await cache.write(this);
  }

  sourceButton() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Source', url: this.sourceUrl || this.url }],
        ],
      },
    };
  }
}

module.exports = VideoPost;
