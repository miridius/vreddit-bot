# VReddit Telegram Bot

A telegram bot which listens for v.redd.it URLs and replies with the video file (including audio)

## Usage

Simply add [@vreddit_bot](https://t.me/vreddit_bot) to any group, or send it a private message containing a v.redd.it link.

## TO DO

### Features:

- [x] Publish an initial working PoC and get feedback
- [x] Broadcast an "upload_video" chat action while the user is waiting
- [x] Support [inline](https://core.telegram.org/bots/api#inline-mode) messages
  - [x] For new videos, send first to "video cache" group to get a file ID
  - [x] 4 options for with/without caption and/or source button
- [x] Support reddit links
- [x] Add reddit post title as video caption
- [x] Include link to source as [inline keyboard](https://core.telegram.org/bots/2-0-intro#new-inline-keyboards)
- [ ] If forwarding to the bot from a group chat, give a button to send the video back to that chat (e.g. via inline)
- [ ] If video is > 50 mb, try to use lower quality stream
- [ ] Reply to /help with a short text about what the bot can do
- [ ] Stop the bot sometimes asking for location info when using inline mode
- [ ] Use youtube-dl to add support for youtube & many other sites
  - Check output for "ERROR: Unsupported URL: https://example.com"
  - Probably need to add FFmpeg to PATH
  - Format opts (in config file?): `-f 'bestvideo[ext=mp4][filesize<?45M]+bestaudio[ext=m4a][filesize<?5M]/best[ext=mp4][filesize<?50M]'`
  - Note that for v.redd.it filesize is not known so we still need to check size of output
- [ ] Use streamable.com for videos between 50-500MB? (max 720p & 10min)

### Implementation details:

- [x] Set up dev tools (eslint, prettier, jest, husky, CI/CD, README)
- [x] CI: Split deploy to stage/prod into separate jobs so we can see the name in the summary.
- [x] Rename repo & npm package to vreddit-bot
- [x] Increase code coverage / add badges
- [x] Local dev server
- [ ] Use async file operations & fix concurrency problems (globally unique file name?)
- [ ] CI: Optimise so that we don't run checks twice on releases?
- [ ] Set up [git-lfs](https://git-lfs.github.com/) to work with husky. See also: [1], [2], [3]
- [ ] Tune Azure max workers param
- [ ] Try other hosting options to see if it's faster and/or cheaper:
  - [ ] Azure x64 Windows host
  - [ ] Azure Linux host
  - [ ] AWS Lambda
  - [ ] Google Cloud Functions
- [ ] Collect stats on inline option chosen?

[1]: https://dev.to/mbelsky/pair-husky-with-git-lfs-in-your-javascript-project-2kh0
[2]: https://github.com/typicode/husky/issues/108
[3]: https://docs.github.com/en/free-pro-team@latest/github/managing-large-files/working-with-large-files

## Development

### Getting Started

1. Prerequisites:

   - Git
   - Node.js v14 (it must be 14 to match the version in Azure/AWS).  
      _Tip: You can install & manage multiple Node versions using tools like [nodist](https://github.com/nullivex/nodist) (Windows) or [n](https://github.com/tj/n) (Linux/MacOS/WSL)_
   - [Yarn](https://yarnpkg.com/)
   - Python (any version, as long as it is on your `PATH` as `python`)
   - An AWS account, with credentials saved in your `~/.aws/credentials` file (see [Loading credentials in Node.js from the shared credentials file](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-shared.html)).

1. `git clone` the repo and `cd` into it

1. Run `yarn install` to install all dependencies

1. Create a `.env` file in the root of the project with the following params:

   ```properties
   AWS_PROFILE=<(optional) credentials profile e.g. personal-account>
   AWS_REGION=<Pick the AWS region closest to you>
   CACHE_TABLE_NAME=video-info-cache-dev

   BOT_API_TOKEN=<your personal dev bot API token>
   BOT_ERROR_CHAT_ID=<(optional) your telegram chat ID>
   ```

   - If you don't konw your telegram chat ID, don't worry. Just set it to 0 and update it later once you've found out your ID from the bot logs.
   - If you don't have a spare bot you can use for local development, make a new bot using the botfather. Don't try use a bot that you are already using for something else, it won't work.

1. Run `yarn dev` to start local dev server. You can now message your dev bot in telegram to test your code.

### Common Commands

```sh
# Run a local bot server connected to the bot configured in the `.env` file:
yarn dev

# Run all tests in watch mode:
yarn test:watch

# Auto fix lint/formatting issues (where possible):
yarn lint:fix

# Run the Azure function locally in watch mode:
yarn start
```

### CI/CD

1. Open a **pull request** to run linting & tests
1. Push to the **master branch** (e.g. merge a PR) to deploy to **staging** ([@staging_vreddit_bot](https://t.me/staging_vreddit_bot))
1. Create a tag by running **`yarn release`** to deploy to **prod** ([@vreddit_bot](https://t.me/vreddit_bot))
