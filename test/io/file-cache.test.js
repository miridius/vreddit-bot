/* eslint-disable jest/expect-expect */
const { withFnMocks, setDefaultImpls, mocked, env } = require('../helpers');
const cache = require('../../src/io/file-cache');
const VideoPost = require('../../src/video-post');
const { resolve } = require('path');
const { CACHE_DIR } = require('../../src/io/environment');

jest.mock('fs');
const fs = mocked(require('fs'));

beforeEach(() => {
  jest.resetAllMocks();
  setDefaultImpls(fs);
});

// TEST DATA
const id = 'id';
const url = 'url';
const title = 'title';
const fileId = 'fileId';
const data = { url, title, fileId };
const dataString = JSON.stringify(data);

const path = resolve(CACHE_DIR, `${id}.json`);

describe('cache', () => {
  it('reads pre-existing files', () => {
    withFnMocks(
      () => expect(cache.read(id)).toEqual(data),
      [fs.existsSync, [path], true],
      [fs.readFileSync, [path, 'utf8'], dataString],
    );
  });
  it('returns false for non-existant files', () => {
    withFnMocks(
      () => expect(cache.read(id)).toBe(false),
      [fs.existsSync, [path], false],
    );
  });
  it('caches new data', () => {
    withFnMocks(
      () => cache.write(new VideoPost(env, id, url, title, fileId)),
      [fs.existsSync, [path], false],
      [fs.writeFileSync, [path, dataString]],
    );
  });
  it('updates & invalidates existing cache', () => {
    const url = 'url';
    const title = 'title';
    const fileId = 'fileId';
    withFnMocks(
      () => cache.write(new VideoPost(env, id, url, title, fileId)),
      [fs.existsSync, [path], true],
      [fs.readFileSync, [path, 'utf8'], dataString],
      [fs.writeFileSync, [path, JSON.stringify({ url, title, fileId })]],
    );
  });
  it('skips caching if no fileId is available', () => {
    withFnMocks(
      () => cache.write(new VideoPost(env, id, url, title)),
      [fs.existsSync, [path], false],
    );
  });
});
