'use strict';
const MongoClient = require('mongodb').MongoClient;

module.exports.server = url => ({
    collection: colName => new ObjectForQuery(url, colName)
});

const MongoFunc = {
    find: function (innerCallback) {
        this.collection.find(correctQuery(this.query)).toArray(innerCallback);
    },
    remove: function (innerCallback) {
        this.collection.deleteMany(correctQuery(this.query), innerCallback);
    },
    update: function (innerCallback) {
        this.collection.updateMany(correctQuery(this.query),
            correctQuery(this.setQuery, '$set'), innerCallback);
    },
    insert: function (innerCallback) {
        this.collection.insertOne(this.insertObj, innerCallback);
    }
};

function correctQuery(query, key) {
    key = key || '$and';
    return Object.keys(query).length ? {[key]: query} : {};
}

const operations = {
    find: function (callback) {
        this.doQuery('find', callback);
    },
    remove: function (callback) {
        this.doQuery('remove', callback);
    },
    update: function (callback) {
        this.doQuery('update', callback);
    },
    insert: function (newObj, callback) {
        this.doQuery('insert', callback, newObj);
    },
    where: function (field) {
        return new ParamsSetter(this, field ? [field] : []);
    },
    set: function (newField, value) {
        if (arguments.length == 2) {
            this.setQuery[newField] = value;
        }
        return this;
    }
};

let ParamsSetter = function (queryObj, fields, not) {
    let index = not ? 1 : 0;
    this.not = () => new ParamsSetter(queryObj, fields, true);
    this.equal = value => this.addParam(value, ['$eq', '$ne'][index]);
    this.lessThan = num => this.addParam(num, ['$lt', '$gte'][index]);
    this.greatThan = num => this.addParam(num, ['$gt', '$lte'][index]);
    this.include = value => this.addParam(value, ['$in', '$nin'][index]);
    this.where = field => {
        fields.push(field);
        return new ParamsSetter(queryObj, fields, not);
    };
    this.addParam = (value, param) => {
        let newQuery = {[param]: value};
        let queries = fields.map(field => ({[field]: newQuery}));
        [].push.apply(queryObj.query, queries);
        return queryObj;
    };
};

let ObjectForQuery = function (url, collectionName) {
    this.url = url;
    this.collectionName = collectionName;
    this.query = [];
    this.setQuery = {};
    this.queryFunc = null;
    this.doQuery = doQuery;
    Object.setPrototypeOf(this, operations);
};

function doQuery(operation, callback, insertObj) {
    this.insertObj = insertObj || null;
    this.queryFunc = MongoFunc[operation];
    connectMongo.call(this, callback);
};

function connectMongo(callback) {
    MongoClient.connect.call(this, this.url, (err, db) => {
        if (err) {
            return console.log(err);
        }
        this.collection = db.collection(this.collectionName);
        this.queryFunc(function (err, result) {
            callback(err, result);
            db.close();
        });
    });
}
