import knex, { DbServer, DbUser } from "../common/db";
import {
	Message,
	MessageReaction,
	Attachment,
	MessageAttachment,
} from "discord.js";
import { MediaConfig } from "../common/config";
import { GetUserIdFromMessage, GetTimestamp } from "../common/utilities";

var config: MediaConfig = null;
var prefix: string = "!";

export function OnMessage(msg: Message) {
	let args: string[] = msg.content.split(" ");
	if (args.length <= 0) return;

	config = new MediaConfig(msg.channel.id);
	prefix = config.Config.Prefix;
	switch (args[0]) {
		case `${prefix}media`:
			Configure(msg);
			break;

		case `${prefix}roll`:
			RollMedia(msg);
			break;

		default:
			ProcessMessage(msg);
			break;
	}
}

export function OnReactionAdd(reaction: MessageReaction) {}

export function OnReactionDelete(reaction: MessageReaction) {}

function Configure(msg: Message) {}

function RollMedia(msg: Message) {}

function ProcessMessage(msg: Message) {
	if (msg.channel.id != config.Config.MediaChannelId) return;

	if (msg.attachments.array.length > 0) {
		GetUserIdFromMessage(msg, userId => {
			msg.attachments.forEach(a => {
				SaveMedia(a.url, msg.id, userId);
			});
		});
	} else if (msg.content.indexOf("http") != -1) {
		GetUserIdFromMessage(msg, userId => {
			SaveMedia(msg.content, msg.id, userId);
		});
	}
}

function SaveMedia(url: string, messageId: string, userId: number) {
	knex<Media>("Media").insert({
		ConfigId: config.Config.ChannelConfigId,
		Url: url,
		MessageId: messageId,
		CreatedBy: userId,
		DateCreated: GetTimestamp(),
	});
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
