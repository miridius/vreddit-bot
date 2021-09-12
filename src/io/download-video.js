const { log, FFMPEG } = require('./environment');
const { exec } = require('child_process');
const { existsSync, unlinkSync, statSync } = require('fs');
const { tmpdir } = require('os');
const { resolve } = require('path');
const filenamify = require('filenamify');

/** @param {import('fs').PathLike} videoFile */
const deleteIfExisting = (videoFile) => {
  if (existsSync(videoFile)) {
    log.warn(`${videoFile} already exists, attempting to delete`);
    unlinkSync(videoFile);
  }
};

/**
 * @param {string} id video ID
 * @param {any} outputFile full path to save the video to
 * @param {string} [httpProxy] optional proxy URL e.g. http://127.0.0.1:8080
 */
const execFFmpeg = (id, outputFile, httpProxy) => {
  const scheme = httpProxy ? 'http' : 'https';
  const dashUrl = `${scheme}://v.redd.it/${id}/DASHPlaylist.mpd`;
  httpProxy = httpProxy ? `-http_proxy ${httpProxy}` : '';
  log.info('Saving:', dashUrl, 'to:', outputFile, 'using:', FFMPEG, httpProxy);
  return new Promise((resolve, reject) =>
    exec(
      `${FFMPEG} ${httpProxy} -i "${dashUrl}" -c copy ${outputFile}`,
      (err, stdout, stderr) => {
        if (err) reject(err);
        log.debug(`stdout: ${stdout}`);
        log.debug(`stderr: ${stderr}`);
        resolve(stderr);
      },
    ),
  );
};

/** @param {number} n */
const nanToUndef = (n) => (isNaN(n) ? undefined : n);

/** @param {string} ffmpegStderr */
const getOutputDimensions = (ffmpegStderr) => {
  const output = ffmpegStderr?.split('Output #0')?.[1];
  const [, w, h] = output?.match(/Video:\s.*\s(\d+)x(\d+)\s/) || [];
  return { width: nanToUndef(parseInt(w)), height: nanToUndef(parseInt(h)) };
};

/**
 * Downloads a video using ffmpeg, returns the output path and some statistics
 * @param {import('../video-post')} post VideoPost created from a URL (which may or may not be a video)
 * @param {string} [httpProxy] optional proxy URL e.g. http://127.0.0.1:8080
 * @returns {Promise<{path: string, width?: number, height?: number, size: number} | void>}
 */
const downloadVideo = async (post, httpProxy) => {
  const id = post.getVredditId();
  // only v.redd.it URLs are supported currently
  if (!id) return;
  // Define a temp file path based on the video URL
  const path = resolve(tmpdir(), `${filenamify(post.url)}.mp4`);
  // Delete the video if it exists in case it is from a failed previous execution
  deleteIfExisting(path);
  // Use ffmpeg to save the video to a temp file at source quality
  const ffmpegStderr = await execFFmpeg(id, path, httpProxy);
  // Get video dimensions from ffmpeg output
  const { width, height } = getOutputDimensions(ffmpegStderr);
  const { size } = statSync(path);
  log.debug({ path, width, height, size });
  return { path, width, height, size };
};

module.exports = {
  deleteIfExisting,
  execFFmpeg,
  downloadVideo,
  getOutputDimensions,
};
