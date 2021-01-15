//@ts-check
const os = require('os');
const { resolve } = require('path');

// limit imposed by telegram API
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// string describing the runtime OS
const OS_INFO = [os.platform(), os.arch(), os.type(), os.version()].join(' ');

// path to ffmpeg executable
const fileExtension = os.platform().startsWith('win') ? '.exe' : '';
const FFMPEG = resolve(__dirname, `../ffmpeg/bin/ffmpeg${fileExtension}`);

// Secrets loaded from environment variables, throws an error if any are missing
const loadEnvOrThrow = (k) => {
  if (!process.env[k]) throw new Error(`${k} environment variable not set!`);
  return process.env[k];
};
const BOT_API_TOKEN = loadEnvOrThrow('BOT_API_TOKEN');
const BOT_ERROR_CHAT_ID = parseInt(loadEnvOrThrow('BOT_ERROR_CHAT_ID'));
if (isNaN(BOT_ERROR_CHAT_ID)) {
  throw new Error(`BOT_ERROR_CHAT_ID env var is not a valid integer`);
}

module.exports = {
  BOT_API_TOKEN,
  BOT_ERROR_CHAT_ID,
  FFMPEG,
  MAX_FILE_SIZE_BYTES,
  OS_INFO,
};
