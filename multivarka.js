var MongoClient = require('mongodb').MongoClient;

function doQuery(objectForQuery) {
    var findObj = {
        find: function (callback) {
            MongoClient.connect(objectForQuery.url, function (err, db) {
                if (err) {
                    return console.log(err);
                }
                var col = db.collection(objectForQuery.collectionName);
                col.find(objectForQuery.query).toArray(function (err, result) {
                    callback(err, result);
                    db.close();
                });
            });
        }
    };
    return findObj;
};

function createQuery(objectForQuery, field, not) {
    var operations = {
        not: function () {
            return createQuery(objectForQuery, field, true);
        },
        equal: function (param) {
            var query = not ? { $ne: param } : param;
            return this.addQuery(query);
        },
        lessThan: function (num) {
            var query = not ? { $gte: num } : { $lt: num };
            return this.addQuery(query);
        },
        greatThan: function (num) {
            var query = not ? { $lte: num } : { $gt: num };
            return this.addQuery(query);
        },
        include: function (params) {
            var query = not ? { $nin: params } : { $in: params };
            return this.addQuery(query);
        },
        addQuery: function (newQuery) {
            objectForQuery.query[field] = newQuery;
            return doQuery(objectForQuery);
        }
    };
    return operations;
}

var ObjectForQuery = function (url, collectionName) {
    this.collectionName = collectionName;
    this.url = url;
    this.where = function (field) {
        return createQuery(this, field);
    };
    this.query = {};
};

module.exports.server = function (url) {
    var collection = {
        collection: function (collectionName) {
            return new ObjectForQuery(url, collectionName);
        }
    };
    return collection;
};
