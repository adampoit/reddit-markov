var util = require('util'),
  _ = require('underscore'),
  redis = require('redis'),
  client = redis.createClient(),
  keys = require('./util/keys'),
  natural = require('natural'),
  tokenizer = new natural.TreebankWordTokenizer(),
  NGrams = natural.NGrams,
  RateLimiter = require('limiter').RateLimiter,
  limiter = new RateLimiter(1, 3000),
  request = require('request');

var maxDepth = 4;

function fetchComments(subreddit, callback) {
  limiter.removeTokens(1, function () {
    client.get(subreddit + ':last.comment.id', function (result, commentId) {
      var url = 'http://reddit.com/r/' + subreddit + '/comments.json';

      request({
        url: url,
        json: true
      }, function (error, response, body) {
        var comments = [];
        if (!error && response.statusCode === 200) {
          for (var comment of body.data.children) {
            if (comment.data.name == commentId)
              break;

            comments.push(comment);
          }
        }
        else {
          console.log(response);
        }

        callback(comments);
      });
    });
  });
}

function saveComments(subreddit, comments, depth) {
  for (var comment of comments) {
    var ngrams = NGrams.ngrams(tokenizer.tokenize(comment.data.body), depth, '!start!', '!end!');
    for (var set of ngrams) {
      client.hincrby(keys.generate(subreddit, _.initial(set)), _.last(set), 1);
    }
  }
}

function processComments() {
  var subreddit = subreddits.shift();
  console.log('Loading ' + subreddit);

  fetchComments(subreddit, function (comments) {
    if (comments.length != 0) {
      for (var depth of _.range(2, maxDepth + 1))
        saveComments(subreddit, comments, depth);

      console.log('Saved ' + comments.length + ' comments for ' + subreddit + ' up to ' + comments[0].data.name);

      client.set(subreddit + ':last.comment.id', comments[0].data.name);
    }

    subreddits.push(subreddit);
    processComments();
  });
}

var subreddits = process.argv.slice(2);

processComments();
