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
  '../ffmpeg/bin/ffmpeg' + IS_WINDOWS ? '.exe' : '',
);
const API_URL = `https://api.telegram.org/bot${BOT_API_TOKEN}/sendVideo`;

let debug, info, warn, error;

const getFilePaths = (videoId) => ({
  videoFile: resolve(os.tmpdir(), `${videoId}.mp4`),
  metadataFile: resolve(process.env.HOME, `data/${videoId}.json`),
});

const downloadVideo = (url, outputFile) => {
  const dashUrl = `${url}/DASHPlaylist.mpd`;
  info('Saving:', dashUrl, 'to:', outputFile, 'using:', FFMPEG);
  return new Promise((resolve, reject) =>
    exec(
      `${FFMPEG} -i "${dashUrl}" -c copy ${outputFile}`,
      (err, stdout, stderr) => {
        if (err) reject(err);
        debug(`stdout: ${stdout}`);
        debug(`stderr: ${stderr}`);
        const [input, output] = stderr.split('Output #0');
        const [_, w, h] = output?.match(/Video:\s.*\s(\d+)x(\d+)\s/) || [];
        debug({ w, h });
        const width = parseInt(w);
        const height = parseInt(h);
        resolve(isNaN(width) || isNaN(height) ? {} : { width, height });
      },
    ),
  );
};

const sendVideo = async (form) => {
  info('Sending message to telegram server');
  const res = await fetch(API_URL, { method: 'POST', body: form });
  if (!res.ok) throw res;
  const json = await res.json();
  debug('json:', json);
  const fileId = json?.result?.video?.file_id;
  info('fileId:', fileId);
  return fileId;
};

module.exports = createAzureTelegramWebhook(
  async ({ text, chat: { id, type }, message_id }, _log) => {
    ({ verbose: debug, info, warn, error } = _log);
    info('Running on', os.platform(), os.arch(), os.type(), os.version());

    // 1. Check message for a v.redd.it link
    const [url, videoId] =
      text?.match(/https:\/\/v\.redd\.it\/([-a-zA-Z0-9]+)/) || [];
    debug({ url, videoId });
    if (!url) return;

    // 2. Get local paths for temp video file and persisted json metadata file
    const { videoFile, metadataFile } = getFilePaths(videoId);

    // 3. Check if we can re-use an existing file
    let fileId = fs.existsSync(metadataFile) && require(metadataFile)?.fileId;
    if (fileId) {
      info('Re-sending existing telegram file ID:', fileId);
      return { video: fileId, reply_to_message_id: message_id };
    }

    // 4. If the video exists, it might be from a failed previous execution
    if (fs.existsSync(videoFile)) {
      info(`${videoFile} already exists, attempting to delete`);
      fs.unlinkSync(videoFile);
    }

    // 5. Use ffmpeg to save the video to a temp file at source quality
    const { width, height } = await downloadVideo(url, videoFile);
    info({ width, height });

    // 6. Check file size
    const { size } = fs.statSync(videoFile);
    if (size > MAX_FILE_SIZE_BYTES) {
      warn({ size });
      return (
        type === 'private' && {
          reply_to_message_id: message_id,
          text: `Video too large (${(size / 1024 / 1024).toFixed(2)} MB) :(`,
        }
      );
    }
    debug({ size });

    // 7. Create the sendVideo method form data
    const form = new FormData();
    form.append('chat_id', id);
    form.append('video', fs.createReadStream(videoFile), { knownLength: size });
    if (width && height) {
      form.append('width', width);
      form.append('height', height);
    }
    if (message_id) form.append('reply_to_message_id', message_id);

    // 8. Send the video to telegram
    fileId = await sendVideo(form);
    if (fileId) fs.writeFileSync(metadataFile, JSON.stringify({ fileId }));
  },
  BOT_ERROR_CHAT_ID,
);
