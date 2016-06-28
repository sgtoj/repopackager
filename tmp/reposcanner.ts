import * as fs from "fs";
import * as EE from "events";
import * as path from "path";
import * as Promisify from "bluebird";
import * as utils from "./repopackager-utils";

let fsAsync: any = Promisify.promisifyAll(fs);

export class PackageError extends Error {}
export class PackageMissingRequirementError extends Error {}
export class RepositoryError extends Error {}
export class RepositoryNotUniquePackageError extends Error {}



/**
 * Object representing an package.
 * 
 * @export
 * @class Package
 * @extends {EE.EventEmitter}
 * @implements {Package}
 */
export class Package extends EE.EventEmitter {
    private _rawConfigContents: string;
    private _absoluteDirPath: string;
    private _configFile: string;
    private _hasWalked: boolean;
    private _lastWalk: Date;
    public path: string;
    public name: string;
    public guid: string;
    public items: Array<string>;


    /**
     * Creates an instance of Package.
     * 
     * @param {string} repoPath Reposistory's absolute local path.
     * @param {string} packagePath Package's absolute local path.
     * @param {{}} [rules] Object containing the rules used parse scan directory and parse it's configuration file.
     */
    constructor(repoPath: string, packagePath: string, rules?: {}) {
        super();
        this._configFile = path.basename(packagePath);
        this._absoluteDirPath = path.dirname(packagePath);
        this.path = this._absoluteDirPath.replace(repoPath, "");
    }

    get isValid (): boolean {
        if (this.guid && this.name) {
            return true;
        } else {
            return false;
        }
    }

    get lastWalk (): Date {
        return this._lastWalk;
    }

    public async walk (rules: {}) {
        await this._readConfigFile();
        await this._parse(rules);
        await this._search();

        if (!this.isValid) {
            this.emit("error", new PackageMissingRequirementError("not a valid package due to missing required properties (e.g. name, guid)"), { package: this });
            return;
        }

        if (this._hasWalked) {
            this.emit("updated", this);
        } else {
            this._hasWalked =  true;
            this.emit("created", this);
        }

        this._lastWalk = new Date;
    }

    /**
     * Parse the package's information file.
     * 
     * @param {{}} rules JSON object with the list of properties to extract from the information file via RegEx patterns. 
     */
    public async _parse (rules: {}) {
        if (this._rawConfigContents === null) return;

        for (let property in rules) {
            if (typeof rules[property] === "object") {
                this[property] = await this._parse(rules);
                continue;
            }

            let pattern = new RegExp(rules[property], "i");
            let matches = this._rawConfigContents.match(pattern);
            if (matches) this[property] = matches[1].trim();
        }
    }

    private async _search (directory?: string, filter?: string) {
        directory = directory || this._absoluteDirPath;
        filter = filter || ".+";
        this.items = [];

        try {
            let files: string[] = await fsAsync.readdirAsync(directory);
            for (let file of files)
            {
                let fullPath = path.resolve(directory, file);
                if (await utils.isDirectory(fullPath)) {
                    await this._search(fullPath, filter);
                } else {
                    if (!fullPath.match(filter)) continue;
                    let itemRelativePath = fullPath.replace(this._absoluteDirPath, "");
                    this.items.push(itemRelativePath);
                }

            }
        } catch (err) {
            console.log(err);
        }
    }

    /**
     * Checks for the content from package's raw information file.
     * 
     * @private
     */
    private async _readConfigFile () {
        let absolutePath = path.join(this._absoluteDirPath, this._configFile);
        let doesPathExists = await utils.doesPathExist(absolutePath);

        if (!this._rawConfigContents && doesPathExists)
            this._rawConfigContents = await fsAsync.readFileAsync(absolutePath, "utf8");

        return this._rawConfigContents !== null;
    }

}

/**
 * Object representing a package repository. 
 * 
 * @export
 * @class Repository
 * @extends {EE.EventEmitter}
 * @implements {Repository}
 */
export class Repository extends EE.EventEmitter {
    private _hasCompletedScan: boolean;
    private _walkQueue: utils.EEQueue<string>;
    public name: string;
    public lastscan: Date;
    public dir: string;
    public ignore: Array<string>;
    public packageDefinition: RepoPackageDefinition;
    public packages: utils.Hashtable<Package> = {};
    public invalidPackages: Package[] = [];


    /**
     * Creates an instance of Repository.
     * 
     * @param {RepoSettings} options Object containing the defintion of repostiory and its packages.
     */
    constructor (options: RepoSettings) {
        super();
        this.name = options.name;
        this.dir = options.dir;
        this.packageDefinition = options.packageDefinition;
        this._walkQueue = new utils.EEQueue<string>();
    }

    /**
     * Walks the repository for packages.
     */
    public async scan () {
        this.emit("scanning");
        this._walkQueue.once("emptied", this._onWalkQueueEmptied.bind(this));
        await this._populateWalkQueue();
        await this._processWalkQueue();
    }

    public async getPackage (guid: string) {
        return this.packages[guid];
    }

    private async _processWalkQueue () {
        // double bang operator(s)
        while (this._walkQueue.length) {
            let dir = this._walkQueue.next();
            await this._walkPkgDir(dir);
        }
    }

    /**
     * Recurses the repository's directories. 
     */
    private async _populateWalkQueue (directory?: string, filter?: string) {
        directory = directory || this.dir;
        filter = this.packageDefinition.configFileName || "README.md";

        try {
            let files: string[] = await fsAsync.readdirAsync(directory);
            for (let file of files)
            {
                let fullName = path.resolve(directory, file);
                if (await utils.isDirectory(fullName)) {
                    await this._populateWalkQueue(fullName, filter);
                } else {
                    if (!fullName.match(filter)) continue;
                    this._walkQueue.push(fullName);
                }
            }
        } catch (err) {
            this.emit("error", err, { repository: this });
        }
    }

    private _isPkgGuidUnqiue (pkg: Package) {
        return this.packages[pkg.guid] !== null;
    }

    private async _walkPkgDir (file: string) {
        let repoPackage = new Package(this.dir, file);
        repoPackage.on("error", this._onPkgError.bind(this));
        repoPackage.on("created", this._onPkgCreated.bind(this));
        await repoPackage.walk(this.packageDefinition.configParseRules);
    }

    private _addPkg (pkg: Package) {
        if (this.packages[pkg.guid]) {
            this.invalidPackages.push(pkg);
            this.emit("error", new RepositoryNotUniquePackageError("another package with the same GUID exists"), { repostory: this, package: pkg }) ;
            return;
        }

        this.packages[pkg.guid] = pkg;
        this.emit("packageAdded", this, pkg);
        console.log(`New package added: ${ JSON.stringify({ name: pkg.name, guid: pkg.guid, path: pkg.path }) }`);
    }

    private async _onWalkQueueEmptied () {
        if (!this._hasCompletedScan) {
            this.emit("ready", this, null);
        }
        this._hasCompletedScan = true;
        this.lastscan = new Date;
    }

    private _onPkgCreated (pkg: Package) {
        this._addPkg(pkg);
    }

    private _onPkgError (err, args) {
        if (!args.package.isValid) this.invalidPackages.push(args.package);

        args = args || {};
        args["repository"] = this;
        this.emit("error", err, args);
    }

}
