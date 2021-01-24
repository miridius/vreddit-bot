const { createAzureTelegramWebhook } = require('serverless-telegram');
const handler = require('./handler');
const { BOT_ERROR_CHAT_ID } = require('./env');

// Entry point for the Azure function
module.exports = createAzureTelegramWebhook(handler, BOT_ERROR_CHAT_ID);
