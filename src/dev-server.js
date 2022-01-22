const { default: fetch } = require('node-fetch');

const getUpdatesRequest = {
  timeout: 55,
  allowed_updates: [
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'inline_query',
  ],
};

const token = process.env.BOT_API_TOKEN;
if (!token) throw new Error('BOT_API_TOKEN environment variable not set!');
const tgApiUrl = `https://api.telegram.org/bot${token}/getUpdates`;

const localApiUrl = 'http://localhost:3000/webhook';

let offset = 0;
const updateOffset = (update) => {
  if (!update) return;
  const newOffset = Math.max(offset, update.update_id + 1);
  if (isNaN(newOffset)) return;
  offset = newOffset;
};

const postJson = (url, json) =>
  fetch(url, {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });

const getUpdates = async () => {
  console.debug(`long polling for updates with offset: ${offset}`);
  const res = await postJson(tgApiUrl, { ...getUpdatesRequest, offset });
  const json = await res.json();
  const updates = json.result;
  updates.length && console.log('updates:', updates);
  for (const update of updates) {
    updateOffset(update);
    postJson(localApiUrl, update)
      .then((res) => res.text())
      .then((text) => console.log(`response to ${update.update_id}:`, text));
  }
  setImmediate(getUpdates);
};

getUpdates();
