/**
 * wg-scanner - Scanner unit test helpers
 */
// (C) Alexandre Morin 2015 - 2016

const extend = require('extend');
const LinkedHashMap = require('wg-collections').LinkedHashMap;
const utils = require('wg-utils');

/**
 * Mock storage delegate
 */

// The Map itslef. The key is the long file name, the value is a finger print
var _fingerprints = new LinkedHashMap();

var storageDelegate = {
  // Empty the map, clear the data
  _clear: function() {
    _fingerprints = new LinkedHashMap();
  },
  // Get a fingerprint, using the short filename as a key.
  // Assumes short names are unique
  _getByShortFilename: function(shortFilename) {
    var result = undefined;
    _fingerprints.each(function(key, value) {
      if (value.shortFilename === shortFilename) result = value;
    }, this);
    return result;
  },
  // Get all keys, in alphabetical order
  _getSortedKeys: function() {
    var result = [];
    _fingerprints.each(function(key, value) { result.push(key); }, this);
    return result.sort();
  },
  // Get a fingerprint by long file name
  getFingerPrint: function(longFilename, callback) {
    return callback(undefined, _fingerprints.get(longFilename));
  },
  // Get a set of fingerprints for a folder (or its subfolders)
  // Use pagination
  getFingerPrints: function(folder, offset, limit, callback) {
    var result = [];
    if (!utils.endsWith(folder, '/')) folder = folder + '/';
    _fingerprints.each(function(key, value) {
      offset = offset - 1;
      if (offset>=0) return;
      limit = limit - 1;
      if (limit<0) return;
      if (utils.startsWith(key, folder)) result.push(value);
    }, this);
    return callback(undefined, result);
  },
  // Count the number of fingerprints in a folder and its sub folders
  countFingerPrints: function(folder, callback) {
    var count = 0;
    if (!utils.endsWith(folder, '/')) folder = folder + '/';
    _fingerprints.each(function(key, value) {
      count = count + 1;
    }, this);
    return callback(undefined, count);
  },
  // Update (store) a fingerprint
  updateFingerprint: function(newFingerPrint, callback) {
    _fingerprints.each(function(key, value) {
      if (newFingerPrint.uuid === value.uuid) {
        var newValue = extend(true, value, newFingerPrint);
        _fingerprints.add(value.longFilename, newValue);
      }
    }, this);
    return new callback();
  },
  // Insert (store) a fingerprint
  insertFingerprint: function(newFingerPrint, callback) {
    var uuid = "XXX-" + _fingerprints.length();
    newFingerPrint.uuid = uuid;
    _fingerprints.add(newFingerPrint.longFilename, newFingerPrint);
    return new callback();
  },
  // Preloads a bunch of fingerprints
  // The mock does not need to honor the API fully, and just returns a single fingerprint
  // Normally, it should return a fingerprint and the "count" following elements
  // Not returning them does not cause any issue, it will just make the scanner going a little bit slower
  preLoadFingerprints: function(longFilename, count, callback) {
    var result = [];
    var fingerprint = _fingerprints.get(longFilename);
    if (fingerprint) result.push(fingerprint);
    return callback(undefined, result);
  },
  // Get the current date+time representation for the vanished attribute.
  getVanishedAt: function() {
    return new Date();
  },

  test_length: function() {
    return _fingerprints.length();
  }
};

/**
 * Mock progress delegate
 */
var progressDelegate = {
  scanStarted: function(scope, handlers, scanOptions) {
  },
  scanEnded: function() {
  },
  forwardScanStarted: function() {
  },
  forwardScanProgress: function(scanned, processed, inserted, updated) {
  },
  forwardScanEnded: function() {
  },
  reverseScanStarted: function() {
  },
  reverseScanProgress: function(fingerprints, scanned, processed, errors) {
  },
  reverseScanEnded: function() {
  }
};




/**
 * Public interface
 */
module.exports = {
  storageDelegate:    storageDelegate,
  progressDelegate:   progressDelegate
};
