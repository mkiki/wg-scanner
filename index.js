/**
 * wg-scanner - NPM package entry point
 */
// (C) Alexandre Morin 2015 - 2016

const Scanner = require('./lib/scanner.js');

/**
 * Public interface
 */
module.exports = {
  Scanner: Scanner,

  // Test interface. Returns the object as a function so that there's no overhead if not using
  Test: function() {
    const helpers = require('./tests/helpers.js');
    return helpers;
  }
};
