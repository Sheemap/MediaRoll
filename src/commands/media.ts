import knex, { DbServer, DbUser } from "../common/db";
import {
	Message,
	MessageReaction,
	Attachment,
	MessageAttachment,
} from "discord.js";
import { MediaConfig } from "../common/config";
import { GetUserIdFromMessage, GetTimestamp } from "../common/utilities";
import { logger } from "../common/logger";
import { type } from "os";

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
			console.log(args);
			switch (args[0]) {
				case `${prefix}mediaconfig`:
					Configure(msg, args);
					break;

				case `${prefix}roll`:
					RollMedia(msg);
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
	if (typeof config === "undefined") {
		GetUserIdFromMessage(msg, userId => {
			knex<ChannelConfig>("ChannelConfig")
				.whereNull("RollChannelId")
				.andWhere("CreatedBy", userId)
				.first()
				.then(row => {
					if (typeof row === "undefined") {
						console.log("asdf");
						let chanConfig = GetSettingsFromArgs(args);
						console.log("asdf");

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
}

function GetSettingsFromArgs(args: string[]) {
	let errors: string[] = [];
	let chanConfig: ChannelConfig = {
		ChannelConfigId: null,
		MediaChannelId: null,
		RollChannelId: null,
		CreatedBy: null,
		DateCreated: null,
		DateUpdated: null,
		Prefix: DEFAULTPREFIX,
		BufferPercentage: 0.75,
		MaximumPoints: 20,
		MinimumPoints: -5,
		RemoveAtMinimum: 1,
	};
	console.log("asdfdd");

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

				case "-dr":
				case "--dont-remove-at-minimum":
					chanConfig.RemoveAtMinimum = 0;
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

function RollMedia(msg: Message) {}

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
		.then(() => logger.info(`Saved meme sent by userId ${userId}`));
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
	RemoveAtMinimum: number;
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
			t.integer("RemoveAtMinimum");
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
