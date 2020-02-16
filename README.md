# MediaRoll

A TypeScript Discord bot which allows for saving image attachments and links to a database. After which you are able to "roll" a random piece of media from the DB and vote on its quality. High quality media will be more likely to roll, while lower quality will be removed from the pool.

Uses for this inclue a "memes" channel with extra functionality. MediaRoll will save your memes, and allow others to roll them in another channel. Stumble across that meme you loved a year ago once again!

## Installation

Place your bot token in the MEDIABOTDISCORDTOKEN environment variable

In the root folder of MediaBot:

```bash
$ npm install
# npm install typescript -g
$ tsc && node dist/app
```

## Usage

MediaRoll is designed to be simple to use. There are only 2 commands to worry about, the configure command (!media) and the roll command (default !roll)

The media and rolling channels are configured in pairs, so in the channel you are wanting your users to send media to, use `!media config <optional parameters>` and then run `!media config` in the channel you want to be rolling in. They can be the same channel. Thats all! All media sent to the first channel will be saved, and using the !roll command in the other channel, will give you a fresh slice of media.

### !media config

Requires the user to have the "Manage Channels" permission

In the first channel you run this command, you can provide some optional paramaters to customize this specific pair of channels. The order does not matter, but an invalid parameter string will throw an error and not build the channel.

Running this command in an existing channel configuration, will allow you to edit the existing config. Just provide arguments.

#### Parameters

`-p <string>`
`--prefix <string>`

This will change the prefix for commands used in these channels.

Default: "!"

`-b <decimal>`
`--buffer <decimal>`

This will set the percentage size of the buffer based on the size of the pool.

Default: 0.50

`-max <int>`
`--maximum-points <int>`

This is the maximum amount of points media can receive.

Default: 20

`-min <int>`
`--minimum-points <int>`

This is the threshold where something is removed from the pool. Must be less than 0.

Default: -5

`-u <emoji>`
`--upvote-emoji <emoji>`
This is the emoji used for upvoting media. Must not be an external server's emoji.

Default: 👍

`-d <emoji>`
`--downvote-emoji <emoji>`

This is the emoji used for downvoting media. Must not be an external server's emoji.

Default: 👎

`r <string>`
`--roll-command <string>`

This is the command used for rolling media.

Default: "roll"

### !media delete

Requires the user to have the "Manage Channels" permission

This deletes the channel pair you are currently in. Will ask for confirmation first.

### !roll

This only works in a roll channel, and will roll you some random media.

The roll command accepts two positional arguments, `!roll <count> <interval>` Count being the amount of media to roll, and interval being the amount of seconds between each roll. There is a maximum of 300 seconds total.

## How does it work?

When someone sends a message containing media to the media channel, MediaRoll saves it to it's database.

If someone then uses the roll command for the corresponding roll channel, MediaRoll will send a randomly selected media from the database to that channel. It will track what its sent, and then react with the upvote and downvote emojis to encourage others to vote.

When media is rolled, MediaRoll takes all the available entries and adds them to a "drawing pool" giving each media one ticket for every point above the minimum they have. This means that the more upvoted media is, the more likely it will be rolled, and for the more downvoted, the reverse is true.

However not all media is included for every roll. Once something is rolled, it is then added to the recently rolled list. A buffer size exists that is a percentage of the total available media count. 0.00 to 0.99. So if there is 10 media items in the database, and the buffer percentage is 0.5, then the most recent 5 items rolled, will not be candidates for the next roll. As we cycle through them though, they will be pushed out of the buffer, and available to roll once again. This allows for us to keep the media sent as fresh as possible.

## Contact

Hope you enjoy this bot! I've had a lot of fun writing it. If you have any questions or suggestions, feel free to open an issue, pull request, or hit me up at Seka#2893

Thanks!
