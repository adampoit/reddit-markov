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

var depth = 4;

function fetchComments(subreddit, callback, fetchAll) {
  limiter.removeTokens(1, function() {
    client.get(subreddit + ':last.comment.id', function (result, commentId) {
      var url = 'http://reddit.com/r/' + subreddit + '/comments.json';
      if (!fetchAll)
        url += '?before=' + commentId;

      request({
        url: url,
        json: true
      }, callback);
    });
  });
}

function processComments(subreddit) {
  fetchComments(subreddit, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      if (body.data.children.length > 0) {
        var commentId = body.data.children[0].data.name;
        console.log('Saving comments for ' + subreddit + ' up to ' + commentId);
        client.set(subreddit + ':last.comment.id', commentId, function() {
          _.each(body.data.children, function (comment) {
            var ngrams = NGrams.ngrams(tokenizer.tokenize(comment.data.body), depth, '!start!', '!end!');
            for (var i = 0; i < ngrams.length; i++) {
              client.hincrby(keys.generate(subreddit, _.initial(ngrams[i])), _.last(ngrams[i]), 1);
            }
          });
        });
      }
    }
    else {
      console.log(response);
    }

    processComments(subreddit);
  }, false);
}

function setInitialCommentId(subreddit, callback) {
  fetchComments(subreddit, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var commentId = body.data.children[0].data.name;
      console.log('Set initial commentId to ' + commentId);
      client.set(subreddit + ':last.comment.id', commentId, function() {
        callback(subreddit);
      });
    }
    else {
      console.log(response);
      setInitialCommentId(processComments);
    }
  }, true);
}

var subreddits = process.argv.slice(2);

_.each(subreddits, function (subreddit) {
  setInitialCommentId(subreddit, processComments);
});
