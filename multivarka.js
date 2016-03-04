'use strict';
const MongoClient = require('mongodb').MongoClient;

/**
 * @param {String} url - url на котором расположена база данных
 * @returns {Object} - объект с единственным полем collection, при вызове которого
 * возвращается новый экземпляр ObjectForQuery
 */
module.exports.server = url => ({
    collection: colName => new ObjectForQuery(url, colName)
});

/**
 * Содержит функции для выполнения запросов в Mongo,
 * каждая функция может вызываться у экземпляра объекта ObjectForQuery
 * или его наследников
 * @constant
 * @type {Object}
*/
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

/**
 * Содержит функции для работы с ObjectForQuery или его наследниками,
 * каждая функция выполняет запрос к Mongo и передает результат выполнения в callback
 * функции, соответствующие полям where и set дополняют параметры запроса
 * @constant
 * @type {Object}
 * @this {ObjectForQuery}
*/
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

/**
 * Создает экземпляр ParamsSetter.
 * @constructor
 * @param {ObjectForQuery} queryObj - объект, для которого формируются новые поля запроса
 * @param {Array} fields - список полей, для которых будет установлен параметр
 * @param {Boolean} not - true, если необходимо установить
 * отрицание последующего параметра, наче false
 * @this {ParamsSetter}
 */
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

/**
 * Создает экземпляр ObjectForQuery.
 * @constructor
 * @param {String} url - url на котором расположена база данных
 * @param {String} collectionName - имя коллекции к которой будут поступать запросы
 * @this {ObjectForQuery}
 */
let ObjectForQuery = function (url, collectionName) {
    this.url = url;
    this.collectionName = collectionName;
    this.query = [];
    this.setQuery = {};
    this.queryFunc = null;
    this.doQuery = doQuery;
    Object.setPrototypeOf(this, operations);
};

/**
 * Формирует и выполняет запрос к Mongo.
 * @param {String} operation - операция, с которой обращаемся к Mongo
 * @param {Function} callback - функция, которая выполняется с полученными данныи,
 * после завершения запроса
 * @param {String} [insertObj] - передается объект для вставки в коллекцию, если такой существует
 * @this {ObjectForQuery}
 */
function doQuery(operation, callback, insertObj) {
    this.insertObj = insertObj || null;
    this.queryFunc = MongoFunc[operation];
    connectMongo.call(this, callback);
};

/**
 * Выполняет запрос к Mongo.
 * @param {Function} callback - функция, которая выполняется с полученными данныи
 * после завершения запроса
 * @this {ObjectForQuery}
 */
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
