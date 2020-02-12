import knex, { DbServer, DbUser } from "./db";
import { type } from "os";
import { ChannelConfig } from "../commands/media";

export class MediaConfig {
	Config: ChannelConfig;

	constructor(configId: any) {
		console.log(typeof configId == "string");
		if (typeof configId == "number") {
			knex<ChannelConfig>("ChannelConfig")
				.where("ChannelConfigId", configId)
				.first()
				.then(configRow => {
					this.Config = configRow;
				});
		} else if (typeof configId == "string") {
			knex<ChannelConfig>("ChannelConfig")
				.whereNotNull("RollChannelId")
				.andWhere("MediaChannelId", configId)
				.orWhere("RollChannelId", configId)
				.first()
				.then(configRow => {
					this.Config = configRow;
				});
		}
	}
}
