const filenamify = require('filenamify');
const { existsSync, writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { log, CACHE_DIR } = require('./environment');

/** @param {string} url video URL */
const getPath = (url) => resolve(CACHE_DIR, `${filenamify(url)}.json`);

/** @param {string} url video URL */
exports.read = (url) => {
  const path = getPath(url);
  const data = existsSync(path) && JSON.parse(readFileSync(path, 'utf8'));
  if (data) log.info('Found existing video info for', url, data);
  return data;
};

/** @param {import('../video-post')} post */
exports.write = ({ url, redditUrl, title, fileId }) => {
  if (!fileId) return;
  const path = getPath(url);
  writeFileSync(path, JSON.stringify({ url: redditUrl, title, fileId }));
};
