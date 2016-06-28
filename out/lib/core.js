"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const fs = require("fs");
const path = require("path");
const EE = require("events");
const archiver = require("archiver");
const common_1 = require("./common");
const Promisify = require("bluebird");
let fsAsync = Promisify.promisifyAll(fs);
class PackageError extends Error {
}
class PackageMissingRequirementError extends Error {
}
class RepositoryError extends Error {
}
class RepositoryNotUniquePackageError extends Error {
}
/**
 * Package Manager object.
 *
 * @class PackageManager
 * @extends {EE.EventEmitter}
 */
class PackageManager extends EE.EventEmitter {
    /**
     * Creates an instance of PackageManager.
     *
     */
    constructor() {
        super();
        this._repos = {};
        this._zipper = archiver.create("zip");
    }
    /**
     * Add a repository to manage.
     *
     * @param {Repository} repo Repository object.
     */
    addRepository(options) {
        let repo = new Repository(options);
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
    getRepository(name) {
        return this._repos[name];
    }
    /**
     * Retuns all managed repositories.
     *
     * @returns
     */
    getRepositories() {
        let repos = [];
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
    getRepositoryInvalidPackages(repo) {
        return this._repos[repo].invalidPackages;
    }
    /**
     * Executes a scan process for a given repository.
     *
     * @param {string} repo Name of the repository.
     */
    scanRepository(repo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._doesRepoExist(repo))
                this._repos[repo].scan();
        });
    }
    /**
     * Executes a scan for all managed repositories.
     */
    scanRepositories() {
        return __awaiter(this, void 0, void 0, function* () {
            let repos = this.getRepositories();
            for (let repo of repos) {
                this.scanRepository(repo.name);
            }
        });
    }
    /**
     * Returns a package from a given managed repository.
     *
     * @param {string} guid GUID of the package.
     * @param {string} repoName Name of the package's repository.
     * @returns
     */
    getRepositoryPackage(guid, repoName) {
        return __awaiter(this, void 0, void 0, function* () {
            let repo = this.getRepository(repoName);
            return yield repo.getPackage(guid);
        });
    }
    /**
     * Returns a stream of the repositories contents in a zip format.
     *
     * @param {string} guid
     * @param {string} repoName
     * @returns {Promise<NodeJS.ReadableStream>}
     */
    getRepositoryPackageContents(guid, repoName) {
        return __awaiter(this, void 0, Promise, function* () {
            let pkg = yield this.getRepositoryPackage(guid, repoName);
            let pkgPath = path.join(this._repos[repoName].dir, pkg.path);
            return this._zipPackage(pkgPath);
        });
    }
    /**
     * Checks if a repository is being managed.
     *
     * @param {any} repoName Name of the repository.
     * @returns {boolean}
     */
    _doesRepoExist(repoName) {
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
    _zipPackage(dir, filter) {
        filter = filter || "!_resources/**/*";
        let zipStream = this._zipper.glob(filter, { cwd: dir });
        this._zipper.finalize();
        return zipStream;
    }
    _onRepoReady(repo, args) {
        args = args || {};
        args["repository"] = repo;
        this.emit("repoReady", this, repo);
    }
    _onRepoError(err, args) {
        args = args || {};
        this.emit("error", err, args);
    }
    _onPackageAdded(repo, args) {
        args.repository = repo;
        args["manager"] = this;
        this.emit("packageAdded", this, args);
    }
}
exports.PackageManager = PackageManager;
/**
 * Object representing an package.
 *
 * @export
 * @class Package
 * @extends {EE.EventEmitter}
 * @implements {Package}
 */
class Package extends EE.EventEmitter {
    /**
     * Creates an instance of Package.
     *
     * @param {string} repoPath Reposistory's absolute local path.
     * @param {string} packagePath Package's absolute local path.
     * @param {{}} [rules] Object containing the rules used parse scan directory and parse it's configuration file.
     */
    constructor(repoPath, packagePath, rules) {
        super();
        this._configFile = path.basename(packagePath);
        this._absoluteDirPath = path.dirname(packagePath);
        this.path = this._absoluteDirPath.replace(repoPath, "");
    }
    get isValid() {
        if (this.guid && this.name) {
            return true;
        }
        else {
            return false;
        }
    }
    get lastWalk() {
        return this._lastWalk;
    }
    walk(rules) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._readConfigFile();
            yield this._parse(rules);
            yield this._search();
            if (!this.isValid) {
                this.emit("error", new PackageMissingRequirementError("not a valid package due to missing required properties (e.g. name, guid)"), { package: this });
                return;
            }
            if (this._hasWalked) {
                this.emit("updated", this);
            }
            else {
                this._hasWalked = true;
                this.emit("created", this);
            }
            this._lastWalk = new Date;
        });
    }
    /**
     * Parse the package's information file.
     *
     * @param {{}} rules JSON object with the list of properties to extract from the information file via RegEx patterns.
     */
    _parse(rules) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._rawConfigContents === null)
                return;
            for (let property in rules) {
                if (typeof rules[property] === "object") {
                    this[property] = yield this._parse(rules);
                    continue;
                }
                let pattern = new RegExp(rules[property], "i");
                let matches = this._rawConfigContents.match(pattern);
                if (matches)
                    this[property] = matches[1].trim();
            }
        });
    }
    _search(directory, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            directory = directory || this._absoluteDirPath;
            filter = filter || ".+";
            this.items = [];
            try {
                let files = yield fsAsync.readdirAsync(directory);
                for (let file of files) {
                    let fullPath = path.resolve(directory, file);
                    if (yield common_1.isDirectory(fullPath)) {
                        yield this._search(fullPath, filter);
                    }
                    else {
                        if (!fullPath.match(filter))
                            continue;
                        let itemRelativePath = fullPath.replace(this._absoluteDirPath, "");
                        this.items.push(itemRelativePath);
                    }
                }
            }
            catch (err) {
                console.log(err);
            }
        });
    }
    /**
     * Checks for the content from package's raw information file.
     *
     * @private
     */
    _readConfigFile() {
        return __awaiter(this, void 0, void 0, function* () {
            let absolutePath = path.join(this._absoluteDirPath, this._configFile);
            let doesPathExists = yield common_1.doesPathExist(absolutePath);
            if (!this._rawConfigContents && doesPathExists)
                this._rawConfigContents = yield fsAsync.readFileAsync(absolutePath, "utf8");
            return this._rawConfigContents !== null;
        });
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
    /**
     * Creates an instance of Repository.
     *
     * @param {RepoSettings} options Object containing the defintion of repostiory and its packages.
     */
    constructor(options) {
        super();
        this.packages = {};
        this.invalidPackages = [];
        this.name = options.name;
        this.dir = options.dir;
        this.packageDefinition = options.packageDefinition;
        this._walkQueue = new common_1.EEQueue();
    }
    /**
     * Walks the repository for packages.
     */
    scan() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit("scanning");
            this._walkQueue.once("emptied", this._onWalkQueueEmptied.bind(this));
            yield this._populateWalkQueue();
            yield this._processWalkQueue();
        });
    }
    getPackage(guid) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.packages[guid];
        });
    }
    _processWalkQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            // double bang operator(s)
            while (this._walkQueue.length) {
                let dir = this._walkQueue.next();
                yield this._walkPkgDir(dir);
            }
        });
    }
    /**
     * Recurses the repository's directories.
     */
    _populateWalkQueue(directory, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            directory = directory || this.dir;
            filter = this.packageDefinition.configFileName || "README.md";
            try {
                let files = yield fsAsync.readdirAsync(directory);
                for (let file of files) {
                    let fullName = path.resolve(directory, file);
                    if (yield common_1.isDirectory(fullName)) {
                        yield this._populateWalkQueue(fullName, filter);
                    }
                    else {
                        if (!fullName.match(filter))
                            continue;
                        this._walkQueue.push(fullName);
                    }
                }
            }
            catch (err) {
                this.emit("error", err, { repository: this });
            }
        });
    }
    _isPkgGuidUnqiue(pkg) {
        return this.packages[pkg.guid] !== null;
    }
    _walkPkgDir(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let repoPackage = new Package(this.dir, file);
            repoPackage.on("error", this._onPkgError.bind(this));
            repoPackage.on("created", this._onPkgCreated.bind(this));
            yield repoPackage.walk(this.packageDefinition.configParseRules);
        });
    }
    _addPkg(pkg) {
        if (this.packages[pkg.guid]) {
            this.invalidPackages.push(pkg);
            this.emit("error", new RepositoryNotUniquePackageError("another package with the same GUID exists"), { repostory: this, package: pkg });
            return;
        }
        this.packages[pkg.guid] = pkg;
        this.emit("packageAdded", this, pkg);
        console.log(`New package added: ${JSON.stringify({ name: pkg.name, guid: pkg.guid, path: pkg.path })}`);
    }
    _onWalkQueueEmptied() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasCompletedScan) {
                this.emit("ready", this, null);
            }
            this._hasCompletedScan = true;
            this.lastscan = new Date;
        });
    }
    _onPkgCreated(pkg) {
        this._addPkg(pkg);
    }
    _onPkgError(err, args) {
        if (!args.package.isValid)
            this.invalidPackages.push(args.package);
        args = args || {};
        args["repository"] = this;
        this.emit("error", err, args);
    }
}
exports.pkgmanager = new PackageManager();
//# sourceMappingURL=core.js.map