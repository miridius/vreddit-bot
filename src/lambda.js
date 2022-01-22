const { default: fetch } = require('node-fetch');
const { wrapTelegram, wrapHttp, awsAdapter } = require('serverless-telegram');
const handler = require('./handler');
const { BOT_ERROR_CHAT_ID, BOT_API_TOKEN } = require('./io/environment');

// TODO - export this from serverless-telegram instead
/** @param {import("serverless-telegram").UpdateResponse | import("serverless-telegram").UpdateResponse[]} [req] */
const callTgApi = async (req) => {
  if (!req) return;
  if (Array.isArray(req)) return Promise.all(req.map(callTgApi));
  const { method, ...params } = req;
  if (!method) throw new Error(`No method in request: ${JSON.stringify(req)}`);
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_API_TOKEN}/${method}`,
    {
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
    },
  );
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram API error: ${json.description}`);
  return json.result;
};

const bodyHandler = wrapTelegram(handler, BOT_ERROR_CHAT_ID);

// lambda entry point
exports.default = async (
  /** @type {import("serverless-telegram").Update} */ body,
  /** @type {import("serverless-telegram").AwsContext} */ ctx,
) => callTgApi(await bodyHandler(body, ctx));

// make a webhook for local dev since we can't use the separate WebhooKFunction
exports.devWebhook = wrapHttp(bodyHandler, awsAdapter);
