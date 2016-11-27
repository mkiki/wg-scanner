/**
 * wg-scanner - Module build
 */
// (C) Alexandre Morin 2015 - 2016

const gulp = require('gulp');
const del = require('del');
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
const gutil = require('gulp-util');

// Generates the following artifacts
// build/<module name>-<verion>/            => the uncompressed build result
// dist/<module name>-<verion>.tar.gz/      => the archiveed and compressed build result

var pjson = require('./package.json');
var date = new Date().toISOString().replace(/[^0-9]/g, '');
var tarFile = pjson.name + "-" + pjson.version + ".tar";
var distFile = tarFile + ".gz";
var dir = pjson.name + "-" + pjson.version;

/**
 * Delete previous build
 */
gulp.task('clean', function() {
  del(["build/" + dir + "/**", "dist/" + distFile]);
});

/**
 * Generate new build
 */
gulp.task('build', function() {
  
  gulp.src([
        "src/*.js",
        "package.json",
        "index.js"
    ], { base: '.' })

    .pipe(gulp.dest("build/" + dir))
    .on('end', function() {

    	gulp.src(["**/*"], { cwd:__dirname + "/build/" + dir })    // gzip does not honor base properly
    		.pipe(tar(tarFile))
    		.pipe(gzip())
    		.pipe(gulp.dest("dist"))
    		.on('end', function() {

    			gutil.log(pjson.name + " version " + pjson.version + " generated in " + __dirname + "/dist/" + distFile);

    		});
    });
});


gulp.task('default', ['build']);

