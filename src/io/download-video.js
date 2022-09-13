const { log, isDev } = require('./environment');
const { stat, access, rm, rename } = require('fs/promises');
const { tmpdir } = require('os');
const { resolve } = require('path');
const youtubedl = require('youtube-dl-exec');
const { constants } = require('fs');
const filenamify = require('filenamify');

const UPDATE_INTERVAL_MS = 1000 * 60 * 60 * 24; // 1 day
/** @type {Date | undefined} */
let lastUpdated;

const shouldUpdate = () => {
  // @ts-ignore
  if (!lastUpdated || lastUpdated < new Date() - UPDATE_INTERVAL_MS) {
    lastUpdated = new Date();
    return true;
  }
};

const exists = async (path) => {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const DOWNLOAD_TIMEOUT = parseInt(process.env.DOWNLOAD_TIMEOUT || '0');

/** @returns {string} */
const getErrorMessage = (url, { stderr, originalMessage, message }) => {
  if (originalMessage === 'Timed out') {
    return `Video download timed out after ${DOWNLOAD_TIMEOUT} seconds`;
  }
  if (!stderr) return originalMessage || message;
  if (stderr.includes('requested format not available')) {
    return `Video too large (> 50 MB) or no supported formats available: ${url}`;
  } else if (stderr.includes('Unable to extract video url')) {
    return `Unable to extract video url from ${url}.`;
  } else {
    return stderr.match(/ERROR: (.*)/)?.[1] || stderr;
  }
};

// Sequence to ensure unique paths during parallel execution
let seq = 0;
// Return an output path in the temp directory based on the current timestamp
const uniqueTempPath = (extension) =>
  resolve(tmpdir(), `${Date.now()}${seq++}.${extension}`);

const vOpts = '[ext=mp4][vcodec!^=?av01]/[ext=gif]';
const format =
  [4, 8, 16, 25]
    .map(
      (audioSize) =>
        `bestvideo${vOpts}[filesize<?${50 - audioSize}M]` +
        `+bestaudio[filesize<?${audioSize}M]`,
    )
    .join('/') + `/best${vOpts}[filesize<?50M]`;

/**
 * @param {import('../video-post')} post Any URL to attempt to download with youtube-dl
 * @param {string} [proxy] optional proxy URL e.g. http://127.0.0.1:8080
 * @returns {Promise<{path: string, infoJson: string} | {error: string}>}
 */
const execYtdl = async (post, proxy) => {
  const output = uniqueTempPath('tmp');

  const url = post.url.toLowerCase().startsWith('http')
    ? post.url
    : `https://${post.url}`;

  try {
    const subprocess = youtubedl.raw(
      url,
      {
        format,
        proxy,
        output,
        writeInfoJson: true,
        noProgress: true,
        mergeOutputFormat: 'mp4',
        recodeVideo: 'mp4',
        // verbose: true,
        update: shouldUpdate(),
      },
      { timeout: DOWNLOAD_TIMEOUT * 1000 },
    );

    subprocess.stdout?.setEncoding('utf-8');
    subprocess.stderr?.setEncoding('utf-8');
    subprocess.stdout?.on('data', (s) => log.debug(s.trim()));
    subprocess.stderr?.on('data', async (s) =>
      post.statusLog(s.trim().replace(/</g, '&lt;')),
    );

    await subprocess;
  } catch (/** @type {any} */ e) {
    log.error(e);
    await rm(output.replace('.tmp', '*')).catch(() => {});
    // @ts-ignore
    return { error: getErrorMessage(url, e) };
  }

  const path = output.replace('.tmp', '.mp4');
  if (!(await exists(path))) await rename(output, path);

  return { path, infoJson: `${output}.info.json` };
};

/**
 * Downloads a video using youtube-dl, returns output file path and other params
 * ready to be passed directly to telegram sendVideo
 * @param {import('../video-post')} post Any URL to attempt to download with youtube-dl
 * @param {string} [httpProxy] optional proxy URL e.g. http://127.0.0.1:8080
 * @returns {Promise<{video: string, size: number, [key: string]: any} | {error: string}>}
 */
const downloadVideo = async (post, httpProxy) => {
  // Use youtube-dl to download the video
  const res = await execYtdl(post, httpProxy);
  if ('error' in res) return { error: res.error };
  const { path, infoJson } = res;

  // Load info from json
  const info = require(infoJson);
  info.resolution = info.resolution || `${info.width}x${info.height}`;
  if (info.title === info.extractor && info.playlist_title) {
    info.title = info.playlist_title;
  }
  if (info.title === info.id) info.title = undefined;

  // Clean up temp file in background (inentionally do not await)
  if (!isDev) rm(infoJson);

  // rename the file to something more sensical before upload
  const video = resolve(
    tmpdir(),
    filenamify(info.title || info.id, { replacement: '_' }) + '.mp4',
  );
  await rename(path, video);

  // get file size from fs
  const { size } = await stat(video);
  info.size = size;

  // log all formats for debugging purposes
  console.table(
    info.formats?.map(({ format, ext, vcodec, acodec, filesize }) => ({
      format,
      ext,
      vcodec,
      acodec,
      mb: filesize / 1024 / 1024,
    })),
  );

  // post.statusLog(`\nvideo id: ${info.extractor}/${info.id}`);

  post.statusLog('Done.\n');

  const logInfo = (key, xform = (x) => x) =>
    info[key] && post.statusLog(`<b>${key}</b>: ${xform(info[key])}`);

  logInfo('title');
  logInfo('duration', (d) => `${Math.round(d)} sec`);
  logInfo('size', (s) => `${(s / 1024 / 1024).toFixed(2)} MB`);
  logInfo('resolution');
  logInfo('vcodec', (v) => `${v} ${info.vbr ? `@ ${info.vbr} kbps` : ''}`);
  logInfo('acodec', (a) => `${a} ${info.abr ? `@ ${info.abr} kbps` : ''}`);

  return {
    video,
    size,
    title: info.title,
    width: info.width,
    height: info.height,
    duration: info.duration,
  };
};

module.exports = {
  downloadVideo,
};
