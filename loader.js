var Snoocore = require('snoocore'),
  util = require('util'),
  _ = require('underscore'),
  redis = require('redis'),
  client = redis.createClient(),
  keys = require('./util/keys'),
  natural = require('natural'),
  tokenizer = new natural.TreebankWordTokenizer(),
  NGrams = natural.NGrams;

var reddit = new Snoocore({
  userAgent: 'markov@1.0.0',
  throttle: 300,
  oauth: {
    type: 'implicit',
    key: 'VqhNmheQrdsnlg',
    redirectUri: 'http://localhost:3000',
    scope: [ 'read' ]
  }
});

var depth = 4;

function load() {
  client.get('wow:last.comment.id', function (result, commentId) {
    reddit('/r/$subreddit/comments').listing({
      $subreddit: 'wow',
      limit: 100,
      before: commentId
    }).then(function(slice) {
      if (!slice.empty) {
        var commentId = slice.children[0].data.name;
        console.log('Saving comments up to ' + commentId);
        client.set('wow:last.comment.id', commentId, function() {
          _.each(slice.children, function (comment) {
            var ngrams = NGrams.ngrams(tokenizer.tokenize(comment.data.body), depth, '!start!', '!end!');
            for (var i = 0; i < ngrams.length; i++) {
              client.hincrby(keys.generate('wow', _.initial(ngrams[i])), _.last(ngrams[i]), 1);
            }
          });
        });
      }

      load();
    });
  });
}

load();
