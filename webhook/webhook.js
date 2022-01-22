const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
// const { wrapAws, awsAdapter } = require('serverless-telegram');
// const { createAwsTelegramWebhook, wrapHttp } = require('serverless-telegram');

const loadEnvOrThrow = (/** @type {string} */ key) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} environment variable not set!`);
  return value;
};

// const loadIntEnvOrThrow = (/** @type {string} */ key) => {
//   const value = loadEnvOrThrow(key);
//   const intValue = parseInt(value);
//   if (isNaN(intValue)) {
//     throw new Error(`${key} env var is not a valid integer: ${value}`);
//   }
//   return intValue;
// };

const client = new LambdaClient({});
const FunctionName = loadEnvOrThrow('INVOKE_FUNCTION_NAME');

// const invoke = async (payload) => {
//   // if (!payload?.urls?.length) return;
//   console.info('Calling', FunctionName, 'with', payload);
//   // const result = await client.send(
//   client.send(
//     new InvokeCommand({
//       FunctionName,
//       // InvocationType: 'Event',
//       Payload: payload === undefined ? payload : JSON.stringify(payload),
//     }),
//   );
//   // console.info('result:', result);
// };

// const urlRegex =
//   /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,63}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g;

// /**
//  * @param {string} [text]
//  * @param {any[]} [entities]
//  */
// const getUrls = (text, entities) =>
//   text &&
//   (entities
//     ?.filter((e) => e.type === 'url')
//     .map((e) => text.substr(e.offset, e.length)) ||
//     [...text?.matchAll(urlRegex)].map((m) => m[0]));

// // Entry point for the AWS lambda when called by the telegram bot API webhook
// exports.default = createAwsTelegramWebhook(
//   {
//     message: ({ text, chat, message_id, entities }) =>
//       invoke({
//         urls: getUrls(text, entities),
//         chatId: chat.id,
//         replyTo: message_id,
//         sendStatus: chat.type === 'private',
//       }),
//     inline: ({ query, id }) => invoke({ urls: getUrls(query), queryId: id }),
//   },
//   loadIntEnvOrThrow('BOT_ERROR_CHAT_ID'),
// );

// exports.default = createAwsTelegramWebhook(
//   {
//     message: (message) => invoke({ message }),
//     inline: (inline) => invoke({ inline }),
//   },
//   loadIntEnvOrThrow('BOT_ERROR_CHAT_ID'),
// );

exports.default = (event) => {
  console.info('Calling', FunctionName, 'with', event.body);
  client.send(
    new InvokeCommand({
      FunctionName,
      InvocationType: 'Event',
      Payload: event.body,
    }),
  );
};

// wrapHttp((/** @type {any} */ update) => {
//   client.send(
//     new InvokeCommand({
//       FunctionName: process.env.INVOKE_FUNCTION_NAME,
//       // InvocationType: 'Event',
//       Payload: update,
//       // ClientContext: ctx,
//     }),
//   );
// }, awsAdapter);
