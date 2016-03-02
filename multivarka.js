'use strict';
const MongoClient = require('mongodb').MongoClient;

function doQuery(objectForQuery, callback) {
    MongoClient.connect(objectForQuery.url, function (err, db) {
        if (err) {
            return console.log(err);
        }
        let collection = db.collection(objectForQuery.collectionName);
        objectForQuery.queryFunction(collection, function (err, result) {
            callback(err, result);
            db.close();
        });
    });
}

function createOperation(objectForQuery) {
    let operations = {
        find: function (callback) {
            let func = function (collection, innerCallback) {
                collection.find(objectForQuery.query).toArray(innerCallback);
            };
            objectForQuery.queryFunction = func;
            doQuery(objectForQuery, callback);
        },
        remove: function (callback) {
            let func = function (collection, innerCallback) {
                collection.deleteMany(objectForQuery.query, innerCallback);
            };
            objectForQuery.queryFunction = func;
            doQuery(objectForQuery, callback);
        },
        insert: function (newObject, callback) {
            let func = function (collection, innerCallback) {
                collection.insertOne(newObject, innerCallback);
            };
            objectForQuery.queryFunction = func;
            doQuery(objectForQuery, callback);
        },
        set: function (newField, value) {
            let innerQuery = {};
            innerQuery[newField] = value;
            let setQuery = {$set: innerQuery};
            _this = this;
            return {
                update: function (callback) {
                    let func = function (collection, innerCallback) {
                        collection.updateMany(objectForQuery.query, setQuery, innerCallback);
                    };
                    objectForQuery.queryFunction = func;
                    doQuery(objectForQuery, callback);
                }
            };
        },
        where: function (field) {
            return createQuery(objectForQuery, field);
        }
    };
    return operations;
}

function createQuery(objectForQuery, field, not) {
    let queryParams = {
        not: function () {
            return createQuery(objectForQuery, field, true);
        },
        equal: function (param) {
            let query = not ? { $ne: param } : param;
            return this.addQuery(query);
        },
        lessThan: function (num) {
            let query = not ? { $gte: num } : { $lt: num };
            return this.addQuery(query);
        },
        greatThan: function (num) {
            let query = not ? { $lte: num } : { $gt: num };
            return this.addQuery(query);
        },
        include: function (params) {
            let query = not ? { $nin: params } : { $in: params };
            return this.addQuery(query);
        },
        addQuery: function (newQuery) {
            let query = {};
            query[field] = newQuery;
            objectForQuery.query['$and'].push(query);
            return createOperation(objectForQuery);
        }
    };
    return queryParams;
}

let ObjectForQuery = function (url, collectionName) {
    this.url = url;
    this.collectionName = collectionName;
    this.where = function (field) {
        return createQuery(this, field);
    };
    this.insert = function (newObject, callback) {
        createOperation(this).insert(newObject, callback);
    };
    this.query = {$and:[]};
    this.queryFunction = null;
};

module.exports.server = function (url) {
    let collection = {
        collection: function (collectionName) {
            return new ObjectForQuery(url, collectionName);
        }
    };
    return collection;
};
