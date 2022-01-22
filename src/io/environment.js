const { log } = require('console');
const os = require('os');

// Load constants from environment variables, throw an error if they are missing
const loadEnvOrThrow = (/** @type {string} */ key) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} environment variable not set!`);
  return value;
};

const loadIntEnvOrThrow = (/** @type {string} */ key) => {
  const value = loadEnvOrThrow(key);
  const intValue = parseInt(value);
  if (isNaN(intValue)) {
    throw new Error(`${key} env var is not a valid integer: ${value}`);
  }
  return intValue;
};

exports.BOT_API_TOKEN = loadEnvOrThrow('BOT_API_TOKEN');
exports.BOT_ERROR_CHAT_ID = loadIntEnvOrThrow('BOT_ERROR_CHAT_ID');
// make sure chat ID is a number
exports.CACHE_TABLE_NAME = loadEnvOrThrow('CACHE_TABLE_NAME');
// limit imposed by telegram API
exports.MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// string describing the runtime OS
exports.OS_INFO = `${os.platform()} ${os.arch()} (${os.type()} ${os.version()})`;

// Add path to ffmpeg executable
process.env.PATH += ':./ffmpeg/bin';
// const fileExtension = os.platform().startsWith('win') ? '.exe' : '';
// const FFMPEG =
//   process.env.FFMPEG ||
//   resolve(__dirname, `../../ffmpeg/bin/ffmpeg${fileExtension}`);

/** @type {import('serverless-telegram').Chat} */
exports.CACHE_CHAT = {
  id: -375023585,
  title: 'V.redd.it Video Cache',
  type: 'group',
  all_members_are_administrators: true,
};

const { debug, info, warn, error } = console;
exports.log = { debug, info, warn, error };

/**
 * @param {import('serverless-telegram').Logger} logger
 */
exports.setLogMethods = ({ debug, info, warn, error }) => {
  Object.assign(log, { debug, info, warn, error });
};

exports.isDev = process.env.NODE_ENV !== 'PRODUCTION';
