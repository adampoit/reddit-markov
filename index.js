var _ = require('underscore'),
  redis = require('redis'),
  client = redis.createClient(32768, '192.168.99.100'),
  keys = require('./util/keys'),
  express = require('express'),
  bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function nextWord(key) {
  return client.hgetallAsync(key)
    .then(function (data) {
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

      return nextWord;
  });
}

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

function generateSentence(key, sentence)
{
  return nextWord(key)
    .then(function(word) {
      if (word == null || word == '!end!')
        return sentence;

      sentence += formatWord(word);
      var nextKey = keys.getNext(key, word);

      return generateSentence(nextKey, sentence);
    });
}

var app = express();

app.get('/:subreddit', function(req, res) {
  var subreddit = req.params.subreddit;
  var depth = req.query.depth;
  var key = keys.generate(subreddit, _.range(depth).map(function () { return '!start!' }));

  var sentence = '';
  generateSentence(key, sentence)
    .then(function (sentence) {
      res.send(sentence);
    });
});

app.listen(8080);
