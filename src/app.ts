import { logger } from "./common/logger";
import { ActionHandler } from "./common/pipeline";
import { Client } from "discord.js";
const client = new Client();
const actionHandler = new ActionHandler();

const token = process.env.MEDIABOTDISCORDTOKEN;

client.on("ready", () => {
	logger.info(`Logged in as ${client.user.username}`);
});

client.on("message", message => {
	actionHandler.OnMessage(message);
});

client.login(token);

exports.client = client;
