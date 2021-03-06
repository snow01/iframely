var request = require('request');
var _ = require('underscore');
var crypto = require('crypto');
var cache = require('./cache');

var version = require('../package.json').version;

var hash = function(value) {
    return '"' + crypto.createHash('md5').update(value).digest("hex") + '"';
};

/*
* Wrapper for original request lib. Adds caching.
*
* Params:
*
* - options - proxy for original `request` options.
*
* - options.prepareResult - function called as `request` callback with (error, response, data, cb).
*   - error, data - as usual in `request`.
*   - response - object with single attr - statusCode. Another not needed yet.
*   - cb - callback to receive prepared data from plugin. If plugin sent `error` to this function then _result will not be cached_.
*
* - callback - final callback will called with data received from `prepareResult`.
*
* */
module.exports = function(options, callback) {

    options = _.extend({}, options);

    if (typeof options.prepareResult !== 'function') {
        console.error('cached request call error: prepareResult not a function');
    }

    var prepareResult = options.prepareResult;
    var useCacheOnly = options.useCacheOnly;

    delete options.prepareData;
    delete options.useCacheOnly;

    var prefix = CONFIG.API_REQUEST_CACHE_PREFIX ? (CONFIG.API_REQUEST_CACHE_PREFIX + ':') : '';

    var key = 'req:' + prefix + hash(JSON.stringify(options));

    cache.get(key, function(error, data) {

        if (!error && data) {

            // Send cached data up.
            prepareResult(null, _.extend(data.response, {fromRequestCache: true}), data.data, callback);

        } else if (useCacheOnly) {

            callback('no-cache');

        } else {

            request(options, function(error, response, data) {

                prepareResult(error, response, data, function(error, preparedData) {

                    if (!error) {
                        // If data prepared without error - cache it.
                        cache.set(key, {
                            response: {
                                statusCode: response && response.statusCode,
                                headers: response.headers
                            },
                            data: data
                        }, {
                            ttl: CONFIG.API_REQUEST_CACHE_TTL
                        });
                    }

                    // Send prepared data up.
                    callback(error, preparedData);
                });
            });
        }
    });
};