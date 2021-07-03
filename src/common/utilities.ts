import { Message, Guild } from "discord.js";
import client from "../app";
import knex, { DbUser, DbServer } from "./db";

export function GetTimestamp() {
	return Math.round(new Date().getTime() / 1000);
}

export function GetUserIdFromMessage(msg: Message, callback: Function) {
	GetUserIdFromDiscordId(msg.guild.id, msg.author.id, callback);
}

export function GetUserIdFromDiscordId(
	serverDiscordId: string,
	userDiscordId: string,
	callback: Function
) {
	knex<DbServer>("Server")
		.where("DiscordId", serverDiscordId)
		.first()
		.then((serverRow) => {
			knex<DbUser>("User")
				.where("DiscordId", userDiscordId)
				.where("ServerId", serverRow.ServerId)
				.first()
				.then((userRow) => {
					if (typeof userRow === "undefined") callback(0);
					callback(userRow.UserId);
				});
		});
}

export function GetChannelIdsFromGuildId(serverDiscordId: string) {
	let guild = client.guilds.filter((x) => x.id == serverDiscordId).first();

	return guild.channels;
}

export function GetDiscordMembersFromName(guild: Guild, name: string) {
	let usernameMembers = guild.members
		.filter((x) => x.user.username.indexOf(name) != -1)
		.map((x) => x);

	if (usernameMembers.length > 0) {
		return usernameMembers;
	}

	let displayNameMembers = guild.members
		.filter((x) => x.displayName.indexOf(name) != -1)
		.map((x) => x);

	return displayNameMembers;
}
