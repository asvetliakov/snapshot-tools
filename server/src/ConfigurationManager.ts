import * as path from "path";
import { Files } from "vscode-languageserver";
import { Settings } from "./Settings";

/**
 * Manages configuration
 * 
 * @export
 * @class ConfigurationManager
 */
export class ConfigurationManager {
    /**
     * Current workspace root
     * 
     * @type {string}
     * @memberOf ConfigurationManager
     */
    public workspaceRoot: string = "";
    
    /**
     * Snapshot root path relative to workspace root
     * 
     * @type {string}
     * @memberOf ConfigurationManager
     */
    public snapshotRoot: string = "./";
    
    /**
     * Snapshot files extension
     * 
     * @type {string}
     * @memberOf ConfigurationManager
     */
    public snapshotExt: string = ".snap";
    
    /**
     * Test file root relative to workspace root
     * 
     * @type {string}
     * @memberOf ConfigurationManager
     */
    public testFileRoot: string = "./";
    
    /**
     * Test files extensions
     * 
     * @type {string[]}
     * @memberOf ConfigurationManager
     */
    public testFileExt: string[] = [".tsx", ".ts", ".jsx", ".js"];
    
    /**
     * Snapshot directory (relative to opened test or absolute)
     * 
     * @type {string}
     * @memberOf ConfigurationManager
     */
    public snapshotDir: string = "./__snapshots__";
    
    /**
     * Test file directory (relative to opened snapshot or absolute)
     * 
     * @type {string}
     * @memberOf ConfigurationManager
     */
    public testFileDir: string = "../";
    
    /**
     * Snapshot call methods
     * 
     * @type {string[]}
     * @memberOf ConfigurationManager
     */
    public snapshotMethods: string[] = ["toMatchSnapshot", "snapshot", "matchSnapshot", "toThrowErrorMatchingSnapshot"];

    /**
     * Test methods
     * 
     * @type {string[]}
     * @memberOf ConfigurationManager
     */
    public testMethods: string[] = ["test", "it", "fit", "xit", "xtest"];
    
    /**
     * Suite methods
     * 
     * @type {string[]}
     * @memberOf ConfigurationManager
     */
    public suiteMethods: string[] = ["suite", "describe", "context", "xdescribe", "fdescribe"];
    
    /**
     * Resolve path to corresponding snapshot file from given test file
     * 
     * @param {string} testFileUri Test file URI
     * @returns {(string | undefined)} Snapshot file path or undefined if it can't be determined
     * 
     * @memberOf ConfigurationManager
     */
    public resolveSnapshotFilePath(testFileUri: string): string | undefined {
        const realPath = Files.uriToFilePath(testFileUri);
        if (!realPath) {
            return;
        }
        
        const resolvedSnapshotDir = this.getAbsoluteResolvedPath(this.snapshotDir, realPath, this.testFileRoot);
        // Snaphost doesn't remove original extension
        const basename = path.basename(realPath);
        return path.join(resolvedSnapshotDir, `${basename}${this.snapshotExt}`);
    }
    
    /**
     * Resolve path to corresponding test file from given snapshot file
     * 
     * @param {string} snapshotFileUri Snapshot file URI
     * @returns {(string | undefined)} Test file path or undefined if it can't be determined
     * 
     * @memberOf ConfigurationManager
     */
    public resolveTestFilePath(snapshotFileUri: string): string | undefined {
        const realPath = Files.uriToFilePath(snapshotFileUri);
        if (!realPath) {
            return;
        }
        const resolvedTestDir = this.getAbsoluteResolvedPath(this.testFileDir, realPath, this.snapshotRoot);
        const basename = path.basename(realPath, this.snapshotExt);
        return path.join(resolvedTestDir, `${basename}`);
    }
    
    /**
     * Set new settings
     * 
     * @param {Settings} settings
     * 
     * @memberOf ConfigurationManager
     */
    public setSettings(settings: Settings): void {
        if (settings.snapshotDir) {
            this.snapshotDir = settings.snapshotDir;
        }
        if (settings.snapshotExt) {
            this.snapshotExt = settings.snapshotExt;
        }
        if (settings.snapshotMethods) {
            this.snapshotMethods = settings.snapshotMethods;
        }
        if (settings.snapshotRoot) {
            this.snapshotRoot = settings.snapshotRoot;
        }
        if (settings.testFileDir) {
            this.testFileDir = settings.testFileDir;
        }
        if (settings.testFileExt) {
            if (Array.isArray(settings.testFileExt)) {
                this.testFileExt = [...settings.testFileExt];
            } else {
                this.testFileExt = [settings.testFileExt];
            }
        }
        if (settings.testFileRoot) {
            this.testFileRoot = settings.testFileRoot;
        }
        if (settings.testMethods) {
            this.testMethods = settings.testMethods;
        }
        if (settings.suiteMethods) {
            this.suiteMethods = settings.suiteMethods;
        }
    }
    
    /**
     * Resolves '${workspaceRoot}` and '${relativePath}` in path relative to another path
     * 
     * @private
     * @param {string} pathToResolve
     * @param {string} currentOpenedPath 
     * @param {string} relativeRootPrefix
     * @returns {string}
     * 
     * @memberOf ConfigurationManager
     */
    private getAbsoluteResolvedPath(pathToResolve: string, currentOpenedPath: string, relativeRootPrefix: string): string {
        const currentOpenedPathRelativeToWorkspace = path.dirname(path.relative(path.join(this.workspaceRoot, relativeRootPrefix), currentOpenedPath));
        const substitutedPath = pathToResolve.replace("${workspaceRoot}", this.workspaceRoot).replace("${relativePath}", currentOpenedPathRelativeToWorkspace);
        if (path.isAbsolute(substitutedPath)) {
            return substitutedPath;
        }
        return path.resolve(this.workspaceRoot, currentOpenedPathRelativeToWorkspace, substitutedPath);
    }
}