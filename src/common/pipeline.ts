import { Message, GuildMember, User } from "discord.js";
import { logger } from "./logger";
import knex, { DbServer, DbUser } from "./db";

function ProcessUser(guildMember: GuildMember) {
	knex<DbServer>("Server")
		.where("DiscordId", guildMember.guild.id)
		.first()
		.then(serverRow => {
			if (typeof serverRow === "undefined") {
				knex<DbServer>("Server")
					.insert({
						DiscordId: guildMember.guild.id,
						Name: guildMember.guild.name,
					})
					.then(newServerId => {
						logger.info(
							`Inserted new server: ${guildMember.guild.name}`
						);
						knex<DbUser>("User")
							.insert({
								DiscordId: guildMember.id,
								UserName: guildMember.user.username,
								DisplayName: guildMember.displayName,
								ServerId: newServerId[0],
							})
							.then(() =>
								logger.info(
									`Inserted new user: ${guildMember.user.username}`
								)
							);
					});
			} else {
				knex<DbUser>("User")
					.where("DiscordId", guildMember.user.id)
					.where("ServerId", serverRow.ServerId)
					.first()
					.then(userRow => {
						if (typeof userRow === "undefined") {
							knex<DbUser>("User")
								.insert({
									DiscordId: guildMember.id,
									UserName: guildMember.user.username,
									DisplayName: guildMember.displayName,
									ServerId: serverRow.ServerId,
								})
								.then(() =>
									logger.info(
										`Inserted new user: ${guildMember.user.username}`
									)
								);
						}
					});
			}
		});
}

export class ActionHandler {
	OnMessage(msg: Message) {
		ProcessUser(msg.member);
		logger.info(msg.author.id);
	}

	Test(stuff: string) {
		logger.info(stuff);
	}
}
