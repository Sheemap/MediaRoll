import knex from "../common/db";
import { Message, MessageReaction, User, TextChannel } from "discord.js";
import {
	GetUserIdFromMessage,
	GetTimestamp,
	GetUserIdFromDiscordId,
} from "../common/utilities";
import { logger } from "../common/logger";

const DEFAULTPREFIX = "!";
const MAXROLLSECONDS = 300;

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
		.then((configRow) => {
			config = configRow;
			prefix = config?.Prefix || DEFAULTPREFIX;
			let rollCommand = config?.RollCommand || "roll";
			switch (args[0]) {
				case `${prefix}media`:
					MediaRoute(msg, args);
					break;

				case `${prefix}${rollCommand}`:
					RollMedia(msg, args);
					break;

				default:
					ProcessMessage(msg);
					break;
			}
		});
}

export function OnReactionAdd(reaction: MessageReaction, user: User) {
	if (typeof config === "undefined") return;

	if (reaction.emoji.toString() === config.UpvoteEmoji) {
		AddMediaVoteFromMessage(true, reaction.message, user);
		return;
	}

	if (reaction.emoji.toString() === config.DownvoteEmoji) {
		AddMediaVoteFromMessage(false, reaction.message, user);
		return;
	}
}

export function OnReactionDelete(reaction: MessageReaction, user: User) {
	if (typeof config === "undefined") return;

	if (reaction.emoji.toString() === config.UpvoteEmoji) {
		DeleteMediaVoteFromMessage(true, reaction.message, user);
		return;
	}

	if (reaction.emoji.toString() === config.DownvoteEmoji) {
		DeleteMediaVoteFromMessage(false, reaction.message, user);
		return;
	}
}

function MediaRoute(msg: Message, args: string[]) {
	if (!msg.member.permissions.has("MANAGE_CHANNELS", true)) {
		msg.reply(
			"You are not authorized to configure the media channels. You must have a role that has the 'Manage Channels' permission."
		);
		return;
	}

	switch (args[1]) {
		case `config`:
		case `configure`:
			Configure(msg, args);
			break;

		case `delete`:
			DeleteConfig(msg);
			break;
	}
}

function DeleteMediaVoteFromMessage(
	IsUpvote: boolean,
	msg: Message,
	user: User
) {
	GetUserIdFromDiscordId(msg.guild.id, user.id, (userId) => {
		let voteWeight = IsUpvote ? 1 : -1;
		knex<MediaVote>("MediaVote")
			.select("MediaVoteId")
			.where("MessageId", msg.id)
			.andWhere("CreatedBy", userId)
			.andWhere("IsUpvote", voteWeight)
			.orderBy("MediaVoteId", "desc")
			.first()
			.then((mediaVote) => {
				if (typeof mediaVote === "undefined") return;

				knex<MediaVote>("MediaVote")
					.where("MediaVoteId", mediaVote.MediaVoteId)
					.delete()
					.then(() => {});
			});
	});
}

function AddMediaVoteFromMessage(IsUpvote: boolean, msg: Message, user: User) {
	GetUserIdFromDiscordId(msg.guild.id, user.id, (userId) => {
		knex<MediaRoll>("MediaRoll")
			.select("MediaRoll.MediaId")
			.sum("MediaVote.IsUpvote as Points")
			.leftJoin<MediaVote>(
				"MediaVote",
				"MediaRoll.MediaId",
				"MediaVote.MediaId"
			)
			.where("MediaRoll.MessageId", msg.id)
			.groupBy("MediaRoll.MediaId")
			.first()
			.then((media) => {
				if (typeof media === "undefined") {
					logger.warn(
						`Unknown error occured. Tried to add a vote on a non-existant message. MessageId: ${msg.id}, UserId: ${userId}`
					);
					return;
				}
				if (media.Points >= config.MaximumPoints) {
					logger.info(`${media.MediaId} reached maximum points.`);
					return;
				}

				let voteWeight = IsUpvote ? 1 : -1;

				knex<MediaVote>("MediaVote")
					.insert({
						MediaId: media.MediaId,
						MessageId: msg.id,
						IsUpvote: voteWeight,
						CreatedBy: userId,
						DateCreated: GetTimestamp(),
					})
					.then(() => {
						logger.info(
							`Recorded vote of ${voteWeight} on media ${media.MediaId} by userId ${userId}`
						);
					});
			});
	});
}

function Configure(msg: Message, args: string[]) {
	if (typeof config === "undefined") {
		ConfigureNew(msg, args);
	} else {
		ConfigureExisting(msg, args);
	}
}

function DeleteConfig(msg: Message) {
	msg.reply(
		`Are you sure you want to delete this config? React with '👌' if so`
	).then((sentMsg) => {
		let filter = (reaction, user) =>
			(reaction.emoji.name = "👌" && user.id == msg.author.id);
		sentMsg = sentMsg as Message;
		sentMsg
			.awaitReactions(filter, {
				max: 1,
				time: 10000,
			})
			.then((collected) => {
				if (collected.size > 0) {
					knex<ChannelConfig>("ChannelConfig")
						.where("ChannelConfigId", config.ChannelConfigId)
						.delete()
						.then(() => {
							logger.info(
								`Discord user ${msg.author.id} deleted ChannelConfig ${config.ChannelConfigId}.`
							);
							msg.channel.send("Channel config deleted");
						});
				} else {
					msg.channel.send("Timeout reached, not deleting channel");
				}
			});
	});
}

function ConfigureExisting(msg: Message, args: string[]) {
	GetUserIdFromMessage(msg, (userId) => {
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
	GetUserIdFromMessage(msg, (userId) => {
		knex<ChannelConfig>("ChannelConfig")
			.whereNull("RollChannelId")
			.andWhere("CreatedBy", userId)
			.first()
			.then((row) => {
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
								`Channel config completed! This channel will now accept the ${prefix}${row.RollCommand} command.\n\nWould you like to process the past 100 messages to find media? React with '👌' if so.`
							).then((sentMsg) => {
								let filter = (reaction, user) =>
									(reaction.emoji.name =
										"👌" && user.id == msg.author.id);
								sentMsg = sentMsg as Message;
								sentMsg
									.awaitReactions(filter, {
										max: 1,
										time: 10000,
									})
									.then((collected) => {
										if (collected.size > 0) {
											msg.channel.send(
												"Will attempt to import previous media, "
											);
											knex<ChannelConfig>("ChannelConfig")
												.whereNotNull("RollChannelId")
												.andWhere(
													"MediaChannelId",
													msg.channel.id
												)
												.orWhere(
													"RollChannelId",
													msg.channel.id
												)
												.first()
												.then((configRow) => {
													config = configRow;
													let mediaChannel = msg.guild.channels.find(
														(x) =>
															x.id ==
															config.MediaChannelId
													) as TextChannel;
													mediaChannel
														.fetchMessages({
															limit: 100,
														})
														.then((messages) => {
															messages.forEach(
																(message) => {
																	ProcessMessage(
																		message
																	);
																}
															);
														});
												});
										} else {
											msg.channel.send(
												"Timeout reached, not importing previous"
											);
										}
									});
							});
						});
				}
			});
	});
}

function GetSettingsFromArgs(chanConfig: ChannelConfig, args: string[]) {
	let errors: string[] = [];
	args.forEach((a) => {
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
					} else if (min >= 0) {
						errors.push(a);
						errors.push("Minimum points must be less than than 0");
					}
					chanConfig.MinimumPoints = min;
					break;

				case "-u":
				case "--upvote-emoji":
					if (typeof args[args.indexOf(a) + 1] === "undefined") {
						errors.push(a);
					}
					let upEmoji = args[args.indexOf(a) + 1];
					chanConfig.UpvoteEmoji = upEmoji;
					break;

				case "-d":
				case "--downvote-emoji":
					if (typeof args[args.indexOf(a) + 1] === "undefined") {
						errors.push(a);
					}
					let downEmoji = args[args.indexOf(a) + 1];
					chanConfig.DownvoteEmoji = downEmoji;
					break;

				case "-r":
				case "--roll-command":
					if (typeof args[args.indexOf(a) + 1] === "undefined") {
						errors.push(a);
					}
					let rollCommand = args[args.indexOf(a) + 1];
					chanConfig.RollCommand = rollCommand;
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
		UpvoteEmoji: "👍",
		DownvoteEmoji: "👎",
		RollCommand: "roll",
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
	if (config.CurrentlyRolling > GetTimestamp()) {
		msg.reply("Can't roll twice at once! Wait for the other roll to end.");
		return;
	}

	let count = Math.abs(parseInt(args[1]) || 1);
	let interval = Math.abs(parseInt(args[2]) || 3);
	if (interval * count > MAXROLLSECONDS) {
		msg.channel.send(
			`Rolling this many medias would take longer than the max of ${MAXROLLSECONDS} seconds! Please roll fewer medias, or decrease the interval.`
		);
		return;
	}

	SetCurrentlyRolling(config.ChannelConfigId, interval * (count - 1));

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

	let content;
	if (
		media.Url.indexOf("cdn.discordapp.com") != -1 ||
		media.Url.indexOf("i.imgur.com") != -1
	) {
		content = { file: media.Url };
	} else {
		content = media.Url;
	}

	let success = true;
	msg.channel
		.send(content)
		.then((sent) => {
			let sentMsg = sent as Message;
			SaveMediaRoll(media, sentMsg, msg);
			AddVotingEmojisToMessage(sentMsg);
		})
		.catch(() => {
			logger.error(
				`Encountered error when attempting to send media id '${media.MediaId}'`
			);
			success = false;
			currentCount--;
		})
		.then(() => {
			TrackMediaError(media, success).then(() => {
				if (currentCount < count)
					setTimeout(function () {
						SelectRollableMedia(
							SendMedia,
							msg,
							interval,
							count,
							currentCount
						);
					}, interval * 1000);
				else {
					SetCurrentlyRolling(config.ChannelConfigId, 0);
				}
			});
		});
}

function AddVotingEmojisToMessage(msg: Message) {
	let upEmoji = msg.guild.emojis.find(
		(x) => x.toString() == config.UpvoteEmoji
	);
	let downEmoji = msg.guild.emojis.find(
		(x) => x.toString() == config.DownvoteEmoji
	);
	let trueUpEmoji = upEmoji || config.UpvoteEmoji;
	let trueDownEmoji = downEmoji || config.DownvoteEmoji;

	msg.react(trueUpEmoji).then(() => msg.react(trueDownEmoji));
}

function SaveMediaRoll(media: Media, mediaMsg: Message, originalMsg: Message) {
	GetUserIdFromMessage(originalMsg, (userId) => {
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

async function TrackMediaError(media: Media, isSuccess: boolean) {
	const row = await knex<Media>("Media")
		.select("Media.ErrorCount")
		.where("MediaId", media.MediaId)
		.first();
	let newCount = isSuccess ? 0 : ++row.ErrorCount;
	await knex<Media>("Media")
		.update("ErrorCount", newCount)
		.where("MediaId", media.MediaId);
}

function SetCurrentlyRolling(configId: number, durationSeconds: number) {
	knex<ChannelConfig>("ChannelConfig")
		.update("CurrentlyRolling", GetTimestamp() + durationSeconds)
		.where("ChannelConfigId", configId);
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
		.where("ErrorCount", "<", 5)
		.leftJoin("MediaVote", "Media.MediaId", "MediaVote.MediaId")
		.groupBy("Media.MediaId")
		.having("Points", ">", config.MinimumPoints)
		.orHavingRaw("`Points` is null")
		.then((rows) => {
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
				.where("ErrorCount", "<", 5)
				.groupBy("Media.MediaId")
				.having("Points", ">", config.MinimumPoints)
				.orHavingRaw("`Points` is null")
				.then((rollableMedias) => {
					let pointWeightedMedias = [];
					rollableMedias.forEach((rollable) => {
						for (
							let i = 0;
							i < rollable.Points + config.MinimumPoints * -1;
							i++
						) {
							pointWeightedMedias.push(rollable);
						}
					});
					let media: Media =
						pointWeightedMedias[
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

	GetUserIdFromMessage(msg, (userId) => {
		msg.attachments.forEach((a) => {
			SaveMedia(a.url, msg.id, userId);
		});
	});

	if (msg.content.indexOf("http") != -1) {
		GetUserIdFromMessage(msg, (userId) => {
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
	UpvoteEmoji: string;
	DownvoteEmoji: string;
	RollCommand: string;
	CurrentlyRolling: number;
	CreatedBy: number;
	DateCreated: number;
	DateUpdated: number;
}

knex.schema.hasTable("ChannelConfig").then((exists) => {
	if (!exists) {
		return knex.schema.createTable("ChannelConfig", (t) => {
			t.increments("ChannelConfigId").primary().unique();
			t.string("Prefix", 100);
			t.string("MediaChannelId");
			t.string("RollChannelId");
			t.decimal("BufferPercentage");
			t.integer("MaximumPoints");
			t.integer("MinimumPoints");
			t.integer("UpvoteEmoji");
			t.integer("DownvoteEmoji");
			t.string("RollCommand");
			t.integer("CurrentlyRolling");
			t.integer("CreatedBy");
			t.integer("DateCreated");
			t.integer("DateUpdated");

			t.foreign("CreatedBy").references("UserId").inTable("User");
		});
	}
});

export interface Media {
	MediaId: number;
	ConfigId: number;
	Url: string;
	MessageId: string;
	ErrorCount: number;
	CreatedBy: number;
	DateCreated: number;
}

knex.schema.hasTable("Media").then((exists) => {
	if (!exists) {
		return knex.schema.createTable("Media", (t) => {
			t.increments("MediaId").primary().unique();
			t.integer("ConfigId");
			t.string("Url");
			t.string("MessageId");
			t.integer("ErrorCount").notNullable().defaultTo(0);
			t.integer("CreatedBy");
			t.integer("DateCreated");

			t.foreign("CreatedBy").references("UserId").inTable("User");

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

knex.schema.hasTable("MediaRoll").then((exists) => {
	if (!exists) {
		return knex.schema.createTable("MediaRoll", (t) => {
			t.increments("MediaRollId").primary().unique();
			t.integer("MediaId");
			t.string("MessageId");
			t.integer("CreatedBy");
			t.integer("DateCreated");

			t.foreign("CreatedBy").references("UserId").inTable("User");

			t.foreign("MediaId").references("MediaId").inTable("Media");
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

knex.schema.hasTable("MediaVote").then((exists) => {
	if (!exists) {
		return knex.schema.createTable("MediaVote", (t) => {
			t.increments("MediaVoteId").primary().unique();
			t.integer("MediaId");
			t.string("MessageId");
			t.integer("IsUpvote");
			t.integer("CreatedBy");
			t.integer("DateCreated");

			t.foreign("CreatedBy").references("UserId").inTable("User");

			t.foreign("MediaId").references("MediaId").inTable("Media");

			t.foreign("MessageId").references("MessageId").inTable("MediaRoll");
		});
	}
});

// Cleanup any flags left set
knex.schema.hasTable("ChannelConfig").then((exists) => {
	if (exists) {
		knex<ChannelConfig>("ChannelConfig")
			.update("CurrentlyRolling", 0)
			.where("CurrentlyRolling", 1)
			.then(() => {});
	}
});
