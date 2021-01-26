const { existsSync, writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { log, CACHE_DIR } = require('./environment');

/** @param {string} id video ID */
const getPath = (id) => resolve(CACHE_DIR, `${id}.json`);

/** @param {string} id video ID */
exports.read = (id) => {
  const path = getPath(id);
  const data = existsSync(path) && JSON.parse(readFileSync(path, 'utf8'));
  if (data) log.info('Found existing video info for', id, data);
  return data;
};

/** @param {import('../video-post')} post */
exports.write = ({ id, url, title, fileId }) => {
  if (!fileId) return;
  const path = getPath(id);
  writeFileSync(path, JSON.stringify({ url, title, fileId }));
};
