import * as path from "path";
import {
    IConnection, TextDocument, Diagnostic, InitializeParams, InitializeResult,
    TextDocumentSyncKind, FileEvent, DidChangeWatchedFilesParams, TextDocumentPositionParams, Hover,
    ResponseError, Files, MarkedString, Location, DocumentSymbolParams, SymbolInformation, SymbolKind,
    DidChangeConfigurationParams
} from "vscode-languageserver";
import { autobind } from "core-decorators";
import { SnapshotChecker } from "./SnapshotChecker";
import { DocumentManager, DocumentType } from "./DocumentManager";
import { ConfigurationManager } from "./ConfigurationManager";
import { Settings } from "./Settings";


export class ServerManager {
    private connection: IConnection;
    private documentManager: DocumentManager;
    private snapshotChecker: SnapshotChecker;
    private configurationManager: ConfigurationManager;
    
    /**
     * Creates an instance of ServerManager.
     * 
     * @param {IConnection} connection
     * @param {DocumentManager} documentManager
     * @param {SnapshotChecker} snapshotChecker
     * @param {ConfigurationManager} configuration
     * 
     * @memberOf ServerManager
     */
    public constructor(connection: IConnection, documentManager: DocumentManager, snapshotChecker: SnapshotChecker, configuration: ConfigurationManager) {
        this.connection = connection;
        this.documentManager = documentManager;
        this.snapshotChecker = snapshotChecker;
        this.configurationManager = configuration;
        this.documentManager.onDocumentNeedValidation(this.onDocumentNeedValidation);
        this.connection.onInitialize(this.onInitializeConnection);
        this.connection.onDidChangeWatchedFiles(this.onExternalFileChanges);
        this.connection.onHover(this.onHover as any);
        this.connection.onDefinition(this.onDefinition);
        this.connection.onDocumentSymbol(this.onDocumentSymbol as any);
        this.connection.onRequest("snapshotTools/navigateToDefinition", this.onDefinition);
        this.connection.onDidChangeConfiguration(this.onDidChangeConfiguration);
    }
    
    /**
     * Start listening
     * 
     * 
     * @memberOf ServerManager
     */
    public listen(): void {
        this.documentManager.listen(this.connection);
        this.connection.listen();
    }
    
    /**
     * Validate document
     * 
     * @protected
     * @param {TextDocument} openedDocument
     * @param {DocumentType} type
     * 
     * @memberOf ServerManager
     */
    @autobind
    protected onDocumentNeedValidation(openedDocument: TextDocument, type: DocumentType): void {
        let diagnostic: Diagnostic[] | undefined;
        if (type === DocumentType.SNAPSHOT) {
            const testSource = this.documentManager.getLinkedTest(openedDocument.uri);
            diagnostic = this.snapshotChecker.getDiagnosticForSnapshot(openedDocument.getText(), testSource);
        } else {
            const snapshotSource = this.documentManager.getLinkedSnapshot(openedDocument.uri);
            diagnostic = this.snapshotChecker.getDiagnosticForTest(openedDocument.getText(), snapshotSource);
        }
        
        if (diagnostic) {
            // send diagnostic
            this.connection.sendDiagnostics({
                uri: openedDocument.uri,
                diagnostics: diagnostic
            });
        }
    }
    
    /**
     * Initialize connection
     * 
     * @protected
     * @param {InitializeParams} params
     * @returns {InitializeResult}
     * 
     * @memberOf ServerManager
     */
    @autobind
    protected onInitializeConnection(params: InitializeParams): InitializeResult {
        if (params.rootPath) {
            this.configurationManager.workspaceRoot = params.rootPath;
        }
        const settings = params.initializationOptions as Settings;
        if (settings) {
            this.configurationManager.setSettings(settings);
        }
        return {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Full,
                definitionProvider: true,
                hoverProvider: true,
                documentSymbolProvider: true
            }
        };
    }
    
    /**
     * Watching file changes
     * 
     * @protected
     * @param {FileEvent[]} changes
     * 
     * @memberOf ServerManager
     */
    @autobind
    protected onExternalFileChanges(change: DidChangeWatchedFilesParams): void {
        this.documentManager.loadExternalChanges(change.changes);
    }
    
    /**
     * Hover request handler
     * @protected
     * @param {TextDocumentPositionParams} param
     * @returns {(Hover | ResponseError<void>)}
     * 
     * @memberOf ServerManager
     */
    @autobind
    protected onHover(param: TextDocumentPositionParams): Hover | ResponseError<void> | null {
        const docPath = Files.uriToFilePath(param.textDocument.uri);
        const testDocument = this.documentManager.getMostRecentContentByUri(param.textDocument.uri);
        if (!docPath || !testDocument) {
            return null;
        }
        const extname = path.extname(docPath);
        if (extname !== this.configurationManager.testFileExt) {
            return null;
        }
        
        const snapshotSource = this.documentManager.getLinkedSnapshot(param.textDocument.uri);
        if (!snapshotSource) {
            return null;
        }
        const snapshotInfo = this.snapshotChecker.getSnapshotForTestPosition(testDocument, snapshotSource, param.position.line, param.position.character);
        if (!snapshotInfo) {
            return null;
        }
        return {
            contents: {
                language: "snapshot",
                value: snapshotInfo.source
            }
        };
    }
    
    /**
     * Definition request handler
     * @protected
     * @param {TextDocumentPositionParam} param
     * @returns {Promise<Location> | ResponseError<void> | null}
     * 
     * @memberOf ServerManager
     */
    @autobind
    protected async onDefinition(param: TextDocumentPositionParams): Promise<Location | ResponseError<void> | null> {
        const docPath = Files.uriToFilePath(param.textDocument.uri);
        const document = this.documentManager.getMostRecentContentByUri(param.textDocument.uri);
        if (!docPath || !document) {
            return null;
        }
        const extname = path.extname(docPath);
        if (extname !== this.configurationManager.testFileExt && extname !== this.configurationManager.snapshotExt) {
            return null;
        }
        
        if (extname === this.configurationManager.testFileExt) {
            const snapshotSource = this.documentManager.getLinkedSnapshot(param.textDocument.uri);
            if (!snapshotSource) {
                return null;
            }
            const snapshotInfo = this.snapshotChecker.getSnapshotForTestPosition(document, snapshotSource, param.position.line, param.position.character);
            if (!snapshotInfo) {
                return null;
            }
            return Location.create(this.documentManager.getLinkedSnapshotUri(param.textDocument.uri)!, {
                start: {
                    line: snapshotInfo.line,
                    character: snapshotInfo.character
                },
                end: {
                    line: snapshotInfo.line,
                    character: snapshotInfo.character
                }
            });
        } else {
            const testSource = this.documentManager.getLinkedTest(param.textDocument.uri);
            if (!testSource) {
                return null;
            }
            const testSnapshotCallInfo = this.snapshotChecker.getTestForSnapshotPosition(testSource, document, param.position.line, param.position.character);
            if (!testSnapshotCallInfo) {
                return null;
            }
            return Location.create(this.documentManager.getLinkedTestUri(param.textDocument.uri) !, {
                start: {
                    line: testSnapshotCallInfo.line,
                    character: testSnapshotCallInfo.character
                },
                end: {
                    line: testSnapshotCallInfo.line,
                    character: testSnapshotCallInfo.character
                }
            });
        }
    }
    
    /**
     * On document symbol request
     * 
     * @protected
     * @param {DocumentSymbolParams} param
     * @returns {(SymoblInformation[] | ResponseError<void> | null)}
     * 
     * @memberOf ServerManager
     */
    @autobind
    protected onDocumentSymbol(param: DocumentSymbolParams): SymbolInformation[] | ResponseError<void> | null {
        const docPath = Files.uriToFilePath(param.textDocument.uri);
        const document = this.documentManager.getMostRecentContentByUri(param.textDocument.uri);
        if (!docPath || !document) {
            return null;
        }
        const extname = path.extname(docPath);
        if (extname !== this.configurationManager.snapshotExt) {
            return null;
        }
        const allSnapshots = this.snapshotChecker.getAllSnapshots(document);
        return allSnapshots.map(snapshot => {
            return {
                name: snapshot.name,
                kind: SymbolKind.Constant,
                location: Location.create(param.textDocument.uri, {
                    start: {
                        line: snapshot.line,
                        character: snapshot.character
                    },
                    end: {
                        line: snapshot.line,
                        character: snapshot.character
                    }
                })
            };
        });
    }
    
    @autobind
    protected onDidChangeConfiguration(param: DidChangeConfigurationParams): void {
        if (param.settings && param.settings.snapshotTools) {
            this.configurationManager.setSettings(param.settings.snapshotTools);
        }
    }
}