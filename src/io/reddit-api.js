const { default: fetch } = require('node-fetch');
const { log } = require('./environment');

/**
 * Get reddit comments URL from v.redd.it URL
 * @param {string} id - v.redd.it id (the part after the slash)
 * @returns {Promise<string | null>} Link to reddit comments page
 */
exports.getCommentsUrl = (id) => {
  log.info('Getting comments URL for:', id);
  return fetch(`https://www.reddit.com/video/${id}`, {
    redirect: 'manual',
  }).then((r) => r.headers.get('location'));
};

/**
 * get reddit json api data from comments URL
 * @param {string} url
 * @returns {Promise<{title?: string, videoUrl?: string}>}
 */
exports.getPostData = async (url) => {
  log.info('Getting post data for:', url);
  const postData = await fetch(`${url}.json`).then((r) => r.json());
  return {
    title: postData[0]?.data?.children?.[0]?.data?.title,
    videoUrl: postData[0]?.data?.children?.[0]?.data?.url_overridden_by_dest,
  };
};
