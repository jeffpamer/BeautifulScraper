var request = require('request');
var fs = require('fs');
var cheerio = require('cheerio');
var ASQ = require('asynquence');

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

var app = function(searchURL, previousStatsFilename) {
    ASQ(searchURL, previousStatsFilename)
    .gate(getCurrentRepoCount, getPreviousRepoCount)
    .then(console.log)

    .or(function(err) {
        console.log(err);
    });
};

app('http://github.com/search?o=desc&q=beautiful&s=updated&type=Repositories', './previous.json');


