var util = require('util'),
  _ = require('underscore'),
  redis = require('redis'),
  client = redis.createClient(),
  keys = require('./util/keys'),
  natural = require('natural'),
  tokenizer = new natural.TreebankWordTokenizer(),
  NGrams = natural.NGrams,
  RateLimiter = require('limiter').RateLimiter,
  limiter = new RateLimiter(1, 'minute'),
  request = require('request');

var depth = 4;

function fetchComments() {
  limiter.removeTokens(1, function() {
    client.get('wow:last.comment.id', function (result, commentId) {
      request({
        url: 'http://reddit.com/r/wow/comments.json?before=' + commentId,
        json: true
      }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          if (body.data.children.length > 0) {
            var commentId = body.data.children[0].data.name;
            console.log('Saving comments up to ' + commentId);
            client.set('wow:last.comment.id', commentId, function() {
              _.each(body.data.children, function (comment) {
                var ngrams = NGrams.ngrams(tokenizer.tokenize(comment.data.body), depth, '!start!', '!end!');
                for (var i = 0; i < ngrams.length; i++) {
                  client.hincrby(keys.generate('wow', _.initial(ngrams[i])), _.last(ngrams[i]), 1);
                }
              });

              fetchComments();
            });
          }
        }
      });
    });
  });
}

fetchComments();
