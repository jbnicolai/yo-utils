'use strict';
var path = require('path');
var fs = require('fs');

/**
 * @namespace yo-utils.templating
 * @borrows module:yo-utils/lib/templating.relativePathTo as relativePathTo
 * @borrows module:yo-utils/lib/templating.rewriteFile as rewriteFile
 * @borrows module:yo-utils/lib/templating.rewrite as rewrite
 * @borrows module:yo-utils/lib/templating.processDirectory as processDirectory
 */

/**
 * Templating related utilities
 * @module yo-utils/lib/templating
 */

/**
 * Returns a relative path used to require the 'to' file in the 'from' file
 * @alias module:yo-utils/lib/templating.relativePathTo
 * @param  {String}  from  - file path to the from file
 * @param  {String}  to    - file path to the to file
 * @param  {Boolean} strip - whether to strip the index file name and/or the js ext
 * @return {String}        - relative path to be used in require statements
 */
function relativePathTo(from, to, strip) {
  var relPath = path.relative(from.replace(path.basename(from), ''), to);
  if (relPath.match(/^\.\.?(\/|\\)/) === null) { relPath = './' + relPath; }
  if (strip) { return relPath.replace(/((\/|\\)index\.js|\.js)$/, ''); }
  return relPath;
}

/**
 * Rewrite a single file in place
 * @alias module:yo-utils/lib/templating.rewriteFile
 * @param  {Object} args - rewrite arguments, file, and path
 */
function rewriteFile(args) {
  args.path = args.path || process.cwd();
  var fullPath = path.join(args.path, args.file);

  args.haystack = fs.readFileSync(fullPath, 'utf8');
  var body = rewrite(args);

  fs.writeFileSync(fullPath, body);
}

/**
 * Rewrite a body of text
 * @alias module:yo-utils/lib/templating.rewrite
 * @param  {Object} args - rewrite arguments
 * @return {String}      - the rewritten body of text
 */
function rewrite(args) {
  // check if splicable is already in the body text
  var re = new RegExp(args.splicable.map(function(line) {
    return '\\s*' + escapeRegExp(line);
  }).join('\n'));

  if (re.test(args.haystack)) {
    return args.haystack;
  }

  var lines = args.haystack.split('\n');

  var otherwiseLineIndex = -1;
  lines.forEach(function(line, i) {
    if (line.indexOf(args.needle) !== -1) {
      otherwiseLineIndex = i;
    }
  });
  if (otherwiseLineIndex === -1) { return lines.join('\n'); }

  var spaces = 0;
  while (lines[otherwiseLineIndex].charAt(spaces) === ' ') {
    spaces += 1;
  }

  var spaceStr = '';
  while (spaces > 0) {
    spaces -= 1;
    spaceStr += ' ';
  }

  lines.splice(otherwiseLineIndex + 1, 0, args.splicable.map(function(line) {
    return spaceStr + line;
  }).join('\n'));

  return lines.join('\n');
}

/**
 * Process an entire directory filtering and templating accordingly
 * @alias module:yo-utils/lib/templating.processDirectory
 * @param  {Object} self        - the generator
 * @param  {String} source      - the path to the directory to be processed
 * @param  {String} destination - the path to where the processed direcory should be written to
 */
function processDirectory(self, source, destination) {
  var root = self.isPathAbsolute(source) ? source : path.join(self.sourceRoot(), source);
  var files = self.expandFiles('**', { dot: true, cwd: root });
  var dest;
  var src;

  files.forEach(function(f) {
    var filteredFile = filterFile(f);
    if (self.name) {
      filteredFile.name = filteredFile.name.replace('name', self.name);
    }
    var name = filteredFile.name;
    var copy = false;
    var stripped;

    src = path.join(root, f);
    dest = path.join(destination, name);

    if (path.basename(dest).indexOf('_') === 0) {
      stripped = path.basename(dest).replace(/^_/, '');
      dest = path.join(path.dirname(dest), stripped);
    }

    if (path.basename(dest).indexOf('!') === 0) {
      stripped = path.basename(dest).replace(/^!/, '');
      dest = path.join(path.dirname(dest), stripped);
      copy = true;
    }

    if (templateIsUsable(self, filteredFile)) {
      if (copy) {
        self.copy(src, dest);
      } else {
        self.template(src, dest);
      }
    }
  });
}

module.exports.relativePathTo = relativePathTo;
module.exports.rewriteFile = rewriteFile;
module.exports.rewrite = rewrite;
module.exports.processDirectory = processDirectory;

/**
 * Private functions
 */

/**
 * Escape regexp special chars
 * @param  {String} str - the string to be escaped
 * @return {String}     - the escaped string
 */
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

/**
 * Parse a filtered filename and return the processed name and filters
 * @param  {String} template - the file path to the template
 * @return {Object}          - contains the processed name and filters array
 */
function filterFile(template) {
  // Find matches for parans
  var filterMatches = template.match(/\(([^)]+)\)/g);
  var filters = [];
  if (filterMatches) {
    filterMatches.forEach(function(filter) {
      filters.push(filter.replace('(', '').replace(')', ''));
      template = template.replace(filter, '');
    });
  }

  return { name: template, filters: filters };
}

/**
 * Check whether or not a template is usable based on filters
 * @param  {Object} self         - the generator
 * @param  {Object} filteredFile - the processed template object
 * @return {Boolean}             - whether the template is usable based on filters
 */
function templateIsUsable(self, filteredFile) {
  var filters = self.config.get('filters');
  var enabledFilters = [];
  for (var key in filters) {
    if (filters[key]) { enabledFilters.push(key); }
  }
  var matchedFilters = self._.intersection(filteredFile.filters, enabledFilters);
  // check that all filters on file are matched
  if (filteredFile.filters.length && matchedFilters.length !== filteredFile.filters.length) {
    return false;
  }
  return true;
}
