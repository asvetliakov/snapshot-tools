export interface Settings {
    /**
     * Snapshot root path relative to workspace root
     * 
     * @type {string}
     */
    snapshotRoot?: string;
    
    /**
     * Snapshot file extension
     * 
     * @type {string}
     */
    snapshotExt?: string;
    
    /**
     * Test file root relative to workspace root
     * 
     * @type {string}
     */
    testFileRoot?: string;
    
    /**
     * Test files extensions
     * 
     * @type {string|string[]}
     */
    testFileExt?: string | string[];
    
    /**
     * Snapshot directory (relative to opened test or absolute)
     * 
     * @type {string}
     */
    snapshotDir?: string;
    
    /**
     * Test file directory (relative to opened snapshot or absolute)
     * 
     * @type {string}
     */
    testFileDir?: string;
    
    /**
     * Snapshot call methods
     * 
     * @type {string[]}
     * @memberOf Settings
     */
    snapshotMethods?: string[];

    /**
     * Test methods
     * 
     * @type {string[]}
     * @memberOf Settings
     */
    testMethods?: string[];
    
    /**
     * Suite methods
     * 
     * @type {string[]}
     * @memberOf Settings
     */
    suiteMethods?: string[];
}