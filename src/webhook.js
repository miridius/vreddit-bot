const { createAwsTelegramWebhook } = require('serverless-telegram');
const handler = require('./handler');
const { BOT_ERROR_CHAT_ID } = require('./io/environment');

// Entry point for the AWS lambda
exports.webhook = createAwsTelegramWebhook(handler, BOT_ERROR_CHAT_ID);
