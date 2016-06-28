"use strict";
const fs = require("fs");
const EE = require("events");
/**
 * Parse a GUID then return it with the brackets and dashes removed.
 *
 * @export
 * @param {string} guid
 * @returns
 */
function parseGuid(guid) {
    let pattern = new RegExp("[{}-]", "g");
    return guid.replace(pattern, "").toUpperCase();
}
exports.parseGuid = parseGuid;
/**
 * Test if path is a directory.
 *
 * @param {string} filePath
 */
function isDirectory(filePath) {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err)
                reject(err);
            resolve(stats && stats.isDirectory());
        });
    });
}
exports.isDirectory = isDirectory;
/**
 * Test if path exists.
 *
 * @param {string} filePath
 */
function doesPathExist(filePath) {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err)
                reject(false);
            resolve(stats && stats.isFile());
        });
    });
}
exports.doesPathExist = doesPathExist;
/**
 * Queue object that emits events.
 *
 * @export
 * @class EEQueue
 * @extends {EE.EventEmitter}
 * @template T
 */
class EEQueue extends EE.EventEmitter {
    constructor() {
        super();
        this.self = this;
        this.queue = [];
    }
    push(item) {
        this.queue.push(item);
        this.emit("enqueued", item);
    }
    next() {
        let item = this.queue.shift();
        this.emit("dequeued");
        if (!this.queue.length) {
            this.emit("emptied");
        }
        return item;
    }
    get length() {
        return this.queue.length;
    }
}
exports.EEQueue = EEQueue;
// decorator definitions //
/**
 * Singleton Decorator
 * @see: https://dpopescu.eu/2016/01/26/practical-es7-decorators/
 *
 * @param {any} targetClass
 * @returns
 */
function singleton(targetClass) {
    // We will hold the instance reference in a Symbol.
    // A Symbol is a unique, immutable property of an object introduced in ES6.
    const instance = Symbol("__instance__");
    // We define the static method for retrieving the instance.
    targetClass.getInstance = function () {
        // If no instance has been created yet, we create one
        if (!targetClass[instance]) {
            targetClass[instance] = new targetClass();
        }
        // Return the saved instance.
        return targetClass[instance];
    };
    return targetClass;
}
exports.singleton = singleton;
//# sourceMappingURL=common.js.map