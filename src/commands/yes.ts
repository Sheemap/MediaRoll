import { MessageReaction } from "discord.js";

export function reaction(reaction: MessageReaction) {
	console.log(reaction.message.content);
}
