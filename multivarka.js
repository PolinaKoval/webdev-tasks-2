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

/**
 * Преобразует запрос представленный в виде массива или объекта
 * в корректный для Mongo и добавляет ключ(по умолчанию '$and')
 * @param {Array|Object} [query] запрос
 * @param {String} [key] ключь для объединения всех объектов из query
*/
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
        this._doQuery('find', callback);
    },
    remove: function (callback) {
        this._doQuery('remove', callback);
    },
    update: function (callback) {
        this._doQuery('update', callback);
    },
    insert: function (newObj, callback) {
        this._doQuery('insert', callback, newObj);
    },
    where: function (field) {
        return new ParamsSetter(this, field ? [field] : []);
    },
    set: function (newField, value) {
        if (value) {
            this.setQuery[newField] = value;
        }
        return this;
    }
};

const settings = {
    equal: function (value) {
        return this._addParam(value, ['$eq', '$ne']);
    },
    lessThan: function (num) {
        return this._addParam(num, ['$lt', '$gte']);
    },
    greatThan: function (num) {
        return this._addParam(num, ['$gt', '$lte']);
    },
    include: function (value) {
        return this._addParam(value, ['$in', '$nin']);
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
    this.where = field => {
        fields = field ? fields.push(field) : fields;
        return new ParamsSetter(queryObj, fields);
    };
    this._addParam = (value, param) => {
        param = param[index];
        let newQuery = {[param]: value};
        let queries = fields.map(field => ({[field]: newQuery}));
        [].push.apply(queryObj.query, queries);
        return queryObj;
    };
    Object.setPrototypeOf(this, settings);
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
    this._doQuery = doQuery;
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
            callback(err);
            return;
        }
        this.collection = db.collection(this.collectionName);
        this.queryFunc((err, result) => {
            callback(err, result);
            db.close();
        });
    });
}
