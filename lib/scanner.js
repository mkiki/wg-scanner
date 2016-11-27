/**
 * wg-scanner - Scanners
 *
 * Scanners are used to walk the file system and compute fingerprints for each file.
 * Fingerprints are stored in a long-term storage, usually a database.
 * - A forward scanner actually walks the file system and process each file in turn.
 * - A reverse scanner walks the long term storage and match it with the file system
 *
 * File system is accessed through Scopes. Scopes provide an iterator interface and
 * allow inclusion and exclusion, such as excluding .DS_Store file, or files of a certain
 * type or too big or too small...
 * - a FileScope can be used to scan individual files
 * - a DirectoryScope can be used to scan folders and hierarchies
 *
 * Long term storage API (usually a database) is provided through the StoreDelegate
 * interface. It basically allow to query and update fingerprints
 *
 * Forward scan is implemented through the FingerprintsScanner who's role is basically
 * to iterate throufh a scope, create fingerprints for new files, or update fingerprints
 * for changed files. Unchanged files are ignored unless the force:true option is passed.
 * For each fingerprint, we also compute the MD5 code.
 *
 * Reverse scan is implemented through the ReverseScanner object. It's role is to
 * iterate over the stored fingerprints and call a set of handlers in turn for each fingerprint.
 * By default, a single handler is used, the VanishedFilesHandler who will detect if
 * the file for a fingerprint has been removed from the filesystem or restored. If so, the
 * fingerprint's vanishedAt attribute is set accordingly to the date/time at which we
 * detected the removal, or reset to NULL if the file has been restored.
 * Handlers implement the ReverseScanHandler interface.
 *
 */
 // (C) Alexandre Morin 2015 - 2016

const fs = require('fs');
const fse = require('fs-extra');
const utils = require('wg-utils');
const extend = require('extend');
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const moment = require('moment');
const LinkedHashMap = require('wg-collections').LinkedHashMap;

const log = Log.getLogger('scanner');


/** ================================================================================
  * Type definitions
  * ================================================================================ */


/**
 * @typedef Fingerprint
 *
 * @property {string} uuid - A unique identifier for this fingerprint
 * @property {string} shortFilename - The short file name on the file system (ex: "elephant.png")
 * @property {string} longFilename - The long file name on the file system (ex: "/tmp/elephant.png")
 * @property {number} mtime - The modification time of the file on the file system referential (from lstat command)
 * @property {number} size - The file size, in bytes
 * @property {string} md5 - The md5 checksum of the file
 * @property {string} vanishedAt - Non null if the file vanished from the file system. Represents the date+time at which the file was found vanished
 */


/** ================================================================================
  * Progress monitoring
  * ================================================================================ */

/**
 * Create the delegate object to handle progress information
 */
function ProgressDelegate() {
}

/**
 * Called when the scan starts
 *
 * @param {Scope} scope - is the scan scope (file(s) or folder(s))
 * @param {ReverseScanHandler[]} - is the list of handlers for this scan
 * @param scanOptions - is the scan options
 */
ProgressDelegate.prototype.scanStarted = function(scope, handlers, scanOptions) {
}

/**
 * Called when the scan ends
 */
ProgressDelegate.prototype.scanEnded = function() {
}

/**
 * Called when the forward scan starts
 */
ProgressDelegate.prototype.forwardScanStarted = function() {
}

/**
 * Called when the forward scan processed a new file
 *
 * @param {number} scanned - the number of files scanned so far
 * @param {number} processed - the number of files processed so far
 * @param {number} inserted - the number of fingerprints inserted so far
 * @param {number} updated - the number of fingerprints updated so far
 */
ProgressDelegate.prototype.forwardScanProgress = function(scanned, processed, inserted, updated) {
}

/**
 * Called when the forward scan ends
 */
ProgressDelegate.prototype.forwardScanEnded = function() {
}

/**
 * Called when the reverse scan starts
 */
ProgressDelegate.prototype.reverseScanStarted = function() {
}

/**
 * Called when the reverse scan processed a new fingerprint
 *
 * @param {number} fingerprints - the total number of fingerprints to scan
 * @param {number} scanned - the number of files scanned so far
 * @param {number} processed - the number of files processed so far
 * @param {number} errors - the number of scan errors
 */
ProgressDelegate.prototype.reverseScanProgress = function(fingerprints, scanned, processed, errors) {
}

/**
 * Called when the reverse scan ends
 */
ProgressDelegate.prototype.reverseScanEnded = function() {
}


/** ================================================================================
  * Delegate to access long-term storage
  * ================================================================================ */


/**
 * Create the delegate object to handle the database (long-term storage) access
 */
function StorageDelegate() {
}

/**
 * Get a fingerprint from long term storage, by long file name.
 *
 * @param {string} longFilename - is the fully-qualified name of the file from the filesystem
 * @return {Fingerprint} the corresponding fingerprint or null/undefined if not found
 */
StorageDelegate.getFingerPrint = function(longFilename, callback) {
  return callback(new Exception({longFilename:longFilename}, "Unimplemented  function StorageDelegate.getFingerPrint"));
}

/**
 * Get a the list of fingerprints for a folder, using pagination
 *
 * @param {string} folder - is the fully-qualified name of the file system folder
 * @param {integer} offset - is the pagination offset (ie from where we start)
 * @param {integer} limit - is the pagination limit (ie tha maximum number of items returned)
 * @return {Fingerprint[]} the list of fingerprints for this folder, within the pagination limits
 *
 * Note that the function is expected to return all the requested fingerprints. If it returns less than
 * the expected (limit) number, then the scanners will consider that there are no more fingerprints
 * for the folder.
 */
StorageDelegate.getFingerPrints = function(folder, offset, limit, callback) {
  return callback(new Exception({folder:folder, offset:offset, limit:limit}, "Unimplemented  function StorageDelegate.getFingerPrints"));
}

/**
 * Count the number of fingerprints for a folder, used to indicate progress
 *
 * @param {string} folder - is the fully-qualified name of the file system folder
 * @return {integer} the number of fingerprints
 */
StorageDelegate.countFingerPrints = function(folder, callback) {
  return callback(new Exception({folder:folder}, "Unimplemented  function StorageDelegate.countFingerPrints"));
}

/**
 * Updates a fingerprint in the long-term storage
 *
 * @param {Fingerprint} newFingerPrint - is the new fingerprint or a partial fingerprint (containing only fields to update).
 *                                       The fingerprint's uuid is used as a reconciliation key
 */
StorageDelegate.updateFingerprint = function(newFingerPrint, callback) {
  return callback(new Exception({fingerprint:newFingerPrint}, "Unimplemented  function StorageDelegate.updateFingerprint"));
}

/**
 * Store a new fingerprint
 *
 * @param {Fingerprint} newFingerPrint - is the new fingerprint. The uuid is not expected to be set by the called, but
 *                                       will be determined by the long term storage
 */
StorageDelegate.insertFingerprint = function(newFingerPrint, callback) {
  return callback(new Exception({fingerprint:newFingerPrint}, "Unimplemented  function StorageDelegate.insertFingerprint"));
}

/**
 * Preloads (for caching) a set of fingerprints
 * This functions is used for optimisation to prefetch fingerprints that are probably going to be needed
 * and therefore avoids unitary calls to the long term storage.
 *
 * @param {string} longFilename - is the fully-qualified name of the file from the filesystem to start from
 * @param {integer} count - the number of fingerprints to prefetch
 * @return {Fingerprint[]} a list of fingerprints
 *
 * Unlike the getFingerPrints call, the preLoadFingerprints does not have to return the exact number of 
 * requested fingerprint. If it doesn't, the scanner may not run as fast as possible.
 */
StorageDelegate.preLoadFingerprints = function(longFilename, count, callback) {
  return callback(new Exception({longFilename:longFilename, count:count}, "Unimplemented  function StorageDelegate.preLoadFingerprints"));
}

/**
 * Get the current date+time representation for the vanished attribute.
 * This cannot be computed by the scanner, because it is dependent of the long-term storage referential.
 * For instance, we'll use the "current_timestamp" of a database
 */
StorageDelegate.getVanishedAt = function() {
  return undefined;
}



/** ================================================================================
  * Handler interface for reverse scanners
  * ================================================================================ */

/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
ReverseScanHandler = function(reverseScanner) {
  this._reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
ReverseScanHandler.prototype.getName = function() { return "ReverseScanHandler"; };

/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * Their responsibility is to determine if there's a change or something to (re)compute
 * and if so to update the fingerprint in the long term storage
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
ReverseScanHandler.prototype.processNext = function(fingerprint, stats, isInScope, callback) {
  return callback();
}




/** ================================================================================
  * Scanning scope for a single file
  * ================================================================================ */

// Creates a scanning scope for a single file
// @param longFilename    an array of the file names to scan
function FilesScope(longFilenames) {
  this._longFilenames = longFilenames;      // list of long filenames to include in the scope
  // forward-scan working variables
  this._remaining = [];     // remaining files to scan
  // reverse-scan working variables
}

/** 
 * Get a name for the scanner
 */
FilesScope.prototype.getName = function() {
  return "File:" + this._longFilenames[0];
}

// Starts (or restarts) a forward-scan
// @param callaback       return function
//                            err is the error code/message
FilesScope.prototype.startScan = function(callback) {
  this._remaining = [];
  this._remaining = this._longFilenames.slice(0);
  return callback();
}

// Get the next file to scan (forward-scan)
// @param callaback       return function
//                            err is the error code/message
//                            longFilename is the fullname of the scanned file
//                            shortFilename is the short name of the scanned file
//                            stats is the file metadata
FilesScope.prototype.nextFile = function(callback) {
  var that = this;
  if (that._remaining.length === 0) return callback(); // finished
  var longFilename = that._remaining.shift();
  return fs.lstat(longFilename, function(err, stats) {
    if (err) {
      if (err.code && (err.code === 'EACCES' || err.code === 'ENOENT')) return that.nextFile(callback);
      return callback(err);
    }
    if (!stats || !stats.isFile()) return that.nextFile(callback); // not found
    var shortFilename = utils.getShortFilename(longFilename);
    return callback(null, longFilename, shortFilename, stats);
  });
}

FilesScope.prototype.startReverseScan = function(delegate, callback) {
  var that = this;
  that._delegate = delegate;
  this._remaining = this._longFilenames.slice(0);
  return callback(undefined, this._remaining);
}

/**
 * Get the next fingerprint (revert-scan)
 * @param callaback       return function
 *                            err is the error code/message
 *                            fingerprint is the fingerprint. Will be undefined when the scan is finished
 *                            stats is the file metadata (if file was found) for this fingerprint
 *                            isInScope indicates whether the fingerprint is in the scope of the scanner or not
 */
FilesScope.prototype.nextFingerprint = function(callback) {
  var that = this;
  if (that._remaining.length === 0) return callback(); // finished
  var longFilename = that._remaining.shift();
  return that._delegate.getFingerPrint(longFilename, function(err, fingerprint) {
    if (err) return callback(err);
    if (!fingerprint) return that.nextFingerprint(callback);
    return fs.lstat(fingerprint.longFilename, function(err, stats) {
      if (err) {
        if (err.code && (err.code === 'EACCES' || err.code === 'ENOENT')) stats = null;
        else return callback(err);
      }
      return callback(null, fingerprint, stats, true);
    });
  });
}





/** ================================================================================
  * Scanning scope for a folder hierarchy
  * Filtering capabilities
  * - exclude file or directory name matching a name or a simple pattern (*.xxx)
  * - include only files matching a pattern
  * - include only file within a size range
  * ================================================================================ */

/** 
 * Creates a scanning scope for a folder hierarchy
 * @param folder      is the full name of the root folder
 */
function DirectoryScope(folder) {
  this._folder = folder;            // root folder
  this._exclusions = [];            // list of file names/patterns to exclude (shortnames, lower-case)
  this._fileInclusions = [];        // list of file names/patterns to include (shortnames, lower-case)
  this._minFileSize = undefined;    // minimum file size (optional)
  this._maxFileSize = undefined;    // maximum file size (optional)
  // forward-scan working variables
  this._stack = [];                 // remaining files/folders to scan
  // reverse-scan working variables
  this._delegate = undefined;       // database
  this._offset = 0;                 // offset for queries
  this._totalRecords = undefined;   // total number of records
  this._processed = undefined;      // number of processed records
  this._fingerprints = [];          // remaining fingerprints
  this._reverseScanFinished = false;// set when reverse scan is finished 
}

/** 
 * Get a name for the scanner
 */
DirectoryScope.prototype.getName = function() {
  return "Dir:" + this._folder;
}

/** 
 * Exclude a list of files / folders
 * @param filenames       list of filenames or patterns to exclude (shortname, lower-case)
 * @return                the Scope itself, to allow chaining
 */
DirectoryScope.prototype.exclude = function(filenames) {
  if (filenames !== null && filenames !== undefined) {
    for (var i=0; i<filenames.length; i++)
      this._exclusions.push(filenames[i].toLowerCase());
  }
  return this;
}

/**
 * Include a list of files (only for files, not folders)
 * @param filenames       list of filenames or patterns to include (shortname, lower-case)
 * @return                the Scope itself, to allow chaining
 */
DirectoryScope.prototype.includeFiles = function(filenames) {
  if (filenames !== null && filenames !== undefined) {
    for (var i=0; i<filenames.length; i++)
      this._fileInclusions.push(filenames[i].toLowerCase());
  }
  return this;
}

/**
 * Exclude small files
 * @param minFileSize     All files strictly smaller than this value will be excluded from scope
 * @return                the Scope itself, to allow chaining
 */
DirectoryScope.prototype.excludeFilesSmallerThan = function(minFileSize) {
  if (minFileSize !== null && minFileSize !== undefined)
    this._minFileSize = minFileSize;
  return this;
}

/** 
 * Exclude large files
 * @param maxFileSize     All files strictly larger than this value will be excluded from scope
 * @return                the Scope itself, to allow chaining
 */
DirectoryScope.prototype.excludeFilesLargerThan = function(maxFileSize) {
  if (maxFileSize !== null && maxFileSize !== undefined)
    this._maxFileSize = maxFileSize;
  return this;
}

/**
 * Starts (or restarts) a forward-scan
 * @param callaback       return function
 *                            err is the error code/message
 */
DirectoryScope.prototype.startScan = function(callback) {
  this._stack = [this._folder];
  return callback();
}

/**
 * Get the next file to scan (forward-scan)
 * @param callaback       return function
 *                            err is the error code/message
 *                            longFilename is the fullname of the scanned file
 *                            shortFilename is the short name of the scanned file
 *                            stats is the file metadata
 */
DirectoryScope.prototype.nextFile = function(callback) {
  var that = this;
  if (that._stack.length === 0) return callback(); // Finished
  var longFilename = that._stack.shift();
  return fs.lstat(longFilename, function(err, stats) {
    if (err) { 
      if (err.code && (err.code === 'EACCES' || err.code === 'ENOENT')) return that.nextFile(callback);
      return callback(err);
    }
    if (!stats) return that.nextFile(callback); // file not found (vanished ?)
    var shortFilename = utils.getShortFilename(longFilename);
     if (stats.isFile()) {
      if (that._isExcluded(longFilename, shortFilename, stats)) return that.nextFile(callback);
      return callback(null, longFilename, shortFilename, stats);
    }
    if (stats.isDirectory()) {
      if (that._isExcluded(longFilename, shortFilename, stats)) return that.nextFile(callback);
      return fs.readdir(longFilename, function fs_readddir_result(err, files) {
        if (err) { 
          if (err.code && (err.code === 'EACCES' || err.code === 'ENOENT')) return that.nextFile(callback);
          return callback(err);
        }
        files.sort();
        for (var i=0; i<files.length; i++) that._stack.push(longFilename + "/" + files[i]);
        return that.nextFile(callback);
      });
    }
    return that.nextFile(callback);
  });
}

// Is a file/folder excluded from the scan
// @param longFilename      is the file/directory full name
// @param shortFilename     is the file/directory short name
// @param stats             is the fs.Stats object for the file/directory
DirectoryScope.prototype._isExcluded = function(longFilename, shortFilename, stats) {
  var that = this;
  var shortFilename = shortFilename.toLowerCase();

  if (stats) {
    var isFile = stats.isFile();
    var size = stats.size;
    // Check file size filter
    if (isFile && this._minFileSize && size < this._minFileSize) return true;
    if (isFile && this._maxFileSize && size > this._maxFileSize) return true;
    // Exclude files without extension
    if (isFile && utils.getExtension(shortFilename).length === 0) return true;
    // Exclude symbolic links
    if (stats.isSymbolicLink()) return true;
    // Exclude empty files
    if (size === 0) return true;  
  }

  // Exclude all files/folders in the exclusion list
  if (that._isPathElementExcluded(shortFilename, longFilename)) return true;

  // If there is an inclusion list, exclude all files not in this list
  // Note: inclusion is only for files, not for folders
  var inclusions = this._fileInclusions;
  if (inclusions.length > 0 && stats && isFile) {
    for (var i=0; i<inclusions.length; i++) {
      var pattern = inclusions[i];
      if (utils.startsWith(pattern, "*")) {
        var suffix = pattern.substr(1);
        var match = utils.endsWith(shortFilename, suffix);
        if (match) return false;
      }
      else {
        if (shortFilename === pattern) return false;
      }
    }
    return true; // not in inclusion list
  }
  return false;
}

DirectoryScope.prototype._isPathElementExcluded = function(shortFilename, longFilename) {
  var exclusions = this._exclusions;
  for (var i=0; i<exclusions.length; i++) {
    var pattern = exclusions[i];
    if (utils.startsWith(pattern, "*")) {
      var suffix = pattern.substr(1);
      var match = utils.endsWith(shortFilename, suffix);
      if (match) return true;
    }
    else {
      var index = longFilename.toLowerCase().indexOf('/'+pattern+'/');
      if (shortFilename === pattern) return true;
      if (index !== -1) return true;
    }
  }
  return false;
}

/**
 * Starts (or restarts) a reverse-scan
 * @param delegate        the storage delegate
 * @param callaback       return function
 *                            err is the error code/message
 *                            count is the number of fingerprints to process
 */
DirectoryScope.prototype.startReverseScan = function(delegate, callback) {
  var that = this;
  that._delegate = delegate;
  that._offset = 0;
  
  that._fingerprints = [];
  that._totalRecords = undefined;
  that._processed = undefined;
  that._reverseScanFinished = false;
  return that._delegate.countFingerPrints(that._folder, function(err, count) {
    if (err) return callback(err);
    that._totalRecords = count;
    that._processed = 0;
    return callback(undefined, that._totalRecords);
  });
}

/**
 * Get the next fingerprint (revert-scan)
 * @param callaback       return function
 *                            err is the error code/message
 *                            fingerprint is the fingerprint. Will be undefined when the scan is finished
 *                            stats is the file metadata (if file was found) for this fingerprint
 *                            isInScope indicates whether the fingerprint is in the scope of the scanner or not
 */
DirectoryScope.prototype.nextFingerprint = function(callback) {
  var that = this;
  if (that._fingerprints.length === 0) {
    if (that._reverseScanFinished) return callback(); // finished
    // Load next batch
    return that._reverseScanNextBatch(function(err) {
      if (err) return callback(err);
      if (that._fingerprints.length === 0) { that._reverseScanNext = true; return callback(); }
      return that.nextFingerprint(callback);
    });
  }
  var fingerprint = that._fingerprints.shift();
  return fs.lstat(fingerprint.longFilename, function(err, stats) {
    if (err) {
      if (err.code && (err.code === 'EACCES' || err.code === 'ENOENT')) stats = null;
      else return callback(err);
    }
    var isInScope = !that._isExcluded(fingerprint.longFilename, fingerprint.shortFilename, stats);
    that._processed = that._processed + 1;
    return callback(null, fingerprint, stats, isInScope, that._processed/that._totalRecords);
  });
}

// Process next batch of records
// @param callback    is the return function
DirectoryScope.prototype._reverseScanNextBatch = function(callback) {
  var that = this;
  var limit = 5000;
  return that._delegate.getFingerPrints(that._folder, that._offset, limit, function(err, fingerprints) {
    if (err) return callback(err);
    for (var i=0; i<fingerprints.length; i++) {
      var fingerprint = fingerprints[i];
      that._fingerprints.push(fingerprint);
    }
    if (fingerprints.length < limit) that._reverseScanFinished = true; // last batch
    that._offset = that._offset + fingerprints.length;
    return callback();
  });
}



/** ================================================================================
  * Fingerprint Scanner
  * This is a forward scanner (ie, reads file system and updates database accordingly)
  *
  * Scans a file system and update fingerprints database accordingly
  * ================================================================================ */

// @param {StorageDelegate} delegate - is the storage delegate (ie the database storage interface)
// @param {ProgressDelegate} progressDelegate - 
// @param {FilesScope | DirectoryScope } - the scan scope (ie the subset of the file system to scan)
// @param scanOptions - scanner options
function FingerprintsScanner(delegate, progressDelegate, scope, scanOptions) {
  this._delegate = delegate;
  this._progressDelegate = progressDelegate;
  this._scope = scope;
  this._scanOptions = scanOptions;
  this._totalScanned = 0;
  this._totalProcessed = 0;
  this._totalErrors = 0;
  this._totalInserted = 0;
  this._totalUpdated = 0;
  this._fingerprintsCache = new LinkedHashMap();
};

// Get a fingerprint from the database
// To increase performance, several fingerprints are loaded at once, ordering by long file name
// The cache is maintained by 2 variables : _fingerprintsCache is the cache itself (fingerprints by longfilename)
// And the _fingerprints is an order list of the last 1000 elements in the cache, which is used to limit the map size
FingerprintsScanner.prototype.getFingerPrint = function(longFilename, callback) {
  var that = this;
  var fingerprint = that._fingerprintsCache.get(longFilename);
  if (fingerprint) return callback(null, fingerprint);
  return that._delegate.preLoadFingerprints(longFilename, 1000, function(err, fingerprints) {
    if (err) return callback(err);
    for (var i=0; i<fingerprints.length; i++) {
      var fingerprint = fingerprints[i];
      that._fingerprintsCache.add(fingerprint.longFilename, fingerprint);
      while( that._fingerprintsCache.length > 1100 ) {
        that._fingerprintsCache.remove(that._fingerprintsCache.firstKey());
      }
    }
    var fingerprint = that._fingerprintsCache.get(longFilename);
    return callback(null, fingerprint);
  });
}

/**
 * Scans a directory and updates the fingerprint database
 *
 * @param fileset   is the FileSet to scan
 * @param callback  is the return function
 */
FingerprintsScanner.prototype.scan = function(callback) {
  var that = this;
  that._totalScanned = 0;
  that._totalProcessed = 0;
  that._totalErrors = 0;
  that._totalInserted = 0;
  that._totalUpdated = 0;
  that._progressDelegate.forwardScanStarted();
  log.info({ scope:that._scope.getName() }, "Scanning for fingerprints");
  return that._scope.startScan(function(err) {
    if (err) return callback(err);
    return that._processNext(function(err) {
      if (err) return callback(err);
      that._logProgress(true);
      that._progressDelegate.forwardScanEnded();
      return callback(null, {
        scanned: that._totalScanned,
        processed: that._totalProcessed,
        errors: that._totalErrors
      });
    });
  });
}

FingerprintsScanner.prototype._logProgress = function(force) {
  var that = this;
  that._progressDelegate.forwardScanProgress(that._totalScanned, that._totalProcessed, that._totalInserted, that._totalUpdated);
  if (force || (that._totalScanned % 1000) === 0) {
    log.info({ scanned:that._totalScanned, processed:that._totalProcessed, inserted:that._totalInserted, updated:that._totalUpdated });
  }
}

FingerprintsScanner.prototype._processNext = function(callback) {
  var that = this;
  var force = that._scanOptions.force;
  return that._scope.nextFile(function(err, longFilename, shortFilename, stats) {
    if (err) return callback(err);
    if (longFilename===null || longFilename===undefined) return callback(); // scan finished
    if (stats===null || stats===undefined || !stats.isFile()) return that._processNext(callback);
    return that.getFingerPrint(longFilename, function(err, fingerprint) {
      if (err) return callback(err);
      that._totalScanned = that. _totalScanned + 1;
      that._logProgress();
      // Create a new fingerprint
      if (fingerprint === undefined || fingerprint === null) {
        return utils.md5(longFilename, function(err, md5) {
          if (err) return callback(err);
          var fingerprint = {
            shortFilename:  shortFilename,
            longFilename:   longFilename,
            mtime:          stats.mtime,
            size:           stats.size,
            md5:            md5,
            uuid:           undefined,  // will be set by the database
            vanishedAt:     null,
            hidden:         false,
            ownerId:        'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' // nobody
          };
          return that._createFingerprint(fingerprint, function(err) {
            if (err) return callback(err);
            that._totalProcessed = that._totalProcessed + 1;
            that._totalInserted = that._totalInserted + 1;
            return that._processNext(callback);
          });
        });
      }
      // Update fingerprint if file was changed on disk
      if (!force && stats.mtime <= fingerprint.mtime) {
        return that._processNext(callback);
      }
      fingerprint.mtime = stats.mtime;
      return utils.md5(fingerprint.longFilename, function(err, md5) {
        if (err) return callback(err);
        fingerprint.md5 = md5;
        return that._updateFingerprint(fingerprint, function(err) {
          if (err) return callback(err);
          that._totalProcessed = that._totalProcessed + 1;
          that._totalUpdated = that._totalUpdated + 1;
          return that._processNext(callback);
        });
      });
    });
  });
}

FingerprintsScanner.prototype._createFingerprint = function(fingerprint, callback) {
  var that = this;
  log.info({ fingerprint:fingerprint.longFilename}, "Creating fingerprint");
  return that._delegate.insertFingerprint(fingerprint, function storeFingerprint_result(err) {
    return callback(err);
  });
}
FingerprintsScanner.prototype._updateFingerprint = function(fingerprint, callback) {
  var that = this;
  log.info({ longFilename:fingerprint.longFilename, uuid:fingerprint.uuid}, "Updating fingerprint");
  return that._delegate.updateFingerprint(fingerprint, function storeFingerprint_result(err) {
    return callback(err);
  });
}





/** ================================================================================
  * Reverse Scanner
  * This is a reverse-scanner which walks every fingerprint in the database and
  * delegates processing to various handlers
  * ================================================================================ */

/**
 * Create the reverse scanner
 * @param {StorageDelegate} delegate - is the storage delegate (ie the database storage interface)
 * @param {FilesScope | DirectoryScope } - the scan scope (ie the subset of the file system to scan)
 */
function ReverseScanner(delegate, progressDelegate, scope, scanOptions) {
  this._delegate = delegate;
  this._progressDelegate = progressDelegate;
  this._scope = scope;
  this._scanOptions = scanOptions;
  this._totalScanned = 0;
  this._totalProcessed = 0;
  this._totalErrors = 0;
  this._currentFileIsError = false;
}

/**
 * Get the storage delegate object
 * @return {StorageDelegate} the storage delegate
 */
ReverseScanner.prototype.getStorageDelegate = function() {
  return this._delegate;
}

ReverseScanner.prototype._getProgressPrefix = function() {
  if (this._percentage === null || this._percentage === undefined) return "";
  var percent = Math.floor(this._percentage*1000) / 10;
  return percent + "%";
}

/**
 * Run the scanner
 * @param {ReverseScanHandler[]} handlers - a list of handlers through which each fingerprint will be processed
 * @return a litteral object with scan statistics (number of fingerprints scanned, processed and failed)
 */
ReverseScanner.prototype.scan = function(handlers, callback) {
  var that = this;
  that._totalFingerprints = 0;
  that._totalScanned = 0;
  that._totalProcessed = 0;
  that._totalErrors = 0;
  that._percentage = 0;
  that._progressDelegate.reverseScanStarted();
  log.info({ scope:that._scope.getName() }, "Reverse scanning");

  // Start scan
  return that._scope.startReverseScan(that._delegate, function(err, count) {
    if (err) return callback(err);
    that._totalFingerprints = count;
    return that._processNext(handlers, function(err) {
      that._logProgress(true);
      if (err) return callback(err);
      that._progressDelegate.reverseScanEnded();
      return callback(null, {
        scanned: that._totalScanned,
        processed: that._totalProcessed,
        errors: that._totalErrors
      });
    });
  });
}

// Log current progress
// @param force   force logging the message. By default, logs every 1000 times
ReverseScanner.prototype._logProgress = function(force) {
  var that = this;
  that._progressDelegate.reverseScanProgress(that._totalFingerprints, that._totalScanned, that._totalProcessed, that._totalErrors);
  if (force || (that._totalScanned % 1000) === 0) {
    log.info({ fingerprints:that._totalFingerprints, scanned:that._totalScanned, processed:that._totalProcessed, errors:that._totalErrors, progress:that._getProgressPrefix() });
  }
}

// Process next fingerprint
ReverseScanner.prototype._processNext = function(handlers, callback) {
  var that = this;
  log.debug("Processing next file");
  return that._scope.nextFingerprint(function(err, fingerprint, stats, isInScope, percentage) {
    that._currentFileIsError = false;
    if (percentage) that._percentage = percentage;
    if (err) return callback(err);
    log.debug({ fingerprint:fingerprint, stats:stats, isInScope:isInScope }, "_processNext");
    if (fingerprint===null || fingerprint===undefined) return callback(); // scan finished
    if (!isInScope) return that._processNext(handlers, callback);
    that._totalScanned = that. _totalScanned + 1;
    that._logProgress();
    var h = handlers.slice(0);
    return that._processNextHandler(h, fingerprint, stats, isInScope, false, false, function(err, processed, failed) {
      if (err) { return callback(err); }
      if (failed) that._totalErrors = that._totalErrors  + 1;
      else if (processed) that._totalProcessed = that._totalProcessed + 1;
      return that._processNext(handlers, callback);
    });
  });
}

// Process fingerprint for next handler
ReverseScanner.prototype._processNextHandler = function(handlers, fingerprint, stats, isInScope, processed, failed, callback) {
  var that = this;
  if (handlers.length === 0) return callback(null, processed, failed); // finished
  var handler = handlers.shift();
  log.debug({ fingerprint:fingerprint.longFilename, handler:handler.getName()}, "Processing fingerprint with handler");
  return handler.processNext(fingerprint, stats, isInScope, that._scanOptions, function(err, wasProcessed) {
    if (err) {
      log.error({ fingerprint:fingerprint.uuid, handler:handler.getName(), err:err, message:err.message, stack:err.stack }, "Failed to process fingerprint");
      failed = true;
      that._currentFileIsError = true;
      return that._processNextHandler(handlers, fingerprint, stats, isInScope, processed, failed, callback);
    }
    log.debug({ processed:processed, wasProcessed:wasProcessed }, "Debug progress");
    processed = processed | wasProcessed;
    return that._processNextHandler(handlers, fingerprint, stats, isInScope, processed, failed, callback);
  });
}



/** ================================================================================
  * VanishedFiles Scanner
  *
  * This is a reverse-scanner handler which walks every fingerprint in the database and
  * look if the original file still exists on the file system
  * ================================================================================ */

/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
 VanishedFilesHandler = function(reverseScanner) {
  this._reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
VanishedFilesHandler.prototype.getName = function() { return "VanishedFilesHandler"; };

/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * The VanishedFilesHandler will detect if a file was removed or restored in the filesystem
 * and update the fingerPrint's vanishedAt attribute accordingly
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
VanishedFilesHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  var isChanged = false;

  // Check if file has vanished, and if so mark it
  var vanished = !isInScope || stats===null || stats===undefined || stats.size===0;
  var wasVanished = fingerprint.vanishedAt !== null && fingerprint.vanishedAt !== undefined;
  var newFingerPrint = { uuid: fingerprint.uuid };
  var reasons = [];
  if (vanished !== wasVanished) {
    isChanged = true;
    if (vanished) {
      reasons.push("File newly vanished");
      //newFingerPrint.vanishedAt = function() { return "current_timestamp"; };
      newFingerPrint.vanishedAt = that._reverseScanner.getStorageDelegate().getVanishedAt();
    }
    else {
      reasons.push("File reappeared");
      newFingerPrint.vanishedAt = null;
    }
  }

  // Patch the fingerprint
  if (!isChanged) return callback(null, false);
  log.info({ fingerprint:fingerprint.longFilename, newFingerPrint:newFingerPrint, reasons:reasons }, "Updating fingerprint");
  log.debug({ fingerprint:fingerprint.longFilename, newFingerPrint:newFingerPrint, reasons:reasons }, "Vanished handler processing next file");
  return that._reverseScanner.getStorageDelegate().updateFingerprint(newFingerPrint, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });

  return callback();
}





/** ================================================================================
  * Scan collection
  * ================================================================================ */

/**
 * @param {StorageDelegate} storageDelegate - is the storage storageDelegate (ie the database storage interface)
 * @param {ProgressDelegate} progressDelegate - 
 * @param {FilesScope | DirectoryScope } - the scan scope (ie the subset of the file system to scan)
 * @param {ReverseScanHandler[]} handlers - a list of handlers through which each fingerprint will be processed
 * @param scanOptions - additional options for the scanner
 *
 * @param callback    Is the return function
 *                      err               is the error object/message
 *                      stats             is the scanner results
 *
 */
function scan(storageDelegate, progressDelegate, scope, handlers, scanOptions, callback) {
  var that = this;
  log.debug({ scope:scope.getName()}, "Scanner.scan");
  progressDelegate.scanStarted(scope, handlers, scanOptions);

  var cumulatedStats = {
    forward: { scanned: 0, processed: 0, errors: 0 },
    reverse: { scanned: 0, processed: 0, errors: 0 }
  };

  var scanner = new FingerprintsScanner(storageDelegate, progressDelegate, scope, scanOptions);
  return scanner.scan(function(err, stats) {
    if (err) return callback(err);

    var fstats = cumulatedStats.forward;
    fstats.scanned = fstats.scanned + stats.scanned;
    fstats.processed = fstats.processed + stats.processed;
    fstats.errors = fstats.errors + stats.errors;

    scanner = new ReverseScanner(storageDelegate, progressDelegate, scope, scanOptions);
    handlers = [VanishedFilesHandler].concat(handlers);

    // Create handlers
    var instanciatedHandlers = [];
    for (var i=0; i<handlers.length; i++) {
      var handler = handlers[i];
      handler = new handler(scanner, scanOptions);
      instanciatedHandlers.push(handler);
    }

    return scanner.scan(instanciatedHandlers, function(err, stats) {
      if (err) return callback(err);
      var rstats = cumulatedStats.reverse;
      rstats.scanned = rstats.scanned + stats.scanned;
      rstats.processed = rstats.processed + stats.processed;
      rstats.errors = rstats.errors + stats.errors;

      progressDelegate.scanEnded();
      return callback(null, cumulatedStats);
    });

  });
}



/**
 * Public interface
 */
module.exports = {
  scan:               scan,
  newDirectoryScope:  function(folder)        { return new DirectoryScope(folder) },
  newFilesScope:      function(longFilenames) { return new FilesScope(longFilenames) }
}
