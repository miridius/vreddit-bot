# VReddit Telegram Bot

A telegram bot which listens for v.redd.it URLs and replies with the video file (including audio)

## Usage

Simply add [@vreddit_bot](https://t.me/vreddit_bot) to any group, or send it a private message containing a v.redd.it link.

## TO DO

### Features:

- [x] Publish an initial working PoC and get feedback
- [ ] Broadcast an "upload_video" chat action while the user is waiting
- [ ] Support [inline](https://core.telegram.org/bots/api#inline-mode) messages
  - [ ] 2 options for with/without audio
  - [ ] For new videos, send first to "video cache" group to get a file ID
- [ ] Include link to reddit comments as [inline keyboard](https://core.telegram.org/bots/2-0-intro#new-inline-keyboards)
- [ ] Add reddit caption (`json[0].data.children[0].data.title`)
- [ ] Support reddit links (`json[0].data.children[0].data.media||secure_media.reddit_video.dash_url` -> remove query string)
- [ ] If forwarding to the bot from a group chat, give a button to send the video back to that chat (e.g. via inline)
- [ ] If video is > 50 mb, try/offer a lower quality stream
- [ ] Reply to /help with a short text about what the bot can do

### Implementation details:

- [x] Set up dev tools (eslint, prettier, jest, husky, CI/CD, README)
- [x] CI: Split deploy to stage/prod into separate jobs so we can see the name in the summary.
- [ ] CI: Optimise so that we don't run checks twice on releases?
- [ ] Maybe rename repo/npm package to vreddit-bot?
- [ ] Set up [git-lfs](https://git-lfs.github.com/) to work with husky. See also: [1], [2], [3]
- [ ] Tune Azure max workers param
- [ ] Try other hosting options to see if it's faster and/or cheaper:
  - [ ] Azure x64 Windows host
  - [ ] Azure Linux host
  - [ ] AWS Lambda
  - [ ] Google Cloud Functions

[1]: https://dev.to/mbelsky/pair-husky-with-git-lfs-in-your-javascript-project-2kh0
[2]: https://github.com/typicode/husky/issues/108
[3]: https://docs.github.com/en/free-pro-team@latest/github/managing-large-files/working-with-large-files

## Development

### Initial Setup

Prerequisites:

- Git
- Node.js v14 (must be 14 to match the version in Azure)
- Yarn

Clone the repo, `cd` into it, and then run `yarn install` to install dependencies

### Commands

```sh
# Run function locally in watch mode:
yarn start

# Run all tests in watch mode:
yarn test:watch

# Auto fix lint/formatting issues (where possible):
yarn lint:fix
```

### CI/CD

1. Open a **pull request** to run linting & tests
1. Push to the **master branch** (e.g. merge a PR) to deploy to **staging** ([@staging_vreddit_bot](https://t.me/staging_vreddit_bot))
1. Create a tag by running **`yarn release`** to deploy to **prod** ([@vreddit_bot](https://t.me/vreddit_bot))
