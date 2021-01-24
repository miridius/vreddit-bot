const fs = require('fs');
const fetch = require('node-fetch').default;
const FormData = require('form-data');
const { BOT_API_TOKEN } = require('./env');

const API_URL = `https://api.telegram.org/bot${BOT_API_TOKEN}`;

const removeUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/**
 * @param {string} method telegram bot API method
 * @param {Record<string, any>} [params] parameter:value map
 * @param {Record<string, import('fs').PathLike>} [fileParams]
 * parameter:filePath map (for uploading files)
 */
module.exports = async (method, params = {}, fileParams) => {
  params = removeUndefined(params);
  let res;
  if (fileParams) {
    const form = new FormData();
    Object.entries(params).forEach(([k, v]) => form.append(k, v));
    Object.entries(fileParams).forEach(([k, path]) =>
      form.append(k, fs.createReadStream(path))
    );
    // console.log({ form });
    res = await fetch(`${API_URL}/${method}`, { method: 'post', body: form });
  } else {
    res = await fetch(`${API_URL}/${method}?${new URLSearchParams(params)}`);
  }
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram API error: ${json.description}`);
  return json;
};
