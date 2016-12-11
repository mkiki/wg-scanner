  /**
   * Photo Organiser - Scanner unit tests
   *
   * (C) Alexandre Morin 2015 - 2016
   */

describe('Scanner', function() {

  const assert = require('assert');
  const helpers = require('./helpers.js');
  const Scanner = require('../lib/scanner.js');
  const Log = require('wg-log').Log;
  const fse = require('fs-extra');
  const uuid = require('uuid');
  const extend = require('extend');

  const log = Log.getLogger('scanner.tests');

  /**
   * Mock the store delegate (normally a database) through a simple map
   */
  var storageDelegate = helpers.storageDelegate;
  var progressDelegate = helpers.progressDelegate;

  function checkStats(cumulatedStats, fs, fp, fe, rs, rp, re) {
    assert.equal(cumulatedStats.forward.scanned, fs, "forward.scanned");
    assert.equal(cumulatedStats.forward.processed, fp, "forward.processed");
    assert.equal(cumulatedStats.forward.errors, fe, "forward.errors");
    assert.equal(cumulatedStats.reverse.scanned, rs, "reverse.scanned");
    assert.equal(cumulatedStats.reverse.processed, rp, "reverse.processed");
    assert.equal(cumulatedStats.reverse.errors, re, "reverse.errors");
  }

  /** ================================================================================
    * Test various collections
    * ================================================================================ */

  describe('Simple scans', function() {
    it('Should scan single file', function(done) {
      var scope = Scanner.newFilesScope([__dirname + "/data/certificate.png"]);
      var handlers = [];
      storageDelegate._clear();
      return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        assert(storageDelegate.test_length() === 1);
        var found = storageDelegate._getByShortFilename('certificate.png');
        assert(found !== undefined);
        assert(found.md5 === '925c25907ab0da4ea7dcbb30a3af867d');
        assert(found.size === 340309);
        assert(found.uuid === 'XXX-0');
        assert(found.vanishedAt === null);
        return done();
      });
    });

    it('Should scan a folder', function(done) {
      var dirName = __dirname + "/data/3 images";
      var scope = Scanner.newDirectoryScope(dirName);
      scope.exclude([".DS_Store"]);
      var handlers = [];
      storageDelegate._clear();
      return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 3, 3, 0, 3, 0, 0);
        assert(storageDelegate.test_length() === 3);
        var keys = storageDelegate._getSortedKeys();
        assert(keys[0] === dirName + "/18px-FClef.svg.png");
        assert(keys[1] === dirName + "/certificate.png");
        assert(keys[2] === dirName + "/query.png");
        return done();
      });
    });

    it('Should scan sub-folders', function(done) {
      var dirName = __dirname + "/data/hierarchy";
      var scope = Scanner.newDirectoryScope(dirName);
      scope.exclude([".DS_Store"]);
      var handlers = [];
      storageDelegate._clear();
      return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 3, 3, 0, 3, 0, 0);
        assert(storageDelegate.test_length() === 3, "Number of fingerprints");
        var keys = storageDelegate._getSortedKeys();
        assert(keys[0] === dirName + "/certificate.png");
        assert(keys[1] === dirName + "/sub folder/query.png");
        assert(keys[2] === dirName + "/sub folder/sub folder/18px-FClef.svg.png");
        return done();
      });
    });
  });

  describe('Rescans', function() {
    it('Should skip file the second time', function(done) {
      var scope = Scanner.newFilesScope([__dirname + "/data/certificate.png"]);
      var handlers = [];
      storageDelegate._clear();
      return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        assert(storageDelegate._getByShortFilename('certificate.png') !== undefined);

        // Rescan same file => should not reprocess anything
        return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
          if (err) return done(err);
          checkStats(cumulatedStats, 1, 0, 0, 1, 0, 0);
          assert(storageDelegate._getByShortFilename('certificate.png') !== undefined);

          return done();
        });
      });
    });
 
     it('Should rescan file the second time in force mode', function(done) {
      var scope = Scanner.newFilesScope([__dirname + "/data/certificate.png"]);
      var handlers = [];
      storageDelegate._clear();
      return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        assert(storageDelegate._getByShortFilename('certificate.png') !== undefined);

        // Rescan same file => should reprocess because of force mode
        return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {force:true}, function(err, cumulatedStats) {
          if (err) return done(err);
          checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
          assert(storageDelegate._getByShortFilename('certificate.png') !== undefined);

          return done();
        });
      });
    });
  });

  describe('File deletions and changes', function() {
    it('Should skip file the second time', function(done) { 

      // Create a temp working dir outside of git repo
      var tmp = '/tmp/willie.' + uuid.v4();
      log.info({tmp:tmp}, "Working in temp dir");
      fse.mkdirs(tmp);
      fse.copySync(__dirname + "/data/certificate.png", tmp + "/certificate.png");

      // Scan it a first time
      var scope = Scanner.newDirectoryScope(tmp);
      var handlers = [];
      storageDelegate._clear();
      return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        assert(storageDelegate.test_length() === 1);
        var found = storageDelegate._getByShortFilename('certificate.png');
        assert(found !== undefined);
        assert(found.size === 340309);
        assert(found.uuid === 'XXX-0');
        assert(found.vanishedAt === null);

        // Remove the file and scan again
        fse.removeSync(tmp+"/certificate.png");
        return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
          if (err) return done(err);
          checkStats(cumulatedStats, 0, 0, 0, 1, 1, 0);
          assert(storageDelegate.test_length() === 1);
          var found = storageDelegate._getByShortFilename('certificate.png');
          assert(found !== undefined);
          assert(found.size === 340309);
          assert(found.uuid === 'XXX-0');
          assert(found.vanishedAt !== null);

          // Put file back and rescan => the file should be "unvanished"
          fse.copySync(__dirname + "/data/certificate.png", tmp + "/certificate.png");
          return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, {}, function(err, cumulatedStats) {
            if (err) return done(err);
            checkStats(cumulatedStats, 1, 0, 0, 1, 1, 0);
            assert(storageDelegate.test_length() === 1);
            var found = storageDelegate._getByShortFilename('certificate.png');
            assert(found !== undefined);
            assert(found.size === 340309);
            assert(found.uuid === 'XXX-0');
            assert(found.vanishedAt === null);

            return done();
          });
        });
      });
    });
  });

});


