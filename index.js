/**
 * wg-scanner - NPM package entry point
 */
// (C) Alexandre Morin 2015 - 2016

const Scanner = require('./lib/scanner.js');

/**
 * Public interface
 */
module.exports = {
  Scanner: Scanner
};
