import knex from "../common/db";
import { Message, MessageReaction } from "discord.js";
import { GetUserIdFromMessage, GetTimestamp } from "../common/utilities";
import { logger } from "../common/logger";

const sleep = ms => new Promise(r => setTimeout(r, 100000));
const DEFAULTPREFIX = "!";

var config: ChannelConfig;
var prefix: string = DEFAULTPREFIX;

export function OnMessage(msg: Message) {
	let args: string[] = msg.content.split(" ");
	if (args.length <= 0) return;

	knex<ChannelConfig>("ChannelConfig")
		.whereNotNull("RollChannelId")
		.andWhere("MediaChannelId", msg.channel.id)
		.orWhere("RollChannelId", msg.channel.id)
		.first()
		.then(configRow => {
			config = configRow;
			prefix = config?.Prefix || DEFAULTPREFIX;
			switch (args[0]) {
				case `${prefix}mediaconfig`:
					Configure(msg, args);
					break;

				case `${prefix}roll`:
					RollMedia(msg, args);
					break;

				default:
					ProcessMessage(msg);
					break;
			}
		});
}

export function OnReactionAdd(reaction: MessageReaction) {}

export function OnReactionDelete(reaction: MessageReaction) {}

function Configure(msg: Message, args: string[]) {
	if (!msg.member.permissions.has("MANAGE_CHANNELS", true)) {
		msg.reply(
			"You are not authorized to configure the media channels. You must have a role that has the 'Manage Channels' permission."
		);
		return;
	}
	if (typeof config === "undefined") {
		ConfigureNew(msg, args);
	} else {
		ConfigureExisting(msg, args);
	}
}

function ConfigureExisting(msg: Message, args: string[]) {
	GetUserIdFromMessage(msg, userId => {
		let chanConfig = GetSettingsFromArgs(config, args);
		try {
			chanConfig = chanConfig as string[];
			if (chanConfig.length > 0) {
				msg.reply(
					`Argument error! Occured at: ${chanConfig.join(", ")}`
				);
				return;
			}
		} catch {}
		let channelConfig = chanConfig as ChannelConfig;
		channelConfig.DateUpdated = GetTimestamp();

		knex<ChannelConfig>("ChannelConfig")
			.update(channelConfig)
			.where("ChannelConfigId", channelConfig.ChannelConfigId)
			.then(() => {
				logger.info(
					`User ${userId} updated channel config. ConfigId: ${channelConfig.ChannelConfigId}`
				);
				msg.reply(`Updated channel config!`);
			});
	});
}

function ConfigureNew(msg: Message, args: string[]) {
	GetUserIdFromMessage(msg, userId => {
		knex<ChannelConfig>("ChannelConfig")
			.whereNull("RollChannelId")
			.andWhere("CreatedBy", userId)
			.first()
			.then(row => {
				if (typeof row === "undefined") {
					let chanConfig = GetSettingsOrDefaultFromArgs(args);

					try {
						chanConfig = chanConfig as string[];
						if (chanConfig.length > 0) {
							msg.reply(
								`Argument error! Occured at: ${chanConfig.join(
									", "
								)}`
							);
							return;
						}
					} catch {}

					chanConfig = chanConfig as ChannelConfig;
					chanConfig.MediaChannelId = msg.channel.id;
					chanConfig.CreatedBy = userId;
					chanConfig.DateCreated = GetTimestamp();
					chanConfig.DateUpdated = GetTimestamp();
					knex<ChannelConfig>("ChannelConfig")
						.insert(chanConfig)
						.then(() => {
							logger.info(
								`Created initial channel config. Waiting for next message from ${userId}`
							);
							msg.reply(
								"Channel set as the media submit channel!\n\nPlease run the same command in the channel you want to roll media."
							);
						});
				} else {
					knex<ChannelConfig>("ChannelConfig")
						.update({
							RollChannelId: msg.channel.id,
							DateUpdated: GetTimestamp(),
						})
						.where("ChannelConfigId", row.ChannelConfigId)
						.then(() => {
							logger.info(
								`Updated channel config. ChannelConfig completed!`
							);
							msg.reply(
								`Channel config completed! This channel will now accept the ${prefix}roll command`
							);
						});
				}
			});
	});
}

function GetSettingsFromArgs(chanConfig: ChannelConfig, args: string[]) {
	let errors: string[] = [];
	args.forEach(a => {
		try {
			switch (a) {
				case "-p":
				case "--prefix":
					if (typeof args[args.indexOf(a) + 1] === "undefined") {
						errors.push(a);
					}
					chanConfig.Prefix = args[args.indexOf(a) + 1];
					break;

				case "-b":
				case "--buffer":
					let buffer = parseFloat(args[args.indexOf(a) + 1]);
					if (isNaN(buffer)) {
						errors.push(a);
						errors.push(args[args.indexOf(a) + 1]);
					}
					chanConfig.BufferPercentage = buffer;
					break;

				case "-max":
				case "--maximum-points":
					let max = parseInt(args[args.indexOf(a) + 1]);
					if (isNaN(max)) {
						errors.push(a);
						errors.push(args[args.indexOf(a) + 1]);
					}
					chanConfig.MaximumPoints = max;
					break;

				case "-min":
				case "--minimum-points":
					let min = parseInt(args[args.indexOf(a) + 1]);
					if (isNaN(min)) {
						errors.push(a);
						errors.push(args[args.indexOf(a) + 1]);
					}
					chanConfig.MinimumPoints = min;
					break;
			}
		} catch {
			errors.push(a);
			errors.push(args[args.indexOf(a) + 1]);
		}
	});

	if (errors.length > 0) {
		return errors;
	} else {
		return chanConfig;
	}
}

function GetSettingsOrDefaultFromArgs(args: string[]) {
	let chanConfig: ChannelConfig = {
		ChannelConfigId: null,
		MediaChannelId: null,
		RollChannelId: null,
		CurrentlyRolling: 0,
		CreatedBy: null,
		DateCreated: null,
		DateUpdated: null,
		Prefix: DEFAULTPREFIX,
		BufferPercentage: 0.75,
		MaximumPoints: 20,
		MinimumPoints: -5,
	};
	return GetSettingsFromArgs(chanConfig, args);
}

function RollMedia(msg: Message, args: string[]) {
	if (
		typeof config === "undefined" ||
		msg.channel.id !== config.RollChannelId
	) {
		msg.reply("Rolling is not configured in this channel.");
		return;
	}
	if (config.CurrentlyRolling == 1) {
		msg.reply("Cant roll twice at once! Wait for the other roll to end.");
		return;
	}

	SetCurrentlyRolling(config.ChannelConfigId, 1);

	let count = Math.abs(parseInt(args[1]) || 1);
	let interval = Math.abs(parseInt(args[2]) || 3);
	msg.channel.send(
		`Rolling ${count} medias with an interval of ${interval} seconds`
	);
	logger.info(
		`Rolling ${count} medias with an interval of ${interval} seconds in channel config ${config.ChannelConfigId}`
	);
	SelectRollableMedia(SendMedia, msg, interval, count, 0);
}

function SendMedia(
	media: Media,
	msg: Message,
	interval: number,
	count: number,
	currentCount: number
) {
	if (typeof media === "undefined") {
		msg.reply(`No media to roll! Please submit some juicy content first`);
		SetCurrentlyRolling(config.ChannelConfigId, 0);
		return;
	}

	if (media.Url.indexOf("cdn.discordapp.com") != -1) {
		msg.channel.send({ file: media.Url }).then(sentMsg => {
			SaveMediaRoll(media, sentMsg as Message, msg);
		});
	} else {
		msg.channel.send(media.Url).then(sentMsg => {
			SaveMediaRoll(media, sentMsg as Message, msg);
		});
	}
	if (currentCount < count)
		setTimeout(function() {
			SelectRollableMedia(SendMedia, msg, interval, count, currentCount);
		}, interval * 1000);
	else {
		SetCurrentlyRolling(config.ChannelConfigId, 0);
	}
}

function SaveMediaRoll(media: Media, mediaMsg: Message, originalMsg: Message) {
	GetUserIdFromMessage(originalMsg, userId => {
		knex<MediaRoll>("MediaRoll")
			.insert({
				MediaId: media.MediaId,
				MessageId: mediaMsg.id,
				CreatedBy: userId,
				DateCreated: GetTimestamp(),
			})
			.then(() =>
				logger.debug(`Saved MediaRoll entry from userId ${userId}`)
			);
	});
}

function SetCurrentlyRolling(configId: number, integer: number) {
	knex<ChannelConfig>("ChannelConfig")
		.update("CurrentlyRolling", integer)
		.where("ChannelConfigId", configId)
		.then(() => logger.info("Finished roll"));
}

function SelectRollableMedia(
	callback: Function,
	msg: Message,
	interval: number,
	count: number,
	currentCount: number
) {
	let bufferCount = 0;
	currentCount++;

	knex<Media>("Media")
		.select("Media.MediaId")
		.sum("IsUpvote as Points")
		.where("ConfigId", config.ChannelConfigId)
		.leftJoin("MediaVote", "Media.MediaId", "MediaVote.MediaId")
		.groupBy("Media.MediaId")
		.having("Points", ">", config.MinimumPoints)
		.orHavingRaw("`Points` is null")
		.then(rows => {
			bufferCount = Math.round(rows.length * config.BufferPercentage);
			if (bufferCount >= rows.length) {
				bufferCount = rows.length - 1;
			}
			knex<Media>("Media")
				.select("Media.MediaId", "Media.Url")
				.sum("IsUpvote as Points")
				.leftJoin(
					knex.raw(
						"(select `MediaId`, `MediaRollId` from `MediaRoll` order by `MediaRollId` desc limit ?) MediaRoll",
						[bufferCount]
					),
					"Media.MediaId",
					"MediaRoll.MediaId"
				)
				.leftJoin("MediaVote", "Media.MediaId", "MediaVote.MediaId")
				.whereNull("MediaRoll.MediaRollId")
				.where("ConfigId", config.ChannelConfigId)
				.groupBy("Media.MediaId")
				.having("Points", ">", config.MinimumPoints)
				.orHavingRaw("`Points` is null")
				.then(rollableMedias => {
					let pointWeightedMedias = [];
					rollableMedias.forEach(rollable => {
						for (
							let i = 0;
							i < rollable.Points + config.MinimumPoints * -1;
							i++
						) {
							pointWeightedMedias.push(rollable);
						}
					});
					let media: Media =
						rollableMedias[
							Math.floor(
								Math.random() * pointWeightedMedias.length
							)
						];
					callback(media, msg, interval, count, currentCount);
				});
		});
}

function ProcessMessage(msg: Message) {
	if (msg.channel.id != config?.MediaChannelId) return;

	GetUserIdFromMessage(msg, userId => {
		msg.attachments.forEach(a => {
			SaveMedia(a.url, msg.id, userId);
		});
	});

	if (msg.content.indexOf("http") != -1) {
		GetUserIdFromMessage(msg, userId => {
			SaveMedia(msg.content, msg.id, userId);
		});
	}
}

function SaveMedia(url: string, messageId: string, userId: number) {
	knex<Media>("Media")
		.insert({
			ConfigId: config.ChannelConfigId,
			Url: url,
			MessageId: messageId,
			CreatedBy: userId,
			DateCreated: GetTimestamp(),
		})
		.then(() => logger.info(`Saved media sent by userId ${userId}`));
}

// Initialize tables

export interface ChannelConfig {
	ChannelConfigId: number;
	Prefix: string;
	MediaChannelId: string;
	RollChannelId: string;
	BufferPercentage: number;
	MaximumPoints: number;
	MinimumPoints: number;
	CurrentlyRolling: number;
	CreatedBy: number;
	DateCreated: number;
	DateUpdated: number;
}

knex.schema.hasTable("ChannelConfig").then(exists => {
	if (!exists) {
		return knex.schema.createTable("ChannelConfig", t => {
			t.increments("ChannelConfigId")
				.primary()
				.unique();
			t.string("Prefix", 100);
			t.string("MediaChannelId");
			t.string("RollChannelId");
			t.decimal("BufferPercentage");
			t.integer("MaximumPoints");
			t.integer("MinimumPoints");
			t.integer("CurrentlyRolling");
			t.integer("CreatedBy");
			t.integer("DateCreated");
			t.integer("DateUpdated");

			t.foreign("CreatedBy")
				.references("UserId")
				.inTable("User");
		});
	}
});

export interface Media {
	MediaId: number;
	ConfigId: number;
	Url: string;
	MessageId: string;
	CreatedBy: number;
	DateCreated: number;
}

knex.schema.hasTable("Media").then(exists => {
	if (!exists) {
		return knex.schema.createTable("Media", t => {
			t.increments("MediaId")
				.primary()
				.unique();
			t.integer("ConfigId");
			t.string("Url");
			t.string("MessageId");
			t.integer("CreatedBy");
			t.integer("DateCreated");

			t.foreign("CreatedBy")
				.references("UserId")
				.inTable("User");

			t.foreign("ConfigId")
				.references("ChannelConfigId")
				.inTable("ChannelConfig");
		});
	}
});

export interface MediaRoll {
	MediaRollId: number;
	MediaId: number;
	MessageId: string;
	CreatedBy: number;
	DateCreated: number;
}

knex.schema.hasTable("MediaRoll").then(exists => {
	if (!exists) {
		return knex.schema.createTable("MediaRoll", t => {
			t.increments("MediaRollId")
				.primary()
				.unique();
			t.integer("MediaId");
			t.string("MessageId");
			t.integer("CreatedBy");
			t.integer("DateCreated");

			t.foreign("CreatedBy")
				.references("UserId")
				.inTable("User");

			t.foreign("MediaId")
				.references("MediaId")
				.inTable("Media");
		});
	}
});

export interface MediaVote {
	MediaVoteId: number;
	MediaId: number;
	MessageId: string;
	IsUpvote: number;
	CreatedBy: number;
	DateCreated: number;
}

knex.schema.hasTable("MediaVote").then(exists => {
	if (!exists) {
		return knex.schema.createTable("MediaVote", t => {
			t.increments("MediaVoteId")
				.primary()
				.unique();
			t.integer("MediaId");
			t.string("MessageId");
			t.integer("IsUpvote");
			t.integer("CreatedBy");
			t.integer("DateCreated");

			t.foreign("CreatedBy")
				.references("UserId")
				.inTable("User");

			t.foreign("MediaId")
				.references("MediaId")
				.inTable("Media");

			t.foreign("MessageId")
				.references("MessageId")
				.inTable("MediaRoll");
		});
	}
});
