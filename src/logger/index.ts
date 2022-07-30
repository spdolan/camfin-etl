// General Logger to go here
const winston = require('winston');
export const logger = new winston.createLogger({
  level: process.env.LOGGER || 'info',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.json())
    })
  ]
});
