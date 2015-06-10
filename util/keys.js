var _ = require('underscore');

var keySeparator = ':';
var tokenSeparator = '\x01';

module.exports.generate = function(prefix, tokens) {
  return prefix + keySeparator + _.reduce(tokens, function (key, token) { return key + tokenSeparator + token; });
}

module.exports.getNext = function(currentKey, word) {
  var match = currentKey.match('([^:]*)' + keySeparator + '(.*)');
  var prefix = match[1];
  var tokens = match[2].split(tokenSeparator);

  return this.generate(prefix, _.rest(tokens).concat(word));
}
