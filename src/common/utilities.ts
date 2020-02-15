import { Message } from "discord.js";
import knex, { DbUser, DbServer } from "./db";

export function GetTimestamp() {
	return Math.round(new Date().getTime() / 1000);
}

export function GetUserIdFromMessage(msg: Message, callback: Function) {
	knex<DbServer>("Server")
		.where("DiscordId", msg.guild.id)
		.first()
		.then(serverRow => {
			knex<DbUser>("User")
				.where("DiscordId", msg.author.id)
				.where("ServerId", serverRow.ServerId)
				.first()
				.then(userRow => {
					callback(userRow.UserId);
				});
		});
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
					callback(userRow.UserId);
				});
		});
}
