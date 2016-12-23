import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { ConfigurationManager } from "./ConfigurationManager";
import {
    createSourceFile,
    ScriptTarget,
    getLineAndCharacterOfPosition,
    SourceFile,
    CallExpression,
    ExpressionStatement,
    PropertyAccessExpression,
    Node,
    SyntaxKind,
    StringLiteral,
    Identifier,
    ArrowFunction,
    FunctionExpression,
    VariableStatement,
    getPositionOfLineAndCharacter,
    NoSubstitutionTemplateLiteral,
    ElementAccessExpression,
    Block,
    BinaryExpression,
    ScriptKind
} from "typescript";

export enum DiagnosticCodes {
    NO_TEST_FILE = 0,
    SNAPSHOT_REDUNANT,
    SNAPSHOT_DOESNT_EXIST
}

interface SnapshotCallInfo {
    ownName?: string;
    line: number;
    character: number;
    posStart: number;
    posEnd: number;
}

interface TestSnapshotsCall {
    name: string;
    line: number;
    character: number;
    posStart: number;
    posEnd: number;
}

interface TestSnapshotCallsStore {
    snapshotCalls: TestSnapshotsCall[];
    sourceFile?: SourceFile;
}

interface SnapshotSourceInfo {
    source: string;
    name: string;
    line: number;
    character: number;
    posStart: number;
    posEnd: number;
}

interface SnapshotSourceStore {
    snapshotSource: SnapshotSourceInfo[];
    sourceFile?: SourceFile;
}

export class SnapshotChecker {
    /**
     * Current configuration
     * 
     * @private
     * @type {ConfigurationManager}
     * @memberOf ValidationManager
     */
    private configuration: ConfigurationManager;
    
    /**
     * Creates an instance of ValidationManager.
     * 
     * @param {ConfigurationManager} configuration
     * 
     * @memberOf ValidationManager
     */
    public constructor(configuration: ConfigurationManager) {
        this.configuration = configuration;
    }
    
    
    /**
     * Return diagnostic for snapshot file
     * 
     * @param {string} snapshotSource
     * @param {string} [testSource]
     * @returns {(Diagnostic[] | undefined)}
     * 
     * @memberOf ValidationManager
     */
    public getDiagnosticForSnapshot(snapshotSource: string, testSource?: string): Diagnostic[] | undefined {
        // means we have snapshot file but not corresponding test file
        const snapshotLines = snapshotSource.split(/\r?\n/g);
        if (!testSource) {
            const diagnostic: Diagnostic = {
                severity: 2,
                message: "There is no corresponding test file for this snapshot",
                source: "snapshot-tools",
                code: DiagnosticCodes.NO_TEST_FILE,
                range: {
                    start: {
                        line: 0,
                        character: 0
                    },
                    end: {
                        line: snapshotLines.length - 1,
                        character: Number.MAX_VALUE
                    }
                }
            };
            return [diagnostic];
        }
        try {
            // get information
            const snapshotSourceStore = this.parseSnapshotFile(snapshotSource);
            const snapshotCallsStore = this.parseTestFileAndGetSnapshotCalls(testSource);

            const testSnapshotNames = snapshotCallsStore.snapshotCalls.map(snapshotCall => snapshotCall.name);
            const redunantSnapshots = snapshotSourceStore.snapshotSource.filter(snapshotExport => !testSnapshotNames.includes(snapshotExport.name));

            const diagnostics: Diagnostic[] = [];
            // Loop through left snapshot names, these are redunant
            if (redunantSnapshots.length > 0) {
                for (const redunantSnapshot of redunantSnapshots) {
                    diagnostics.push({
                        message: "The snapshot is redunant",
                        severity: 2,
                        source: "snapshot-tools",
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: { line: redunantSnapshot.line, character: 0 },
                            end: { line: redunantSnapshot.line, character: Number.MAX_VALUE }
                        }
                    });
                }
            }
            return diagnostics;
            
        } catch (e) {
            // don't return diagnostic in case of eval error
            return;
        }
    }
    
    /**
     * Return diagnostic for test file
     * 
     * @param {string} testSource
     * @param {string} [snapshotSource]
     * @returns {(Diagnostic[] | undefined)}
     * 
     * @memberOf SnapshotChecker
     */
    public getDiagnosticForTest(testSource: string, snapshotSource?: string): Diagnostic[] | undefined {
        // We need to send diagnostic for test file without snapshot file.
        // In case if there is no snapshot check calls in test we'll send empty diagnostic
        if (!snapshotSource) {
            snapshotSource = "";
        }
        try {
            const diagnostics: Diagnostic[] = [];
            const snapshotSourceStore = this.parseSnapshotFile(snapshotSource);
            const snapshotCallsStore = this.parseTestFileAndGetSnapshotCalls(testSource);
            
            const snapshotExportNames = snapshotSourceStore.snapshotSource.map(snapshotExport => snapshotExport.name);
            for (const testSnapshotCall of snapshotCallsStore.snapshotCalls) {
                if (!snapshotExportNames.includes(testSnapshotCall.name)) {
                    diagnostics.push({
                        message: "Corresponding snapshot doesn't exist",
                        severity: 2,
                        source: "snapshot-tools",
                        code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                        range: {
                            start: { line: testSnapshotCall.line, character: 0 },
                            end: { line: testSnapshotCall.line, character: Number.MAX_VALUE }
                        }
                    });
                }
            }
            return diagnostics;
        } catch (e) {
            return;
        }
    }
    
    /**
     * Return snapshot information for requested position in test file or undefined if not found
     * 
     * @param {string} testSource
     * @param {string} snapshotSource
     * @param {number} line
     * @param {number} character
     * @returns {(SnapshotSourceInfo | undefined)}
     * 
     * @memberOf SnapshotChecker
     */
    public getSnapshotForTestPosition(testSource: string, snapshotSource: string, line: number, character: number): SnapshotSourceInfo | undefined {
        try {
            const snapshotSourceStore = this.parseSnapshotFile(snapshotSource);
            const testSnapshotStore = this.parseTestFileAndGetSnapshotCalls(testSource);

            if (!snapshotSourceStore.sourceFile || !testSnapshotStore.sourceFile) {
                return;
            }

            const position = getPositionOfLineAndCharacter(testSnapshotStore.sourceFile, line, character);
            const testSnapshotCall = testSnapshotStore.snapshotCalls.find(snapshotCallInfo => position >= snapshotCallInfo.posStart && position <= snapshotCallInfo.posEnd);
            // No snapshot call for request position
            if (!testSnapshotCall) {
                return;
            }

            const matchedSnapshot = snapshotSourceStore.snapshotSource.find(snap => snap.name === testSnapshotCall.name);
            return matchedSnapshot;
        } catch (e) {
            return undefined;
        }
    }
    
    /**
     * Return snapshot call in test file information for given position in test file
     * 
     * @param {string} testSource
     * @param {string} snapshotSource
     * @param {number} line
     * @param {number} character
     * @returns {(TestSnapshotsCall | undefined)}
     * 
     * @memberOf SnapshotChecker
     */
    public getTestForSnapshotPosition(testSource: string, snapshotSource: string, line: number, character: number): TestSnapshotsCall | undefined {
        try {
            const snapshotSourceStore = this.parseSnapshotFile(snapshotSource);
            const testSnapshotStore = this.parseTestFileAndGetSnapshotCalls(testSource);

            if (!snapshotSourceStore.sourceFile || !testSnapshotStore.sourceFile) {
                return;
            }

            const position = getPositionOfLineAndCharacter(snapshotSourceStore.sourceFile, line, character);
            const matchedSnapshot = snapshotSourceStore.snapshotSource.find(snapshotInfo => position >= snapshotInfo.posStart && position <= snapshotInfo.posEnd);
            // No snapshot call for request position
            if (!matchedSnapshot) {
                return;
            }

            const matchedTest = testSnapshotStore.snapshotCalls.find(snapshotCall => snapshotCall.name === matchedSnapshot.name);
            return matchedTest;
        } catch (e) {
            return undefined;
        }
    }
    
    public getAllSnapshots(snapshotSource: string): SnapshotSourceInfo[] {
        try {
            const snapshotStore = this.parseSnapshotFile(snapshotSource);
            return snapshotStore.snapshotSource;
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Analyze test file and return all snapshot call information if exist
     * 
     * @private
     * @param {string} source
     * @returns {TestSnapshots[]}
     * 
     * @memberOf SnapshotChecker
     */
    private parseTestFileAndGetSnapshotCalls(source: string): TestSnapshotCallsStore {
        const snapshots: TestSnapshotsCall[] = [];
        let tsSourceFile: SourceFile | undefined;
        
        try {
            tsSourceFile = createSourceFile("inline.tsx", source, ScriptTarget.ES2015, true, ScriptKind.TSX);
            const firstNode = tsSourceFile.getChildAt(0);
            for (const node of firstNode.getChildren()) {
                // walk only for expressions
                if (node.kind === SyntaxKind.ExpressionStatement) {
                    this.parseExpressionStatement(node as ExpressionStatement, snapshots, "");
                }
            }
        } catch (e) {
            console.error("Error when parsing test file");
        }
        return {
            snapshotCalls: snapshots,
            sourceFile: tsSourceFile
        };
    }
    
    /**
     * Parse snapshot file and return snapshot export information
     * 
     * @private
     * @param {string} source
     * @returns {SnapshotSourceInfo[]}
     * 
     * @memberOf SnapshotChecker
     */
    private parseSnapshotFile(source: string): SnapshotSourceStore {
        const snapshotInfo: SnapshotSourceInfo[] = [];
        let tsSourceFile: SourceFile | undefined;
        try {
            tsSourceFile = createSourceFile("inline.js", source, ScriptTarget.Latest, true);
            const firstNode = tsSourceFile.getChildAt(0);
            for (const node of firstNode.getChildren()) {
                if (node.kind === SyntaxKind.ExpressionStatement && (node as ExpressionStatement).expression.kind === SyntaxKind.BinaryExpression) {
                    const exp = (node as ExpressionStatement).expression as BinaryExpression;
                    let snapshotSource = "";
                    if (exp.right.kind === SyntaxKind.NoSubstitutionTemplateLiteral || exp.right.kind === SyntaxKind.StringLiteral) {
                        snapshotSource = (exp.right as NoSubstitutionTemplateLiteral | StringLiteral).text;
                    }
                    
                    if (exp.left.kind === SyntaxKind.ElementAccessExpression) {
                        const nameExp = exp.left as ElementAccessExpression;
                        if (nameExp.argumentExpression &&
                            (nameExp.argumentExpression.kind === SyntaxKind.NoSubstitutionTemplateLiteral || nameExp.argumentExpression.kind === SyntaxKind.StringLiteral))
                        {
                            const lineAndCharacter = getLineAndCharacterOfPosition(tsSourceFile, exp.getStart());
                            snapshotInfo.push({
                                name: (nameExp.argumentExpression as NoSubstitutionTemplateLiteral | StringLiteral).text,
                                character: lineAndCharacter.character,
                                line: lineAndCharacter.line,
                                source: snapshotSource,
                                posStart: exp.getStart(),
                                posEnd: exp.getEnd()
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error when parsing snapshot file");
        }
        return {
            snapshotSource: snapshotInfo,
            sourceFile: tsSourceFile
        };
    }
    
    /**
     * Parse expression node
     * 
     * @private
     * @param {ExpressionStatement} node
     * @param {TestSnapshots[]} snapshots
     * @param {string} initialSuiteName
     * @returns {*}
     * 
     * @memberOf SnapshotChecker
     */
    private parseExpressionStatement(node: ExpressionStatement, snapshots: TestSnapshotsCall[], initialSuiteName: string): any {
        const suiteValidIdentifiers = this.configuration.suiteMethods;
        const testValidIdentifiers = this.configuration.testMethods;
        if (node.expression.kind === SyntaxKind.CallExpression) {
            const callExpression = node.expression as CallExpression;
            if (this.isCallExpressionMatchIdentifiers(callExpression, suiteValidIdentifiers)) {
                // It's suite start
                let name = this.getFirstStringLiteralInFuncCallArgs(callExpression);
                if (!name) {
                    name = "";
                }
                for (const arg of callExpression.arguments) {
                    if (arg.kind === SyntaxKind.ArrowFunction || arg.kind === SyntaxKind.FunctionExpression) {
                        const func = (arg as FunctionExpression | ArrowFunction);
                        this.parseSuiteFunctionBody(func.body, snapshots, initialSuiteName === "" ? name : `${initialSuiteName} ${name}`);
                    }
                }
            } else if (this.isCallExpressionMatchIdentifiers(callExpression, testValidIdentifiers)) {
                let testName = this.getFirstStringLiteralInFuncCallArgs(callExpression);
                if (!testName) {
                    testName = "";
                }
                for (const arg of callExpression.arguments) {
                    if (arg.kind === SyntaxKind.ArrowFunction || arg.kind === SyntaxKind.FunctionExpression) {
                        const func = (arg as FunctionExpression | ArrowFunction);
                        const testSnapshots = this.parseTestFunctionBody(func.body);
                        if (testSnapshots.length > 0) {
                            snapshots.push(...testSnapshots.map((snapshotInfo, index) => {
                                const fullName = snapshotInfo.ownName ? `${snapshotInfo.ownName} 1` :
                                    initialSuiteName === "" ? `${testName} ${index + 1}` : `${initialSuiteName} ${testName} ${index + 1}`;
                                return {
                                    name: fullName,
                                    line: snapshotInfo.line,
                                    character: snapshotInfo.character,
                                    posStart: snapshotInfo.posStart,
                                    posEnd: snapshotInfo.posEnd
                                }
                            }));
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Parse function body for suite
     * 
     * @private
     * @param {Node} node
     * @param {TestSnapshots[]} snapshots
     * @param {string} initialSuiteName
     * @returns {*}
     * 
     * @memberOf SnapshotChecker
     */
    private parseSuiteFunctionBody(node: Node, snapshots: TestSnapshotsCall[], initialSuiteName: string): any {
        // Only valid for blocks
        if (node.kind !== SyntaxKind.Block) {
            return;
        }
        const block = node as Block;
        for (let statement of block.statements) {
            if (statement.kind === SyntaxKind.ExpressionStatement) {
                this.parseExpressionStatement(statement as ExpressionStatement, snapshots, initialSuiteName);
            }
        }
    }
    /**
     * Parse function body for test (it(), fit(), test()...) function
     * 
     * @private
     * @param {Node} node
     * @returns {SnapshotInfo[]}
     * 
     * @memberOf SnapshotChecker
     */
    private parseTestFunctionBody(node: Node): SnapshotCallInfo[] {
        const snapshotInfos: SnapshotCallInfo[] = [];
        // it("test", () => expect().toMatchSnapshot())
        if (node.kind === SyntaxKind.CallExpression) {
            if (this.isCallExpressionIsSnapshotCall(node as CallExpression)) {
                const ownName = this.getFirstStringLiteralInFuncCallArgs(node as CallExpression);
                const characterAndPosition = getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart());
                snapshotInfos.push({
                    character: characterAndPosition.character,
                    line: characterAndPosition.line,
                    ownName: ownName,
                    posStart: node.getStart(),
                    posEnd: node.getEnd()
                });
            }
        } else if (node.kind === SyntaxKind.Block) {
            const block = node as Block;
            for (let statement of block.statements) {
                // snapshot calls are always expression kind
                if (statement.kind === SyntaxKind.ExpressionStatement) {
                    const exp = statement as ExpressionStatement;
                    if (exp.expression.kind === SyntaxKind.CallExpression && this.isCallExpressionIsSnapshotCall(exp.expression as CallExpression)) {
                        const characterAndPosition = getLineAndCharacterOfPosition(node.getSourceFile(), exp.getStart());
                        const ownName = this.getFirstStringLiteralInFuncCallArgs(exp.expression as CallExpression);
                        snapshotInfos.push({
                            character: characterAndPosition.character,
                            line: characterAndPosition.line,
                            ownName: ownName,
                            posStart: exp.getStart(),
                            posEnd: exp.getEnd()
                        });
                    }
                }
            }
        }
        return snapshotInfos;
    }
    
    
    /**
     * Return first string literal in function call or undefined
     * 
     * @private
     * @param {CallExpression} node
     * @returns {(string | undefined)}
     * 
     * @memberOf SnapshotChecker
     */
    private getFirstStringLiteralInFuncCallArgs(node: CallExpression): string | undefined {
        for (const argument of node.arguments) {
            if (argument.kind === SyntaxKind.StringLiteral) {
                return (argument as StringLiteral).text;
            }
        }
        return;
    }
    
    /**
     * Check if given call expression matches any of provided identifiers.
     * For property access experssions it checks the left side
     * 
     * @private
     * @param {CallExpression} node
     * @param {string[]} identifiers
     * @returns {boolean}
     * 
     * @memberOf SnapshotChecker
     */
    private isCallExpressionMatchIdentifiers(node: CallExpression, identifiers: string[]): boolean {
        // test() / it() // snapshot() / describe()
        if (node.expression.kind === SyntaxKind.Identifier) {
            return identifiers.includes((node.expression as Identifier).text);
        }
        // test.skip() / it.only() / expect().toMatchSnapshot() / t.snapshot()
        if (node.expression.kind === SyntaxKind.PropertyAccessExpression) {
            const propertyAcccessExpression = node.expression as PropertyAccessExpression;
            // check left side if it's identifier (identifier.func())
            if (propertyAcccessExpression.expression.kind === SyntaxKind.Identifier) {
                return identifiers.includes((propertyAcccessExpression.expression as Identifier).text);
            }
        }
        return false;
    }
    
    /**
     * Check if given call expression is snapshot call
     * 
     * @private
     * @param {CallExpression} node
     * @returns {boolean}
     * 
     * @memberOf SnapshotChecker
     */
    private isCallExpressionIsSnapshotCall(node: CallExpression): boolean {
        const snapshotIdentifiers = this.configuration.snapshotMethods;
        // snapshots calls can be only like identifier.call() or func().call()
        if (node.expression.kind === SyntaxKind.PropertyAccessExpression) {
            const propertyAcccessExpression = node.expression as PropertyAccessExpression;
            if (propertyAcccessExpression.name.kind === SyntaxKind.Identifier) {
                return snapshotIdentifiers.includes((propertyAcccessExpression.name as Identifier).text);
            }
        }
        return false;
    }
}