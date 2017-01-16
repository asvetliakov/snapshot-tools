import * as path from "path";
import * as fs from "fs";
import Uri from "vscode-uri";
import { autobind, debounce } from "core-decorators";
import { IConnection, TextDocumentChangeEvent, Files, FileEvent, FileChangeType } from "vscode-languageserver";
import { TextDocuments, TextDocument } from "vscode-languageserver";
import { ConfigurationManager } from "./ConfigurationManager";
import { LinkedDocumentsMap } from "./LinkedDocumentsMap";

/**
 * Document type
 * 
 * @export
 * @enum {number}
 */
export enum DocumentType {
    SNAPSHOT = 0,
    TEST,
    NONE
}

export type DocumentNeedValidation = (openedDocument: TextDocument, documentType: DocumentType.SNAPSHOT | DocumentType.TEST) => void;

/**
 * Manages opened text documents and establishes links to corresponding snapshot/test file
 * Calls onDocumentNeedsValidation delegate when any opened document need to be validated
 * 
 * @export
 * @class DocumentManager
 */
export class DocumentManager {
    /**
     * Configuration manager instance
     */
    /**
     * Configuration manager instance
     * 
     * @private
     * @type {ConfigurationManager}
     * @memberOf DocumentManager
     */
    private configurationManager: ConfigurationManager;
    
    /**
     * VSCode document manager
     * 
     * @private
     * @type {TextDocuments}
     * @memberOf DocumentManager
     */
    private openedDocumentsManager: TextDocuments;
    
    /**
     * Document wants to be validated callback
     * 
     * @private
     * @type {DocumentNeedValidation}
     * @memberOf DocumentManager
     */
    private documentNeedValidationCallback?: DocumentNeedValidation;
    
    /**
     * Map of linked documents. The key is URI and value is the content
     * 
     * @private
     * @type {Map<string, string>}
     * @memberOf DocumentManager
     */
    private linkedDocuments: LinkedDocumentsMap;

    /**
     * Creates an instance of DocumentManager.
     * 
     * @param {TextDocuments} textDocumentManager
     * @param {ConfigurationManager} configurationManager
     * 
     * @memberOf DocumentManager
     */
    public constructor(textDocumentManager: TextDocuments, configurationManager: ConfigurationManager, linkedDocumentsMap: LinkedDocumentsMap) {
        this.openedDocumentsManager = textDocumentManager;
        this.configurationManager = configurationManager;
        this.linkedDocuments = linkedDocumentsMap;
        
        this.openedDocumentsManager.onDidChangeContent(this.onDidChangeContent);
        this.openedDocumentsManager.onDidClose(this.onDidClose);
    }
    
    /**
     * Listen to document changes
     * 
     * @param {IConnection} connection
     * 
     * @memberOf DocumentManager
     */
    public listen(connection: IConnection): void {
        this.openedDocumentsManager.listen(connection);
    }
    
    /**
     * Sets callback for document validation
     * 
     * @param {DocumentNeedValidation} callback
     * 
     * @memberOf DocumentManager
     */
    public onDocumentNeedValidation(callback: DocumentNeedValidation): void {
        this.documentNeedValidationCallback = callback;
    }
    
    /**
     * Return linked test for given snapshot uri
     * 
     * @param {string} snapshotUri
     * @returns {string}
     * 
     * @memberOf DocumentManager
     */
    public getLinkedTest(snapshotUri: string): string | undefined {
        const testUri = this.getLinkedTestUri(snapshotUri);
        if (!testUri) {
            return;
        }
        return this.getMostRecentContentByUri(testUri);
    }
    
    public getLinkedTestUri(snapshotUri: string): string | undefined {
        const testPath = this.configurationManager.resolveTestFilePath(snapshotUri);
        if (!testPath) {
            return;
        }
        return this.absolutePathToUri(testPath);
    }
    
    /**
     * Return linked snapshot for given test uri
     * 
     * @param {string} testUri
     * @returns {string}
     * 
     * @memberOf DocumentManager
     */
    public getLinkedSnapshot(testUri: string): string | undefined {
        const snapshotUri = this.getLinkedSnapshotUri(testUri);
        if (!snapshotUri) {
            return;
        }
        return this.getMostRecentContentByUri(snapshotUri);
    }
    
    public getLinkedSnapshotUri(testUri: string): string | undefined {
        const snapshotPath = this.configurationManager.resolveSnapshotFilePath(testUri);
        if (!snapshotPath) {
            return;
        }
        return this.absolutePathToUri(snapshotPath);
    }
    
    /**
     * External file changes (snapshot was updated, git branch switching, etc...)
     * 
     * @param {FileEvent[]} changes
     * 
     * @memberOf DocumentManager
     */
    public loadExternalChanges(changes: FileEvent[]): void {
        for (const change of changes) {
            // skip for opened documents - these will get document event instead
            if (this.openedDocumentsManager.get(change.uri)) {
                continue;
            }
            switch (change.type) {
                case FileChangeType.Created:
                case FileChangeType.Changed: {
                    // update cache if exist
                    if (this.linkedDocuments.get(change.uri)) {
                        this.loadUriFromFile(change.uri);
                    }
                    this.revalidateUriIfNeeded(change.uri);
                    break;
                }
                case FileChangeType.Deleted: {
                    if (this.linkedDocuments.get(change.uri)) {
                        this.linkedDocuments.delete(change.uri);
                    }
                    this.cleanupUriAndRevalidateLinked(change.uri);
                    break;
                }
            }
        }
    }
    

    /**
     * Document was opened/content changed
     * 
     * @param {TextDocumentChangeEvent} change
     * 
     * @memberOf DocumentManager
     */
    @autobind
    @debounce(400)
    public onDidChangeContent(change: TextDocumentChangeEvent): void {
        this.revalidateUriIfNeeded(change.document.uri);
    }

    /**
     * Document was closed
     * 
     * @param {TextDocumentChangeEvent} change
     * 
     * @memberOf DocumentManager
     */
    @autobind
    public onDidClose(change: TextDocumentChangeEvent): void {
        this.cleanupUriAndRevalidateLinked(change.document.uri);
    }
    
    /**
     * Return most actual source of document by given uri
     * 
     * @param {string} uri
     * @returns {(string | undefined)}
     * 
     * @memberOf DocumentManager
     */
    public getMostRecentContentByUri(uri: string): string | undefined {
        if (this.openedDocumentsManager.get(uri)) {
            // If we have opened document, return it
            return this.openedDocumentsManager.get(uri).getText();
        } else if (this.linkedDocuments.has(uri)) {
            // If we have already stored source, return it
            return this.linkedDocuments.get(uri);
        } else {
            return this.loadUriFromFile(uri);
        }
    }
    
    /**
     * Return document type for given extension. If extension is not snapshot extension or any of test file extension, then return DocumentType.NONE
     * 
     * @param {string} extension
     * @returns {boolean}
     * 
     * @memberOf DocumentManager
     */
    public getDocumentType(extension: string): DocumentType {
        if (extension === this.configurationManager.snapshotExt) {
            return DocumentType.SNAPSHOT;
        } else if (this.configurationManager.testFileExt.includes(extension)) {
            return DocumentType.TEST;
        }
        return DocumentType.NONE;
    }

    /**
     * Cleanup given URI from manager and revalidate linked test/snapshot
     * 
     * @private
     * @param {string} uri
     * 
     * @memberOf DocumentManager
     */
    private cleanupUriAndRevalidateLinked(uri: string): void {
        const documentPath = Files.uriToFilePath(uri);
        if (documentPath) {
            // we closed real file document.
            // We could make few changes but didn't save it, so revalidate affected test/snapshot

            // delete linked file from cache
            const [linkedFilePath,] = this.getLinkedFilePathByUri(uri);
            if (linkedFilePath) {
                const linkedUri = this.absolutePathToUri(linkedFilePath);
                this.linkedDocuments.delete(linkedUri);
            }

            // will skip documentUri but requests validation for linked document if needed
            this.revalidateUriIfNeeded(uri);
        }
    }
    
    /**
     * Sends validation request for given URI if we have opened document with such URI and it's test file/snapshot.
     * Also sends validation request for linked snapshot/test if we have it opened too
     *
     * @private
     * @param {string} currentUri
     * 
     * @memberOf DocumentManager
     */
    private revalidateUriIfNeeded(currentUri: string): void {
        if (this.documentNeedValidationCallback) {
            // request validation for current uri if we have opened document with such uri
            const uriPath = Files.uriToFilePath(currentUri);
            if (uriPath) {
                const currentType = this.getDocumentType(path.extname(uriPath));
                const currentUriExt = path.extname(uriPath);
                if (currentType !== DocumentType.NONE) {
                    if (this.openedDocumentsManager.get(currentUri)) {
                        const currentUriType = currentUriExt === this.configurationManager.snapshotExt ? DocumentType.SNAPSHOT : DocumentType.TEST;
                        this.documentNeedValidationCallback(this.openedDocumentsManager.get(currentUri), currentUriType);
                    }
                    // revalidate linked URI if it we have document opened
                    const [linkedFilePath, linkedType] = this.getLinkedFilePathByUri(currentUri);
                    if (linkedFilePath && linkedType !== DocumentType.NONE) {
                        const linkedFileUri = this.absolutePathToUri(linkedFilePath);
                        if (this.openedDocumentsManager.get(linkedFileUri)) {
                            this.documentNeedValidationCallback(this.openedDocumentsManager.get(linkedFileUri), linkedType);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Read file with given URI and cache it. Overwrites cached value if exist
     * 
     * @private
     * @param {string} uri
     * @returns {(string | undefined)}
     * 
     * @memberOf DocumentManager
     */
    private loadUriFromFile(uri: string): string | undefined {
        // Read source and cache
        try {
            const filePath = Files.uriToFilePath(uri);
            if (!filePath) {
                return
            }
            const source = fs.readFileSync(filePath, "utf8");
            this.linkedDocuments.set(uri, source);
            return source;
        } catch (e) {
            return;
        }
    }
    
    /**
     * Return absolute path of linked test/snapshot for given uri and type of linked path
     * 
     * @private
     * @param {string} uri
     * @returns {([string | undefined, DocumentType])}
     * 
     * @memberOf DocumentManager
     */
    private getLinkedFilePathByUri(uri: string): [string | undefined, DocumentType] {
        const uriPath = Files.uriToFilePath(uri);
        if (uriPath) {
            const currentUriType = this.getDocumentType(path.extname(uriPath));
            if (currentUriType === DocumentType.SNAPSHOT) {
                return [this.configurationManager.resolveTestFilePath(uri), DocumentType.TEST];
            } else if (currentUriType === DocumentType.TEST) {
                return [this.configurationManager.resolveSnapshotFilePath(uri), DocumentType.SNAPSHOT];
            }
        }
        return [undefined, DocumentType.NONE];
    }
    
    /**
     * Convert absolute path to uri-like path
     * 
     * @private
     * @param {string} path
     * @returns {string}
     * 
     * @memberOf DocumentManager
     */
    private absolutePathToUri(path: string): string {
        const uri = Uri.file(path);
        return uri.toString();
    }
}