import * as winston from "winston";
import DailyRotateFile = require("winston-daily-rotate-file");

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
	return `${timestamp} [${level}]:${message}`;
});

export let logger = winston.createLogger({
	levels: winston.config.syslog.levels,
	transports: [
		new winston.transports.Console({
			level: "info",
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.colorize(),
				logFormat
			),
		}),
		new DailyRotateFile({
			level: "info",
			format: winston.format.json(),
			filename: "%DATE%.log",
			dirname: "logs",
			datePattern: "YYYY-MM-DD",
			zippedArchive: true,
			maxSize: "20m",
			maxFiles: "30d",
		}),
	],
});
