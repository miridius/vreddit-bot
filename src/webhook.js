const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const { resolve } = require('path');

const FormData = require('form-data');
const fetch = require('node-fetch');
const { createAzureTelegramWebhook } = require('serverless-telegram');

// Load secrets from environment variables, throw an error if any are missing
const { BOT_ERROR_CHAT_ID, BOT_API_TOKEN } = process.env;
Object.entries({ BOT_ERROR_CHAT_ID, BOT_API_TOKEN }).forEach(([k, v]) => {
  if (!v) throw new Error(`${k} environment variable not set!`);
});

// Constants
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const IS_WINDOWS = os.platform().startsWith('win');
const FFMPEG = resolve(
  __dirname,
  `../ffmpeg/bin/ffmpeg${IS_WINDOWS ? '.exe' : ''}`
);
const API_URL = `https://api.telegram.org/bot${BOT_API_TOKEN}/sendVideo`;

const getFilePaths = (videoId) => ({
  videoFile: resolve(os.tmpdir(), `${videoId}.mp4`),
  metadataFile: resolve(process.env.HOME, `data/${videoId}.json`),
});

const downloadVideo = (url, outputFile, log) => {
  const dashUrl = `${url}/DASHPlaylist.mpd`;
  const httpProxy = process.env.HTTP_PROXY
    ? `-http_proxy ${process.env.HTTP_PROXY}`
    : '';
  log.info('Saving:', dashUrl, 'to:', outputFile, 'using:', FFMPEG, httpProxy);
  return new Promise((resolve, reject) =>
    exec(
      `${FFMPEG} ${httpProxy} -i "${dashUrl}" -c copy ${outputFile}`,
      (err, stdout, stderr) => {
        if (err) reject(err);
        log.debug(`stdout: ${stdout}`);
        log.debug(`stderr: ${stderr}`);
        resolve(stderr);
      }
    )
  );
};

const getOutputDimensions = (ffmpegStderr, log) => {
  const output = ffmpegStderr?.split('Output #0')?.[1];
  const [, w, h] = output?.match(/Video:\s.*\s(\d+)x(\d+)\s/) || [];
  log.debug({ w, h });
  const nanToUndef = (n) => (isNaN(n) ? undefined : n);
  return { width: nanToUndef(parseInt(w)), height: nanToUndef(parseInt(h)) };
};

const createForm = (chatId, videoFile, size, width, height, replyTo) => {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('video', fs.createReadStream(videoFile), { knownLength: size });
  if (width && height) {
    form.append('width', width);
    form.append('height', height);
  }
  if (replyTo) form.append('reply_to_message_id', replyTo);
  return form;
};

const sendVideo = async (form, log) => {
  log.info('Sending message to telegram server');
  const res = await fetch(API_URL, { method: 'POST', body: form });
  const json = await res.json();
  if (!json?.ok) throw new Error(`Telegram API returned: ${json?.description}`);
  // log.debug('json:', json);
  const fileId = json?.result?.video?.file_id;
  // log.info('fileId:', fileId);
  return fileId;
};

// Entry point for function app
module.exports = exports = createAzureTelegramWebhook(
  async ({ text, chat: { id, type }, message_id }, log) => {
    log.debug = log.verbose; // TODO: add this to serverless-telegram
    log.debug('Running on', os.platform(), os.arch(), os.type(), os.version());

    // 1. Check message for a v.redd.it link
    const [url, videoId] =
      text?.match(/https?:\/\/v\.redd\.it\/([-a-zA-Z0-9]+)/) || [];
    log.debug({ url, videoId });
    if (!url) return;

    // 2. Get local paths for temp video file and persisted json metadata file
    const { videoFile, metadataFile } = getFilePaths(videoId);

    // 3. Check if we can re-use an existing file
    let fileId = fs.existsSync(metadataFile) && require(metadataFile)?.fileId;
    if (fileId) {
      log.info('Re-sending existing telegram file ID:', fileId);
      return { video: fileId, reply_to_message_id: message_id };
    }

    // 4. If the video exists, it might be from a failed previous execution
    if (fs.existsSync(videoFile)) {
      log.warn(`${videoFile} already exists, attempting to delete`);
      fs.unlinkSync(videoFile);
    }

    // 5. Use ffmpeg to save the video to a temp file at source quality
    const ffmpegStderr = await downloadVideo(url, videoFile, log);

    // 6. Get video dimensions from ffmpeg output
    const { width, height } = getOutputDimensions(ffmpegStderr, log);
    log.info({ width, height });

    // 7. Check file size
    const { size } = fs.statSync(videoFile);
    if (size > MAX_FILE_SIZE_BYTES) {
      const text = `Video too large (${(size / 1024 / 1024).toFixed(2)} MB) :(`;
      log.error(text);
      return type === 'private' && { reply_to_message_id: message_id, text };
    }
    log.debug({ size });

    // 7. Create the sendVideo method form data
    const form = createForm(id, videoFile, size, width, height, message_id);

    // 8. Send the video to telegram
    fileId = await sendVideo(form, log);
    if (fileId) fs.writeFileSync(metadataFile, JSON.stringify({ fileId }));
  },
  BOT_ERROR_CHAT_ID
);

// Expose internal functions for testing
exports.getFilePaths = getFilePaths;
exports.getOutputDimensions = getOutputDimensions;
exports.downloadVideo = downloadVideo;
exports.createForm = createForm;
exports.sendVideo = sendVideo;
