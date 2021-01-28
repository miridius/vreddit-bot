const fs = require('fs');
const { default: fetch } = require('node-fetch');
const FormData = require('form-data');
const { BOT_API_TOKEN, log } = require('./environment');

const API_URL = `https://api.telegram.org/bot${BOT_API_TOKEN}`;

/** @param {Record<string, any>} obj */
const processParams = (obj) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]),
  );

/**
 * @param {string} method telegram bot API method
 * @param {Record<string, any>} [params] parameter:value map
 * @param {Record<string, import('fs').PathLike>} [files]
 * parameter:filePath map (for uploading files)
 */
module.exports = async (method, params = {}, files) => {
  params = processParams(params);
  log.info('Calling Telegram API:', method, params);
  let res;
  if (files) {
    log.debug('sending file(s):', files);
    const form = new FormData();
    Object.entries(params).forEach(([k, v]) => form.append(k, v));
    Object.entries(files).forEach(([k, path]) =>
      form.append(k, fs.createReadStream(path)),
    );
    res = await fetch(`${API_URL}/${method}`, { method: 'post', body: form });
  } else {
    res = await fetch(`${API_URL}/${method}?${new URLSearchParams(params)}`);
  }
  if (!res.ok) throw new Error(`Telegram API error: ${res.statusText}`);
  const json = await res.json();
  log.debug('API response:', json);
  if (!json.ok) throw new Error(`Telegram API error: ${json.description}`);
  return json.result;
};
