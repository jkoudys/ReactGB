/*
 * gulpfile.js
 * 
 * All automated tasks should find a home in here.
 */

var gulp = require('gulp');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var babelify = require('babelify');
var browserify = require('browserify');
var less = require('gulp-less');

const path = {
  CSS: './css',
  JS: './js',
  PUBLIC: './public'
};

// Load our .less files and transpile into CSS
gulp.task('css', function() {
  return gulp.src(path.CSS + '/screen.less')
    .pipe(less({compress: false}))
    .pipe(gulp.dest(path.PUBLIC + '/css/'));
});

// Load the ReactJS JSXes and build our app JS
gulp.task('js', function() {
  return browserify({
    entries: [path.JS + '/shims.js', path.JS + '/app.jsx'],
    transform: [babelify],
    extensions: ['jsx']
  })
    .bundle()
    .pipe(source('gameboy-emulator.js'))
    .pipe(gulp.dest(path.PUBLIC + '/js'));
});

gulp.task('default', function() {
});
