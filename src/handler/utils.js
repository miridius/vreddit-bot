//@ts-check
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const { resolve } = require('path');
const FormData = require('form-data');
const { default: fetch } = require('node-fetch');

const { BOT_API_TOKEN, FFMPEG } = require('../env');

/**
 * @param {string} videoId
 */
const getFilePaths = (videoId) => ({
  videoFile: resolve(os.tmpdir(), `${videoId}.mp4`),
  metadataFile: resolve(process.env.HOME, `data/${videoId}.json`),
});

/**
 * @param {string} url
 * @param {any} outputFile
 * @param {import('serverless-telegram').Logger} log
 */
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
        log.verbose(`stdout: ${stdout}`);
        log.verbose(`stderr: ${stderr}`);
        resolve(stderr);
      }
    )
  );
};

/**
 * @param {string} ffmpegStderr
 * @param {import('serverless-telegram').Logger} log
 */
const getOutputDimensions = (ffmpegStderr, log) => {
  const output = ffmpegStderr?.split('Output #0')?.[1];
  const [, w, h] = output?.match(/Video:\s.*\s(\d+)x(\d+)\s/) || [];
  log.verbose({ w, h });
  const nanToUndef = (n) => (isNaN(n) ? undefined : n);
  return { width: nanToUndef(parseInt(w)), height: nanToUndef(parseInt(h)) };
};

/**
 * @param {number} chatId
 * @param {fs.PathLike} videoFile
 * @param {number} size
 * @param {number} [width]
 * @param {number} [height]
 * @param {number} [replyTo]
 */
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

/**
 * @param {string} path
 * @param {any} [body]
 */
const telegramApiCall = (path, body) =>
  fetch(
    `https://api.telegram.org/bot${BOT_API_TOKEN}/${path}`,
    body && { method: 'POST', body }
  )
    .then((res) => res.json())
    .then((json) => {
      if (!json.ok) throw new Error(`Telegram API error: ${json.description}`);
      return json;
    });

/**
 * @param {FormData} form
 * @param {import('serverless-telegram').Logger} log
 */
const sendVideo = async (form, log) => {
  log.info('Sending message to telegram server');
  const json = await telegramApiCall('sendVideo', form);
  const fileId = json?.result?.video?.file_id;
  log.verbose('fileId:', fileId);
  return fileId;
};

module.exports = {
  getFilePaths,
  downloadVideo,
  getOutputDimensions,
  createForm,
  telegramApiCall,
  sendVideo,
};
