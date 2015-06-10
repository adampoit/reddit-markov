var _ = require('underscore'),
  redis = require('redis'),
  client = redis.createClient(),
  keys = require('./util/keys'),
  clipboard = require('copy-paste');

var nextWord = function(key, callback) {
  client.exists(key, function(err, data) {
    if (data == null) { callback(null); }
    else {
      client.hgetall(key, function(result, data) {
        var sum = 0;

        for (var i in data)
            sum += parseInt(data[i]);

        var rand = Math.floor(Math.random()*sum+1);
        var partial_sum = 0;
        var nextWord = null;
        for (var i in data) {
            partial_sum += parseInt(data[i]);
            if (partial_sum >= rand) {
              nextWord = i;
              break;
            }
        }

        var nextKey = keys.getNext(key, nextWord);
        if (nextWord == '!end!')
          callback (null);
        else
          callback(nextKey, nextWord);
      });
    }
  });
}

var sentence = null;

function formatWord(word) {
  if (/^[\(\)"]$/.test(word)) {
    return '';
  }
  else if (word == "n't" || /^[.,'?!;:]/.test(word)) {
    return word;
  }
  else {
    return ' ' + word;
  }
}

function build(key, word) {
  if (word == null) {
    console.log(sentence);
    clipboard.copy(sentence);
    client.end();
    return;
  }

  if (sentence == null)
    sentence = word;
  else
    sentence += formatWord(word);

  nextWord(key, build);
}

var key = keys.generate('wow', [ '!start!', '!start!', '!start!' ]);

nextWord(key, build);
