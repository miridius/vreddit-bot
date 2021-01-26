const { createAzureTelegramWebhook } = require('serverless-telegram');
const handler = require('./handler');
const { BOT_ERROR_CHAT_ID } = require('./io/environment');

// Entry point for the Azure function
module.exports = createAzureTelegramWebhook(handler, BOT_ERROR_CHAT_ID);
