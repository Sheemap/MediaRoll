import { logger } from "./logger";
import * as knexjs from "knex";
import * as fs from "fs";

const sqliteFileLocation = process.env.SQLITEDBFOLDER || "./data";

if (!fs.existsSync(sqliteFileLocation)) {
	fs.mkdirSync(sqliteFileLocation);
}

const knex = knexjs({
	client: "sqlite3",
	connection: {
		filename: sqliteFileLocation + "/sqlite.db",
	},
	debug: true,
	useNullAsDefault: true,
	log: {
		warn(message) {
			logger.warning(message);
		},
		error(message) {
			logger.error(message);
		},
		deprecate(message) {
			logger.warning(message);
		},
		debug(message) {
			logger.debug(message);
		},
	},
});

export interface DbServer {
	ServerId: number;
	DiscordId: string;
	Name: string;
}

export interface DbUser {
	UserId: number;
	DiscordId: string;
	UserName: string;
	DisplayName: string;
	ServerId: number;
}

// Create system tables
knex.schema.hasTable("Server").then(exists => {
	if (!exists) {
		return knex.schema
			.createTable("Server", t => {
				t.increments("ServerId")
					.primary()
					.unique();
				t.integer("DiscordId");
				t.string("Name", 100);
			})
			.then(() => logger.info("Created Server table"));
	}
});

knex.schema.hasTable("User").then(exists => {
	if (!exists) {
		return knex.schema
			.createTable("User", t => {
				t.increments("UserId")
					.primary()
					.unique();
				t.integer("DiscordId");
				t.string("UserName", 100);
				t.string("DisplayName", 100);
				t.integer("ServerId");

				t.foreign("ServerId")
					.references("ServerId")
					.inTable("Server");
			})
			.then(() => logger.info("Created User table"));
	}
});

export default knex;
