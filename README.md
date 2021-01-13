# VReddit Telegram

A telegram bot which listens for v.redd.it URLs and replies with the video file (including audio)

## Usage

Simply add [@vreddit_bot](https://t.me/vreddit_bot) to any group, or send it a private message containing a v.redd.it link.

## TO DO

- [x] Publish an initial working PoC and get feedback
- [x] Set up dev tools (eslint, prettier, jest, husky, CI/CD, README)
- [ ] Broadcast an "upload_video" chat action while the user is waiting
- [ ] Support inline messages
  - [ ] 2 options for with/without audio
  - [ ] For new videos, send first to "video cache" group to get a file ID
- [ ] Include link to reddit comments as inline keyboard
- [ ] If forwarding to the bot from a group chat, give a button to send the video back to that chat (e.g. via inline)
- [ ] If video is > 50 mb, try/offer a lower quality stream
- [ ] Tune max workers param
- [ ] Try other hosting options to see if it's faster and/or cheaper:
  - [ ] Azure x64 Windows host
  - [ ] Azure Linux host
  - [ ] AWS Lambda
  - [ ] Google Cloud Functions

## Development

Requires:

- Node.js 14 (to match the version in Azure)
- Yarn

```sh
# Run function locally in watch mode:
yarn start        # or npm start

# Run all tests in watch mode:
yarn test:watch   # or npm run test:watch

# Fix lint/formatting issues (where possible)
yarn lint:fix
```

## Deployment

1. Push to the **master branch** to deploy to **staging** ([@staging_vreddit_bot](https://t.me/staging_vreddit_bot))
1. Create a tag by running **`yarn release`** to deploy to **prod** ([@vreddit_bot](https://t.me/vreddit_bot))
