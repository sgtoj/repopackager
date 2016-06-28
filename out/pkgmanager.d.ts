
declare module "pkgmanager" {

    import EE =  require("events");

    class PackageError extends Error {}
    class PackageMissingRequirementError extends Error {}
    class RepositoryError extends Error {}
    class RepositoryNotUniquePackageError extends Error {}

    interface PackageEventArgs {
        package: Package;
        [key: string]: any;
    }

    interface RepositoryEventArgs {
        repository: Repository;
        package?: Package;
        [key: string]: any;
    }

    interface PackageManagerEventArgs {
        manager: PackageManager;
        repository?: Repository;
        package?: Package;
    }

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

    class Package extends EE.EventEmitter {

        /**
         * Evaluates if the required properties are set then returns whether or not the package is valid. 
         * 
         * @type {boolean}
         */
        isValid: boolean;

        /**
         * Date and time of the last walk of the repostiory's directory.
         * 
         * @type {Date}
         */
        lastWalk: Date;


        /**
         * Realitive path to the package. 
         * 
         * @type {string}
         */
        path: string;

        /**
         * Name of the package. 
         * 
         * @type {string}
         */
        name: string;

        /**
         * GUID assigned to the package.
         * 
         * @type {string}
         */
        guid: string;

        /**
         * All items with the package's directory.
         * 
         * @type {Array<string>}
         */
        items: Array<string>;

        /**
         * Executes a force walk of the directory. 
         * 
         * @param {{}} rules
         * @returns {Promise<void>}
         */
        walk(rules: {}): Promise<void>;
    }

    class Repository extends EE.EventEmitter {
        /**
         * Array of found valid packages with unqiue GUIDs.
         * 
         * @type {utils.Hashtable<Package>}
         */
        packages: Hashtable<Package>;

        /**
         * Date and time of last repostory scan.
         * 
         * @type {Date}
         */
        lastscan: Date;

        /**
         * Executes a force of the repostiory.
         */
        scan(): void;

        /**
         * Retrieves a package.
         * 
         * @param {string} guid GUID of the package to retrieve.
         * @returns {Promise<Package>}
         */
        getPackage(guid: string): Promise<Package>;
    }

    class PackageManager extends EE.EventEmitter { 

        /**
         * Creates an instance of PackageManager.
         * 
         */
        constructor();

        /**
         * Add a repository to manage.
         * 
         * @param {Repository} repo Repository object.
         */
        addRepository (repo: Repository): void;

        /**
         * Returns a repository object from a list of repositories being managed.  
         * 
         * @param {string} [name] Name of the repository.
         * @returns {Repository}
         */
        getRepository (name?: string): Repository;

        /**
         * Retuns all managed repositories. 
         * 
         * @returns
         */
        getRepositories(): Array<Repository>; 


        /**
         * Returns the packages that were invalid or not unique.
         * 
         * @param {string} repo Name of the repository.
         * @returns
         */
        getRepositoryInvalidPackages (repo: string): Array<Package>;


        /**
         * Executes a scan process for a given repository.
         * 
         * @param {string} repo Name of the repository.
         */
        scanRepository (repo: string): Promise<void>
        /**
         * Executes a scan for all managed repositories. 
         */
        scanRepositories (): Promise<void>


        /**
         * Returns a package from a given managed repository.
         * 
         * @param {string} guid GUID of the package.
         * @param {string} repoName Name of the package's repository. 
         * @returns
         */
        getRepositoryPackage (guid: string, repoName: string): Promise<Package>;


        /**
         * Returns a stream of the repositories contents in a zip format.  
         * 
         * @param {string} guid
         * @param {string} repoName
         * @returns {Promise<NodeJS.ReadableStream>}
         */
        getRepositoryPackageContents (guid: string, repoName: string): Promise<NodeJS.ReadableStream>;

    }

    class EEQueue<T> {
        new(): void;
        push(item: T): void
        next(): T;
        length (): number;
    }

    interface Hashtable<T> {
        [key: string]: T;
    }

}