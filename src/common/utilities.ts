import { Message } from "discord.js";
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
		.then(serverRow => {
			knex<DbUser>("User")
				.where("DiscordId", userDiscordId)
				.where("ServerId", serverRow.ServerId)
				.first()
				.then(userRow => {
					if (typeof userRow === "undefined") callback(0);
					callback(userRow.UserId);
				});
		});
}
