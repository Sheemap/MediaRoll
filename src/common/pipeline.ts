import { Message, GuildMember, User, MessageReaction } from "discord.js";
import { logger } from "./logger";
import { sync as globSync } from "glob";
import * as path from "path";
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
				if (serverRow.Name != guildMember.guild.name) {
					knex<DbServer>("Server")
						.where("ServerId", serverRow.ServerId)
						.update({
							Name: guildMember.guild.name,
						})
						.then(() =>
							logger.info(
								`Updated server: ${guildMember.guild.name}`
							)
						);
				}
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
						} else if (
							userRow.DisplayName != guildMember.displayName ||
							userRow.UserName != guildMember.user.username
						) {
							knex<DbUser>("User")
								.where("UserId", userRow.UserId)
								.update({
									DisplayName: guildMember.displayName,
									UserName: guildMember.user.username,
								})
								.then(() =>
									logger.info(
										`Updated user: ${guildMember.user.username}`
									)
								);
						}
					});
			}
		});
}

interface CommandClass {
	OnMessage: Function;
	OnReactionAdd: Function;
	OnReactionDelete: Function;
}

export class ActionHandler {
	public comms: { [id: string]: CommandClass } = {};

	constructor() {
		let tempComms: { [id: string]: CommandClass } = {};
		globSync(__dirname + "/../commands/**/*.js").forEach(file => {
			let name = path
				.relative(__dirname, file)
				.replace("../commands/", "")
				.replace(".js", "");
			tempComms[name] = require(file);
		});
		this.comms = tempComms;
	}

	OnMessage(msg: Message) {
		ProcessUser(msg.member);

		for (let x in this.comms) {
			if (
				msg.content == x &&
				typeof this.comms[x].OnMessage !== "undefined"
			) {
				this.comms[x].OnMessage(msg);
			}
		}
	}

	OnReactionAdd(reaction: MessageReaction) {
		ProcessUser(reaction.message.member);

		for (let x in this.comms) {
			if (typeof this.comms[x].OnReactionAdd !== "undefined") {
				this.comms[x].OnReactionAdd(reaction);
			}
		}
	}

	OnReactionDelete(reaction: MessageReaction) {
		ProcessUser(reaction.message.member);

		for (let x in this.comms) {
			if (typeof this.comms[x].OnReactionDelete !== "undefined") {
				this.comms[x].OnReactionDelete(reaction);
			}
		}
	}
}
