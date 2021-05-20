const { default: fetch } = require('node-fetch');

/**
 * Get reddit comments URL from v.redd.it URL
 * @param {Pick<import('../video-post'), 'env' | 'id'>} post
 * @returns {Promise<string | null>} Link to reddit comments page
 */
exports.getCommentsUrl = async ({ env, id }) => {
  env.info('Getting comments URL for:', id);
  const res = await fetch(`https://www.reddit.com/video/${id}`, {
    redirect: 'manual',
  });
  return res.headers.get('location');
};

//  * @param {{env: import('serverless-telegram').Env, url: string}} post

/**
 * get reddit json api data from comments URL
 * @param {Pick<import('../video-post'), 'env' | 'url'>} post
 * @returns {Promise<{title?: string, videoUrl?: string}>}
 */
exports.getPostData = async ({ env, url }) => {
  env.info('Getting post data for:', url);
  const postData = await fetch(`${url}.json`).then((r) => r.json());
  return {
    title: postData[0]?.data?.children?.[0]?.data?.title,
    videoUrl: postData[0]?.data?.children?.[0]?.data?.url_overridden_by_dest,
  };
};
