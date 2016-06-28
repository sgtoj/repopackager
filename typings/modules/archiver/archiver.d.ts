declare module "~archiver/archiver" {
    import fs = require('fs');
    import stream = require('stream');

    /**
     * Archiver Core
     *
     * @ignore
     * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
     * @copyright (c) 2012-2014 Chris Talkington, contributors.
     */
    interface vending {
        /**
         * Dispenses a new Archiver instance.
         *
         * @constructor
         * @param  {String} format The archive format to use.
         * @param  {Object} options See [Archiver]{@link Archiver}
         * @return {Archiver}
         */
        (format: string, options?: Object): Archiver;


        /**
         * Dispenses a new Archiver instance.
         *
         * @constructor
         * @param  {String} format The archive format to use.
         * @param  {Object} options See [Archiver]{@link Archiver}
         * @return {Archiver}
         */
        create(format: string, options?: Object): Archiver;

        /**
         * Registers a format for use with archiver.
         *
         * @param  {String} format The name of the format.
         * @param  {Function} module The function for archiver to interact with.
         * @return void
         */
        registerFormat(format: string, module: Function): void;
    
    }

    /**
     * @constructor
     * @param {String} format The archive format to use.
     * @param {(CoreOptions|TransformOptions)} options See also {@link ZipOptions} and {@link TarOptions}.
     */
    interface Archiver extends stream.Transform  {
        format: string;
        options: CoreOptions | TransformOptions;

        /**
         * @constructor
         * @param {String} format The archive format to use.
         * @param {} options See also {@link ZipOptions} and {@link TarOptions}.
         */
        constructor(format: string, options: CoreOptions | TransformOptions)

        abort(): this;

        /**
         * Appends an input source (text string, buffer, or stream) to the instance.
         *
         * When the instance has received, processed, and emitted the input, the `entry`
         * event is fired.
         *
         * @fires  Archiver#entry
         * @param  {(Buffer|Stream|String)} source The input source.
         * @param  {EntryData} data See also {@link ZipEntryData} and {@link TarEntryData}.
         * @return {this}
         */
        append(source: Buffer | stream.Stream | string, data: EntryData): this

        /**
         * Appends multiple entries from passed array of src-dest mappings.
         *
         * A [lazystream]{@link https://github.com/jpommerening/node-lazystream} wrapper is
         * used to prevent issues with open file limits.
         *
         * @deprecated 0.21.0
         * @param  {Object[]} mappings
         * @param  {(EntryData|Function)} mappings[].data See also {@link ZipEntryData}
         * and {@link TarEntryData}.
         * @param  {(String|Array)} mappings[].src Pattern(s) to match, relative to the `cwd`.
         * @param  {String} mappings[].dest Destination path prefix.
         * @param  {String} mappings[].expand Process a dynamic src-dest file mapping.
         * @param  {String} mappings[].cwd All `src` matches are relative to (but don't include)
         * this path. requires `expand`.
         * @param  {String} mappings[].ext Replace any existing extension with this value in
         * generated `dest` paths. requires `expand`.
         * @param  {String} mappings[].extDot Used to indicate where the period indicating
         * the extension is located. requires `expand`.
         * @param  {String} mappings[].flatten Remove all path parts from generated `dest`
         * paths. requires `expand`.
         * @param  {*} mappings[].* See [node-glob]{@link https://github.com/isaacs/node-glob#properties}
         * and [minimatch]{@link https://github.com/isaacs/minimatch#properties} documentation
         * for additional properties.
         * @return {this}
         */
        bulk(mappings: IMapping[]): this;

        /**
         * Appends a directory and its files, recursively, given its dirpath.
         *
         * @param  {String} dirpath The source directory path.
         * @param  {String} destpath The destination path within the archive.
         * @param  {(EntryData|Function)} data See also [ZipEntryData]{@link ZipEntryData} and
         * [TarEntryData]{@link TarEntryData}.
         * @return {this}
         */
        directory(dirpath: string, destpath: string, data: EntryData | Function): string;

        /**
         * Appends a file given its filepath using a
         * [lazystream]{@link https://github.com/jpommerening/node-lazystream} wrapper to
         * prevent issues with open file limits.
         *
         * When the instance has received, processed, and emitted the file, the `entry`
         * event is fired.
         *
         * @param  {String} filepath The source filepath.
         * @param  {EntryData} data See also [ZipEntryData]{@link ZipEntryData} and
         * [TarEntryData]{@link TarEntryData}.
         * @return {this}
         */
        file(filepath: string, data: EntryData): this;

        /**
         * Appends multiple files that match a glob pattern.
         *
         * @param  {String} pattern The [glob pattern]{@link https://github.com/isaacs/node-glob#glob-primer} to match.
         * @param  {Object} options See [node-glob]{@link https://github.com/isaacs/node-glob#options}.
         * @param  {EntryData} data See also [ZipEntryData]{@link ZipEntryData} and
         * [TarEntryData]{@link TarEntryData}.
         * @return {this}
         */
        glob(pattern: string, options?: Object, data?: EntryData): this;

        /**
         * Finalizes the instance and prevents further appending to the archive
         * structure (queue will continue til drained).
         *
         * The `end`, `close` or `finish` events on the destination stream may fire
         * right after calling this method so you should set listeners beforehand to
         * properly detect stream completion.
         *
         * @return {this}
         */
        finalize(): this;

        /**
         * Sets the module format name used for archiving.
         *
         * @param {String} format The name of the format.
         * @return {this}
         */
        setFormat(format: string): this;

        /**
         * Sets the module used for archiving.
         *
         * @param {Function} module The function for archiver to interact with.
         * @return {this}
         */
        setModule(module: Function): this;

        /**
         * Returns the current length (in bytes) that has been emitted.
         *
         * @return {Number}
         */
        pointer(): number;

        /**
         * Middleware-like helper that has yet to be fully implemented.
         *
         * @private
         * @param  {Function} plugin
         * @return {this}
         */
        use(): this
    }
    
    interface IMapping {
        data: EntryData | Function,
        src: string | string[],
        dest: string,
        expand: string,
        cwd: string,
        ext: string,
        extDot: string,
        flatten: string,
    }

    /**
     * @typedef {Object} CoreOptions
     * @global
     * @property {Number} [statConcurrency=4] Sets the number of workers used to
     * process the internal fs stat queue.
     */
    interface CoreOptions {
        statConcurrency?: number
    }

    /**
     * @typedef {Object} TransformOptions
     * @property {Boolean} [allowHalfOpen=true] If set to false, then the stream
     * will automatically end the readable side when the writable side ends and vice
     * versa.
     * @property {Boolean} [readableObjectMode=false] Sets objectMode for readable
     * side of the stream. Has no effect if objectMode is true.
     * @property {Boolean} [writableObjectMode=false] Sets objectMode for writable
     * side of the stream. Has no effect if objectMode is true.
     * @property {Boolean} [decodeStrings=true] Whether or not to decode strings
     * into Buffers before passing them to _write(). `Writable`
     * @property {String} [encoding=NULL] If specified, then buffers will be decoded
     * to strings using the specified encoding. `Readable`
     * @property {Number} [highWaterMark=16kb] The maximum number of bytes to store
     * in the internal buffer before ceasing to read from the underlying resource.
     * `Readable` `Writable`
     * @property {Boolean} [objectMode=false] Whether this stream should behave as a
     * stream of objects. Meaning that stream.read(n) returns a single value instead
     * of a Buffer of size n. `Readable` `Writable`
     */
    interface TransformOptions {
        allowHalfOpen?: boolean,
        readableObjectMode?: boolean, 
        writableObjectMode?: boolean, 
        decodeStrings?: boolean, 
        encoding?: string, 
        highWaterMark?: number, 
        objectMode?: boolean
    }

    /**
     * @typedef {Object} EntryData
     * @property {String} name Sets the entry name including internal path.
     * @property {(String|Date)} [date=NOW()] Sets the entry date.
     * @property {Number} [mode=D:0755/F:0644] Sets the entry permissions.
     * @property {String} [prefix] Sets a path prefix for the entry name. Useful
     * when working with methods like `directory` or `glob`.
     * @property {fs.Stats} [stats] Sets the fs stat data for this entry allowing
     * for reduction of fs stat calls when stat data is already known.
     */
    interface EntryData {
        name: string,
        date?: string | Date, 
        mode?: number, 
        prefix?: string, 
        stats?: fs.Stats
    }


}

declare module "~archiver/json" {
    import archiverModule = require("~archiver/archiver"); 
    import fs = require('fs');
    import stream = require('stream');

    interface JsonOptions extends Object {}

    /**
     * @constructor
     * @param {(JsonOptions|TransformOptions)} options
     */
    interface Json {
        (option: JsonOptions| archiverModule.TransformOptions): Json
        
        /**
         * [append description]
         *
         * @param  {(Buffer|Stream)}   source
         * @param  {EntryData}   data
         * @param  {Function} callback
         * @return void
         */
        append(source: Buffer, data: archiverModule.EntryData, callback: Function): void;

        /**
         * [finalize description]
         *
         * @return void
         */
        finalize(): void
    }
}

declare module "~archiver/tar" {
    import archiverModule = require("~archiver/archiver"); 
    import fs = require('fs');
    import stream = require('stream');

    interface engine extends NodeJS.ReadableStream {}
    
    interface Tar {
        /**
         * @constructor
         * @param {(JsonOptions|TransformOptions)} options
         */
        (option: TarEntryData| archiverModule.TransformOptions): Tar
        
        engine: engine;
        compressor: boolean;
        supports: { directory: boolean }

        /**
         * [append description]
         *
         * @param  {(Buffer|Stream)}   source
         * @param  {EntryData}   data
         * @param  {Function} callback
         * @return void
         */
        append(source: Buffer, data: archiverModule.EntryData, callback: Function): void;

        /**
         * [finalize description]
         *
         * @return void
         */
        finalize(): void

        /**
         * [on description]
         *
         * @return this.engine
         */
        on(): engine;

        /**
         * [pipe description]
         *
         * @param  {String} destination
         * @param  {Object} options
         * @return this.engine
         */
        pipe(destination): engine

        /**
         * [pipe description]
         *
         * @return this.engine
         */
        unpipe(): engine
    }

    /**
     * @typedef {Object} TarOptions
     * @global
     * @property {Boolean} [gzip=false] Compress the tar archive using gzip.
     * @property {Object} [gzipOptions] Passed to [zlib]{@link https://nodejs.org/api/zlib.html#zlib_class_options}
     * to control compression.
     * @property {*} [*] See [tar-stream]{@link https://github.com/mafintosh/tar-stream} documentation for additional properties.
     */
    interface TarOptions {
        gzip: boolean;
        gzipOptions: Object
    }

    /**
     * @typedef {Object} TarEntryData
     * @global
     * @property {String} name Sets the entry name including internal path.
     * @property {(String|Date)} [date=NOW()] Sets the entry date.
     * @property {Number} [mode=D:0755/F:0644] Sets the entry permissions.
     * @property {String} [prefix] Sets a path prefix for the entry name. Useful
     * when working with methods like `directory` or `glob`.
     * @property {fs.Stats} [stats] Sets the fs stat data for this entry allowing
     * for reduction of fs stat calls when stat data is already known.
     */
    interface TarEntryData {
        name: string;
        data: string | Date;
        mode: number;
        prefix: string;
        stats: fs.Stats;
    }
}

declare module "~archiver/zip" {
    import archiverModule = require("~archiver/archiver"); 
    import fs = require('fs');
    import stream = require('stream');

    interface engine extends NodeJS.ReadableStream {}
    
    interface Zip {
        /**
         * @constructor
         * @param {(JsonOptions|TransformOptions)} options
         */
        (option: ZipEntryData| archiverModule.TransformOptions): Zip
        
        engine: engine;
        compressor: boolean;
        supports: { directory: boolean }

        /**
         * [append description]
         *
         * @param  {(Buffer|Stream)}   source
         * @param  {EntryData}   data
         * @param  {Function} callback
         * @return void
         */
        append(source: Buffer, data: archiverModule.EntryData, callback: Function): void;

        /**
         * [finalize description]
         *
         * @return void
         */
        finalize(): void

        /**
         * [on description]
         *
         * @return this.engine
         */
        on(): engine;

        /**
         * [pipe description]
         *
         * @param  {String} destination
         * @param  {Object} options
         * @return this.engine
         */
        pipe(destination): engine

        /**
         * [pipe description]
         *
         * @return this.engine
         */
        unpipe(): engine
    }

    /**
     * @typedef {Object} ZipOptions
     * @global
     * @property {String} [comment] Sets the zip archive comment.
     * @property {Boolean} [store=false] Sets the compression method to STORE.
     * @property {Object} [zlib] Passed to [zlib]{@link https://nodejs.org/api/zlib.html#zlib_class_options}
     * to control compression.
     * @property {*} [*] See [zip-stream]{@link https://github.com/archiverjs/node-zip-stream} documentation for additional properties.
     */
    interface ZipObject {
        comment: string;
        store: boolean;
        zlib: Object;
        [property: string]: any;
    }

    /**
     * @typedef {Object} ZipEntryData
     * @global
     * @property {String} name Sets the entry name including internal path.
     * @property {(String|Date)} [date=NOW()] Sets the entry date.
     * @property {Number} [mode=D:0755/F:0644] Sets the entry permissions.
     * @property {String} [prefix] Sets a path prefix for the entry name. Useful
     * when working with methods like `directory` or `glob`.
     * @property {fs.Stats} [stats] Sets the fs stat data for this entry allowing
     * for reduction of fs stat calls when stat data is already known.
     * @property {Boolean} [store=ZipOptions.store] Sets the compression method to STORE.
     */
    interface ZipEntryData {
        name: string;
        data: string | Date;
        mode: number;
        prefix: string;
        stats: fs.Stats;
        store: boolean;
    }
}

declare module "archiver" {
    import archiverModule = require("~archiver/archiver");
    var archiver: archiverModule.vending
    export = archiver;
}

declare module "archiver/archiver" {
    import archiverModule = require("~archiver/archiver");
    var archiver: archiverModule.vending
    export = archiver;
}

declare module "archiver/tar" {
    import mod = require("~archiver/tar");
    var alias: mod.Tar;
    export = alias;
}

declare module "archiver/zip" {
    import mod = require("~archiver/zip");
    var alias: mod.Zip;
    export = alias;
}

declare module "archiver/json" {
    import mod = require("~archiver/json");
    var alias: mod.Json;
    export = alias;
}