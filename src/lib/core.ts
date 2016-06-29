import * as fs from "fs";
import * as path from "path";
import * as EE from "events";
import * as archiver from "archiver";
import { Hashtable, isDirectory, doesPathExist, EEQueue } from "./common";
import * as Promisify from "bluebird";

let fsAsync: any = Promisify.promisifyAll(fs);

class PackageError extends Error {}
class PackageMissingRequirementError extends Error {}
class RepositoryError extends Error {}
class RepositoryNotUniquePackageError extends Error {}

interface RepoPackageDefinition {

    /**
     * Name of the file describing the package's meta data. 
     * 
     * @type {string}
     */
    configFileName: string;

    /**
     * List of named properties to parse the config file for via RegEx patterns.
     * 
     * @type {utils.Hashtable<string>}
     */
    configParseRules: Hashtable<string>;

    /**
     * Glob pattern used to filter items from the walk.  
     * 
     * @type {Array<string>}
     */
    ignore: Array<string>;
}

interface RepoSettings {

    /**
     * Name of the repsitory. 
     * 
     * @export
     * @interface RepoSettings
     */
    name: string;

    /**
     * Absolute local path to the repository. 
     * 
     * @type {string}
     */
    dir: string;

    /**
     * Glob pattern use to filter out files from the scan. 
     * 
     * @type {Array<string>}
     */
    ignore: Array<string>;

    /**
     * Object with the defintion that describes how to find packages and their metadata.
     * 
     * @type {RepoPackageDefinition}
     */
    packageDefinition: RepoPackageDefinition;
}

/**
 * Object representing an package.
 * 
 * @export
 * @class Package
 * @extends {EE.EventEmitter}
 * @implements {Package}
 */
class Package extends EE.EventEmitter {
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
            this.emit("error", new PackageMissingRequirementError("not a valid package due to missing required properties (e.g. name, guid)"), this);
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
                if (await isDirectory(fullPath)) {
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
        let doesPathExists = await doesPathExist(absolutePath);

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
class Repository extends EE.EventEmitter {
    private _hasCompletedScan: boolean;
    private _walkQueue: EEQueue<string>;
    public name: string;
    public lastscan: Date;
    public dir: string;
    public ignore: Array<string>;
    public packageDefinition: RepoPackageDefinition;
    public packages: Hashtable<Package> = {};
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
        this._walkQueue = new EEQueue<string>();
    }

    /**
     * Walks the repository for packages.
     */
    public async scan () {
        this.emit("scanning", this);
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
                if (await isDirectory(fullName)) {
                    await this._populateWalkQueue(fullName, filter);
                } else {
                    if (!fullName.match(filter)) continue;
                    this._walkQueue.push(fullName);
                }
            }
        } catch (err) {
            this.emit("error", err);
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
            this.emit("error", new RepositoryNotUniquePackageError("another package with the same GUID exists"), pkg) ;
            return;
        }

        this.packages[pkg.guid] = pkg;
        this.emit("packageAdded", { repository: this, package: pkg });
        console.log(`New package added: ${ JSON.stringify({ name: pkg.name, guid: pkg.guid, path: pkg.path }) }`);
    }

    private async _onWalkQueueEmptied () {
        if (!this._hasCompletedScan) {
            this.emit("ready", this);
        }
        this._hasCompletedScan = true;
        this.lastscan = new Date;
    }

    private _onPkgCreated (pkg: Package) {
        this._addPkg(pkg);
    }

    private _onPkgError (err, pkg) {
        if (!pkg.isValid) this.invalidPackages.push(pkg);
        this.emit("error", err);
    }

}

/**
 * Package Manager object.
 * 
 * @class PackageManager
 * @extends {EE.EventEmitter}
 */
export class PackageManager extends EE.EventEmitter {
    private _repos: Hashtable<Repository> = {};
    private _zipper = archiver.create("zip");

    /**
     * Creates an instance of PackageManager.
     * 
     */
    constructor ()  {
        super();
    }


    /**
     * Add a repository to manage.
     * 
     * @param {Repository} repo Repository object.
     */
    public addRepository (options: RepoSettings) {
        let repo =  new Repository(options);

        this._repos[repo.name] = repo;
        this._repos[repo.name].on("error", this._onRepoError.bind(this));
        this._repos[repo.name].on("ready", this._onRepoReady.bind(this));
        this._repos[repo.name].on("addedPackage", this._onPackageAdded.bind(this));
    }

    /**
     * Returns a repository object from a list of repositories being managed.  
     * 
     * @param {string} [name] Name of the repository.
     * @returns {Repository}
     */
    public getRepository (name?: string): Repository {
        return this._repos[name];
    }

    /**
     * Retuns all managed repositories. 
     * 
     * @returns
     */
    public getRepositories () {
        let repos: Repository[] = [];
        for (let repoName in this._repos) {
            repos.push(this.getRepository(repoName));
        }
        return repos;
    }


    /**
     * Returns the packages that were invalid or not unique.
     * 
     * @param {string} repo Name of the repository.
     * @returns
     */
    public getRepositoryInvalidPackages (repo: string) {
        return this._repos[repo].invalidPackages;
    }


    /**
     * Executes a scan process for a given repository.
     * 
     * @param {string} repo Name of the repository.
     */
    public async scanRepository (repo: string) {
        if (this._doesRepoExist(repo)) this._repos[repo].scan();
    }

    /**
     * Executes a scan for all managed repositories. 
     */
    public async scanRepositories () {
        let repos = this.getRepositories();
        for (let repo of repos) {
            this.scanRepository(repo.name);
        }
    }


    /**
     * Returns a package from a given managed repository.
     * 
     * @param {string} guid GUID of the package.
     * @param {string} repoName Name of the package's repository. 
     * @returns
     */
    public async getRepositoryPackage (guid: string, repoName: string) {
        let repo = this.getRepository(repoName);
        return await repo.getPackage(guid);
    }


    /**
     * Returns a stream of the repositories contents in a zip format.  
     * 
     * @param {string} guid
     * @param {string} repoName
     * @returns {Promise<NodeJS.ReadableStream>}
     */
    public async getRepositoryPackageContents (guid: string, repoName: string): Promise<NodeJS.ReadableStream> {
        let pkg = await this.getRepositoryPackage(guid, repoName);
        let pkgPath = path.join(this._repos[repoName].dir, pkg.path);
        return this._zipPackage(pkgPath);
    }


    /**
     * Checks if a repository is being managed.
     * 
     * @param {any} repoName Name of the repository.
     * @returns {boolean}
     */
    public _doesRepoExist (repoName): boolean {
        // used double bang operater(s)
        return !!this._repos[repoName];
    }

    /**
     * Returns a zip stream. 
     * 
     * @private
     * @param {string} dir Directory to zip.
     * @param {string} [filter] Glob pattern filter.
     * @returns {NodeJS.ReadableStream}
     */
    private _zipPackage (dir: string, filter?: string): NodeJS.ReadableStream {
        filter = filter || "!_resources/**/*";
        let zipStream = this._zipper.glob(filter, { cwd: dir });
        this._zipper.finalize();
        return zipStream;
    }

    private _onRepoReady (repo: Repository) {
        let details = { manager: this, repository: repo };
        this.emit("repoReady", details);
    }

    private _onRepoError (err): void {
        this.emit("error", err);
    }

    private _onPackageAdded(details: Object): void {
        details = details || {};
        details["manager"] = this;
        this.emit("packageAdded", details);
    }

}

export var repopackager: PackageManager = new PackageManager();

