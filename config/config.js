'use strict';

require('dotenv').config(); // garante DEV_DB_*/PROD_DB_* ao rodar o sequelize-cli
const mysql2 = require('mysql2');

module.exports = {
  development: {
    username: process.env.DEV_DB_USER,
    password: process.env.DEV_DB_PASS,
    database: process.env.DEV_DB_NAME,
    host: process.env.DEV_DB_HOST,
    port: process.env.DEV_DB_PORT || 3306,
    dialect: 'mysql',
    dialectModule: mysql2,
    quoteIdentifiers: false,
    timezone: '-03:00'
  },
  test: {
    username: process.env.DEV_DB_USER,
    password: process.env.DEV_DB_PASS,
    database: process.env.DEV_DB_NAME,
    host: process.env.DEV_DB_HOST,
    port: process.env.DEV_DB_PORT || 3306,
    dialect: 'mysql',
    dialectModule: mysql2,
    quoteIdentifiers: false,
    timezone: '-03:00'
  },
  production: {
    username: process.env.PROD_DB_USER,
    password: process.env.PROD_DB_PASS,
    database: process.env.PROD_DB_NAME,
    host: process.env.PROD_DB_HOST,
    port: process.env.PROD_DB_PORT || 3306,
    dialect: 'mysql',
    dialectModule: mysql2,
    logging: false,
    quoteIdentifiers: false,
    timezone: '-03:00'
  }
};
