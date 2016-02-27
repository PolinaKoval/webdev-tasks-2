var MongoClient = require('mongodb').MongoClient;

function doQuery(objectForQuery, callback) {
    MongoClient.connect(objectForQuery.url, function (err, db) {
        if (err) {
            return console.log(err);
        }
        var collection = db.collection(objectForQuery.collectionName);
        objectForQuery.queryFunction(collection, function (err, result) {
            callback(err, result);
            db.close();
        });
    });
}

function createOperation(objectForQuery) {
    var operations = {
        find: function (callback) {
            var func = function (collection, innerCallback) {
                collection.find(objectForQuery.query).toArray(innerCallback);
            };
            objectForQuery.queryFunction = func;
            doQuery(objectForQuery, callback);
        },
        remove: function (callback) {
            var func = function (collection, innerCallback) {
                collection.deleteMany(objectForQuery.query, innerCallback);
            };
            objectForQuery.queryFunction = func;
            doQuery(objectForQuery, callback);
        },
        insert: function (newObject, callback) {
            var func = function (collection, innerCallback) {
                collection.insertOne(newObject, innerCallback);
            };
            objectForQuery.queryFunction = func;
            doQuery(objectForQuery, callback);
        },
        set: function (newField, value) {
            var innerQuery = {};
            innerQuery[newField] = value;
            var setQuery = {$set: innerQuery};
            _this = this;
            return {
                update: function (callback) {
                    var func = function (collection, innerCallback) {
                        collection.updateMany(objectForQuery.query, setQuery, innerCallback);
                    };
                    objectForQuery.queryFunction = func;
                    doQuery(objectForQuery, callback);
                }
            };
        }
    };
    return operations;
}

function createQuery(objectForQuery, field, not) {
    var queryParams = {
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
            return createOperation(objectForQuery);
        }
    };
    return queryParams;
}

var ObjectForQuery = function (url, collectionName) {
    this.url = url;
    this.collectionName = collectionName;
    this.where = function (field) {
        return createQuery(this, field);
    };
    this.insert = function (newObject, callback) {
        createOperation(this).insert(newObject, callback);
    };
    this.query = {};
    this.queryFunction = null;
};

module.exports.server = function (url) {
    var collection = {
        collection: function (collectionName) {
            return new ObjectForQuery(url, collectionName);
        }
    };
    return collection;
};
