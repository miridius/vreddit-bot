const {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} = require('@aws-sdk/client-dynamodb');
const { log, CACHE_TABLE_NAME } = require('./environment');

const ddbClient = new DynamoDBClient({});

const fromAttrVals = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.S]));

const toAttrVals = (obj) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, { S: v }]),
  );

/** @param {string} url video URL */
exports.read = async (url) => {
  if (!url) return;
  const data = await ddbClient.send(
    new GetItemCommand({
      TableName: CACHE_TABLE_NAME,
      Key: toAttrVals({ url }),
      ProjectionExpression: 'sourceUrl,title,fileId',
    }),
  );
  const info = data?.Item && fromAttrVals(data.Item);
  if (info) log.debug('Loaded cached video info:', { url, ...info });
  return info;
};

/** @param {import('../video-post')} post */
exports.write = async ({ url, sourceUrl, title, fileId }) => {
  if (!fileId) return;
  try {
    await ddbClient.send(
      new PutItemCommand({
        TableName: CACHE_TABLE_NAME,
        Item: toAttrVals({ url, sourceUrl, title, fileId }),
      }),
    );
    log.debug('Saved cached video info:', { url, sourceUrl, title, fileId });
  } catch (err) {
    log.error(err);
  }
};
