import * as fs from "fs";
import * as EE from "events";

/**
 * Parse a GUID then return it with the brackets and dashes removed.
 * 
 * @export
 * @param {string} guid
 * @returns
 */
export function parseGuid (guid: string) {
    let pattern = new RegExp("[{}-]", "g");
    return guid.replace(pattern, "").toUpperCase();
}

/**
 * Test if path is a directory.
 * 
 * @param {string} filePath
 */
export function isDirectory (filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err) reject(err);
            resolve(stats && stats.isDirectory());
        });
    });
}

/**
 * Test if path exists.
 * 
 * @param {string} filePath
 */
export function doesPathExist (filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err) reject(false);
            resolve(stats && stats.isFile());
        });
    });
}


/**
 *  Generic Hashtable
 * 
 * @export
 * @interface Hashtable
 * @template T
 */
export interface Hashtable<T> {
    [key: string]: T;
}


/**
 * Queue object that emits events. 
 * 
 * @export
 * @class EEQueue
 * @extends {EE.EventEmitter}
 * @template T
 */
export class EEQueue<T> extends EE.EventEmitter {
    private self = this;

    private queue: T[] = [];
    constructor() {
        super();
    }
    public push(item: T) {
        this.queue.push(item);
        this.emit("enqueued", item);
    }
    public next(): T {
        let item = this.queue.shift();
        this.emit("dequeued");
        if (!this.queue.length) {
            this.emit("emptied");
        }
        return item;
    }
    get length () {
        return this.queue.length;
    }
}

// decorator definitions //

/**
 * Singleton Decorator
 * @see: https://dpopescu.eu/2016/01/26/practical-es7-decorators/
 * 
 * @param {any} targetClass
 * @returns
 */
export function singleton(targetClass) {
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