require('../helpers');
const { getCommentsUrl, getPostData } = require('../../src/io/reddit-api');

const nock = require('nock');
const filenamify = require('filenamify');

nock.back.fixtures = __dirname + '/__fixtures__/';
nock.back.setMode(process.env.CI ? 'lockdown' : 'record');

// Use nock.back to mock all HTTP requests (if any) for each test
beforeEach(async () => {
  const state = expect.getState();
  state.nockBack = await nock.back(`${filenamify(state.currentTestName)}.json`);
});

afterEach(() => {
  const { nockBack } = expect.getState();
  nockBack.nockDone();
  nockBack.context.assertScopesFinished();
});

afterAll(nock.restore);

const ids = ['nsjjyr5avwa61', 'rk2repuuvc261', 's090h1f828b61'];

const redditUrls = [
  'https://www.reddit.com/r/JusticeServed/comments/kvsocf/as_you_know_madness_is_like_gravityall_it_takes/',
  'https://www.reddit.com/r/blackmagicfuckery/comments/k3tisl/wait_a_minute_0_o/',
  'https://www.reddit.com/r/AnimalsBeingDerps/comments/kwxvu7/blah_blah_blah_blah/',
];

const titles = [
  '“As you know, madness is like gravity...all it takes is a little push.” ― The Joker',
  'Wait a minute 0_o',
  'Blah blah blah blah...',
];

describe('reddit-api', () => {
  ids.forEach((id, i) => {
    const url = redditUrls[i];

    it(`getCommentsUrl - ${id}`, () =>
      expect(getCommentsUrl(id)).resolves.toEqual(url));

    let postData;
    it(`getPostData - ${url}`, async () => {
      postData = await getPostData(url);
      expect(postData).toEqual({
        title: titles[i],
        videoUrl: `https://v.redd.it/${id}`,
      });
    });
  });
});
