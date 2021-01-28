const webhook = require('../src/webhook');
const telegram = require('../src/io/telegram-api');

const log = console.log;
const { debug: verbose, info, warn, error } = console;
Object.assign(log, { verbose, info, warn, error });

/** @param {import('serverless-telegram').HttpResponse} res */
const sendResponse = ({ body } = {}) => {
  const method = body?.method;
  if (method) {
    delete body.method;
    return telegram(method, body);
  } else {
    console.warn('No method found in bot response body:', body);
  }
};

/** @type {number | undefined} */
let offset;

/** @param {import('serverless-telegram').Update} update */
const handleUpdate = async (update) => {
  offset = Math.max(offset || 0, update.update_id + 1) || offset;
  // @ts-ignore
  return webhook({ log }, { body: update }).then(sendResponse);
};

// all times are in ms
// const MIN_WAIT = 1;
// const MAX_WAIT = 1000;
// let wait = MIN_WAIT;
const getUpdates = async () => {
  console.log(new Date());
  const updates = await telegram('getUpdates', { offset, timeout: 60 });
  // process updates in parallel
  await Promise.all(updates.map(handleUpdate));
  // wait = updates.length ? MIN_WAIT : Math.max(1, Math.min(2 * wait, MAX_WAIT));
  setImmediate(getUpdates);
};

getUpdates();
