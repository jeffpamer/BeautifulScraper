var request = require('request');
var fs = require('fs');
var cheerio = require('cheerio');
var ASQ = require('asynquence');
var moment = require('moment');

var getHTML = function(done, url) {
    request(url, done);
};

var parseHTML = function(done, error, response, html) {
    if (!error) {
        var $ = cheerio.load(html);
        done($);
    } else {
        done.fail(error);
    }
};

var findRepoStats = function(done, $) {
    var repoCounter = $('ul.menu span.counter').eq(0);
    var repoCount = repoCounter.text();
    var unformattedRepoCount = parseInt(repoCount.replace(',', ''));

    var repoStats = {
        count: unformattedRepoCount,
        formattedCount: repoCount,
        timestamp: Date.now()
    };

    done(repoStats);
}

var getCurrentRepoCount = function(done, searchURL) {

    ASQ(searchURL)
    .then(getHTML)
    .then(parseHTML)
    .then(findRepoStats)
    .pipe(done);

};

var loadJSON = function(done, filename) {
    fs.readFile(filename, 'utf8', function (err, data) {
        if (err) {
            done.fail(err);
        } else {
            done(JSON.parse(data));
        }
    });
};

var getPreviousRepoCount = function(done, searchURL, previousStatsFilename) {
    ASQ(previousStatsFilename)
    .then(loadJSON)
    .pipe(done);
};

var compareRepoStats = function(done, currentStats, previousStats, searchURL, T) {
    var diff = currentStats.count - previousStats.count;
    var date = moment(previousStats.timestamp).format('MMM Do, YYYY');
    var comparison = '+' + diff;

    if (diff === 0) {
        comparison = 'No change'
    } else if (diff < 0) {
        comparison = '-' + diff;
    }

    var tweet = [currentStats.formattedCount, 'repos', '(' + comparison, 'since', date + ').', searchURL].join(' ');
    done(tweet, currentStats);
};

var tweetRepoStats = function(done, tweet, currentStats, T) {
    T.post('statuses/update', { status: stats }, function(err, data, response) {
        if (!err) {
            done(currentStats)
        } else {
            done.fail(err);
        }
    });
};

var writeStats = function(done, stats, filename) {
    fs.writeFile(filename, JSON.stringify(stats), function(err) {
        if (err) {
            done.fail(err);
        } else {
            done();
        }
    })   
};

var app = function(searchURL, previousStatsFilename) {
    var Twit = require('twit');
    var T = new Twit(require('./twitter.json'));

    ASQ(searchURL, previousStatsFilename)
    .gate(getCurrentRepoCount, getPreviousRepoCount)
    .then(function(done, currentStats, previousStats) {
        compareRepoStats(done, currentStats, previousStats, searchURL);
    })
    .then(function(done, tweet, currentStats) {
        tweetRepoStats(done, tweet, currentStats, T);
    })
    .then(function(done, currentStats) {
        writeStats(done, currentStats, previousStatsFilename);
    })

    .or(function(err) {
        console.log(err);
    });
};

app('http://github.com/search?o=desc&q=beautiful&s=updated&type=Repositories', './previous.json');
