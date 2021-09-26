const os = require('os');

// limit imposed by telegram API
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// string describing the runtime OS
const OS_INFO = `${os.platform()} ${os.arch()} (${os.type()} ${os.version()})`;

// Add path to ffmpeg executable
process.env.PATH += ':./ffmpeg/bin';
// const fileExtension = os.platform().startsWith('win') ? '.exe' : '';
// const FFMPEG =
//   process.env.FFMPEG ||
//   resolve(__dirname, `../../ffmpeg/bin/ffmpeg${fileExtension}`);

// Load constants from environment variables, throw an error if they are missing
/**
 * @param {string} key
 */
const loadEnvOrThrow = (key, toInteger = false) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} environment variable not set!`);
  if (toInteger) {
    const intValue = parseInt(value);
    if (isNaN(intValue)) {
      throw new Error(`${key} env var is not a valid integer: ${value}`);
    }
    return intValue;
  }
  return value;
};
const BOT_API_TOKEN = loadEnvOrThrow('BOT_API_TOKEN');
const BOT_ERROR_CHAT_ID = loadEnvOrThrow('BOT_ERROR_CHAT_ID', true);
// make sure chat ID is a number
const CACHE_TABLE_NAME = loadEnvOrThrow('CACHE_TABLE_NAME');

/** @type {import('serverless-telegram').Chat} */
const CACHE_CHAT = {
  id: -375023585,
  title: 'V.redd.it Video Cache',
  type: 'group',
  all_members_are_administrators: true,
};

const { debug, info, warn, error } = console;
const log = { debug, info, warn, error };

/**
 * @param {import('serverless-telegram').Logger} logger
 */
const setLogMethods = ({ debug, info, warn, error }) => {
  Object.assign(log, { debug, info, warn, error });
};

module.exports = {
  BOT_API_TOKEN,
  BOT_ERROR_CHAT_ID,
  CACHE_CHAT,
  CACHE_TABLE_NAME,
  MAX_FILE_SIZE_BYTES,
  OS_INFO,
  log,
  setLogMethods,
};
