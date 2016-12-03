# File scanner / walker


Scanners are used to walk the file system and compute fingerprints for each file.

```Fingerprints``` are stored in a long-term storage, usually a database.

* A forward scanner actually walks the file system and process each file in turn.
* A reverse scanner walks the long term storage and match it with the file system

File system is accessed through Scopes. A ```Scope``` provides an iterator interface and
allow inclusion and exclusion, such as excluding .DS_Store file, or files of a certain
type or too big or too small...

* a ```FileScope``` can be used to scan individual files
* a ```DirectoryScope``` can be used to scan folders and hierarchies

Long term storage API (usually a database) is provided through the ```StoreDelegate```
interface. It basically allow to query and update fingerprints

Forward scan is implemented through the ```FingerprintsScanner``` who's role is basically
to iterate throufh a scope, create fingerprints for new files, or update fingerprints
for changed files. Unchanged files are ignored unless the force:true option is passed.
For each fingerprint, we also compute the MD5 code.

Reverse scan is implemented through the ```ReverseScanner``` object. It's role is to
iterate over the stored fingerprints and call a set of handlers in turn for each fingerprint.
By default, a single handler is used, the ```VanishedFilesHandler``` who will detect if
the file for a fingerprint has been removed from the filesystem or restored. If so, the
fingerprint's vanishedAt attribute is set accordingly to the date/time at which we
detected the removal, or reset to NULL if the file has been restored.
Handlers implement the ```ReverseScanHandler``` interface.


## Installation

	npm link wg-log
	npm link wg-utils
	npm link wg-collections
	npm install


## Usage

	const Scanner = require('wg-scanner').Scanner;

Create a scope

	var scope = Scanner.newDirectoryScope("/tmp/images");
	scope.exclude([".DS_Store"]);

Create storage and progress delegates

	var storageDelegate = new DatabaseStorageDelegate(...
	var progressDelegate = new DatabaseProgressDelegate(...

Launch the scan

	var handlers = [ThumbnailsHandler, ExifHandler, DominantColorHandler];
	var scanOptions = { force: false };
	return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, scanOptions, function(err, cumulatedStats) {
		...
		
## Scopes

A ```FilesScope``` is used to scan individual files

	var scope = Scanner.newFilesScope(["/tmp/IMG-001.png", "/tmp/IMG-002.png"]);

A ```DirectoryScope``` is used to scan folder hierarchies and provides several builtin filetering mechanisms

	var scope = Scanner.newDirectoryScope("/tmp/images");
	scope.exclude([".DS_Store"]);
	scope.includeFiles(["*.jpg", "*.jpeg", "*.gif", "*.png"]);
	scope.exclude(["iPhoto Library", "iPhoto Library.migratedphotolibrary"]);
	scope.excludeFilesSmallerThan(512);
	scope.excludeFilesLargerThan(10*1024*1024);
	

## Fingerprints

<table>
<tr>
  <td> uuid </td>
  <td> string </td>
  <td> A unique identifier for this fingerprint </td>
</tr>
<tr>
  <td> shortFilename </td>
  <td> string </td>
  <td> The short file name on the file system (ex: "elephant.png") </td>
</tr>
<tr>
  <td> longFilename </td>
  <td> string </td>
  <td> The long file name on the file system (ex: "/tmp/elephant.png") </td>
</tr>
<tr>
  <td> mtime </td>
  <td> number </td>
  <td> The modification time of the file on the file system referential (from lstat command) </td>
</tr>
<tr>
  <td> size </td>
  <td> number </td>
  <td> The file size, in bytes </td>
</tr>
<tr>
  <td> md5 </td>
  <td> string </td>
  <td> The md5 checksum of the file </td>
</tr>
<tr>
  <td> vanishedAt </td>
  <td> string </td>
  <td> Non null if the file vanished from the file system. Represents the date+time at which the file was found vanished </td>
</tr>
</table>

## Storage deletages

A storage delegate is responsible for persisting (storing) or retreiving fingerprints, typically from a database.

	var storageDelegate = {
	  getFingerPrint: function(longFilename, callback) { ...
	  getFingerPrints: function(folder, offset, limit, callback) { ...
	  countFingerPrints: function(folder, callback) { ...
	  updateFingerprint: function(newFingerPrint, callback) { ...
	  insertFingerprint: function(newFingerPrint, callback) { ...
	  preLoadFingerprints: function(longFilename, count, callback) { ...
	  getVanishedAt: function() { ...
	};

## Progress delegates

A progress delegate can be created to monitor a scanner. It will be called at all major stages of the scan.

	var progressDelegate = {
	  scanStarted: function(scope, handlers, scanOptions) { ...
	  scanEnded: function() { ...
	  forwardScanStarted: function() { ...
	  forwardScanProgress: function(scanned, processed, inserted, updated) { ...
	  forwardScanEnded: function() { ...
	  reverseScanStarted: function() { ...
	  reverseScanProgress: function(fingerprints, scanned, processed, errors) { ...
	  reverseScanEnded: function() { ...
	};

## Handlers

Implementing a handle only requires to implement the ```ReverseScanHandler``` interface.

The constructor passes the scanner (a ```ReverseScanner```) and the scanner options (as passed when running the scan)

	MyHandler = function(reverseScanner, scanOptions) {
  		this.reverseScanner = reverseScanner;
  		this.scanOptions = scanOptions;
	}

Each scanner must be given a name, it's mostly used for logging / troubleshooting purpose

	MyHandler.prototype.getName = function() { return "My handler"; };

Finally, the ```processNext``` function is called for each fingerprint that's scanned

	MyHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
		...

This function is passed the fingerprint itself, as well as the corresponding file metadata (fstat) which can be null if the file was removed from the file system since a previous scan. 
It's contract is to update the backend storage (database) if necessary. Typically, it will get ID3 tags, fetch image cover information... and update the database accordingly. It's this function responsibility to optimize the processing and avoid updating the database if nothing has changed since a previous scan.

