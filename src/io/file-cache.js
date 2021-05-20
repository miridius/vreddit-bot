const { existsSync, writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { CACHE_DIR } = require('./environment');

/** @param {string} id video ID */
const getPath = (id) => resolve(CACHE_DIR, `${id}.json`);

/** @param {string} id video ID */
exports.read = (id) => {
  const path = getPath(id);
  return existsSync(path) && JSON.parse(readFileSync(path, 'utf8'));
};

/** @param {import('../video-post')} post */
exports.write = ({ id, url, title, fileId }) => {
  // if the video is not sent we can skip caching (it will happen again later)
  if (!fileId) return;
  writeFileSync(getPath(id), JSON.stringify({ url, title, fileId }));
};
