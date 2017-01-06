/*import * as sinon from "sinon";
import * as fs from "fs";
import { expect } from "chai";
import { TextDocument, TextDocuments, TextDocumentChangeEvent, IConnection } from "vscode-languageserver";
import { LinkedDocumentsMap } from "../src/LinkedDocumentsMap";
import { ConfigurationManager } from "../src/ConfigurationManager";
import { DocumentManager, DocumentNeedValidation } from "../src/DocumentManager";

xdescribe("DocumentManager", () => {
    let documentManager: DocumentManager;
    let configurationManager: ConfigurationManager;
    let openedDocumentsManager: TextDocuments;
    let linkedDocumentsMap: LinkedDocumentsMap;
    let documentNeedValidationCallback: DocumentNeedValidation;
    beforeEach(() => {
        configurationManager = sinon.createStubInstance(ConfigurationManager) as any;
        openedDocumentsManager = new TextDocuments();
        sinon.stub(openedDocumentsManager, "listen");
        sinon.stub(openedDocumentsManager, "get");
        linkedDocumentsMap = new LinkedDocumentsMap();
        documentManager = new DocumentManager(openedDocumentsManager, configurationManager, linkedDocumentsMap);
        documentNeedValidationCallback = sinon.spy();
        documentManager.onDocumentNeedValidation(documentNeedValidationCallback);
    });
    
    describe("listen()", () => {
        it("Should listen for documents", () => {
            documentManager.listen({} as any);
            expect(openedDocumentsManager.listen).to.have.been.calledWithExactly({});
        });
    });
    
    describe("getLinkedTest()", () => {
        beforeEach(() => {
            (configurationManager.resolveTestFilePath as sinon.SinonStub).returns("/home/test/test.tsx");
        });
        it("Should return undefined if testPath couldn't be resolved with snapshotUri", () => {
            (configurationManager.resolveTestFilePath as sinon.SinonStub).returns(undefined);
            expect(documentManager.getLinkedTest("file://test")).to.be.undefined;
        });
        
        it("Should return source from opened documents manager if it exists", () => {
            const textDocument: TextDocument = {
                getText: () => "test source",
                languageId: "",
                lineCount: 1,
                uri: "",
                version: 1,
                offsetAt: {} as any,
                positionAt: {} as any
            };
            (openedDocumentsManager.get as sinon.SinonStub).returns(textDocument);
            const testSource = documentManager.getLinkedTest("file://home/test.snap");
            expect(configurationManager.resolveTestFilePath).to.have.been.calledWith("file://home/test.snap");
            expect(openedDocumentsManager.get).to.have.been.calledWith("file:///home/test/test.tsx");
            expect(testSource).to.equal("test source");
        });
        
        it("Should return source from linked documents", () => {
            (openedDocumentsManager.get as sinon.SinonStub).returns(undefined);
            linkedDocumentsMap.set("file:///home/test/test.tsx", "another source");
            const testSource = documentManager.getLinkedTest("file://home/test.snap");
            expect(configurationManager.resolveTestFilePath).to.have.been.calledWith("file://home/test.snap");
            expect(testSource).to.equal("another source");
        });
        
        it("Should try to read file if requested test path is not available in opened/linked documents", () => {
            sinon.stub(fs, "readFileSync").returns("readed source");
            (openedDocumentsManager.get as sinon.SinonStub).returns(undefined);
            const testSource = documentManager.getLinkedTest("file://home/test.snap");
            expect(fs.readFileSync).to.have.been.calledWith("/home/test/test.tsx");
            expect(testSource).to.equal("readed source");
            (fs.readFileSync as sinon.SinonStub).restore();
        });
    });

    describe("getLinkedSnapshot()", () => {
        beforeEach(() => {
            (configurationManager.resolveSnapshotFilePath as sinon.SinonStub).returns("/home/test/test.snap");
        });
        it("Should return undefined if snapshotPath couldn't be resolved with testUri", () => {
            (configurationManager.resolveSnapshotFilePath as sinon.SinonStub).returns(undefined);
            expect(documentManager.getLinkedSnapshot("file://test")).to.be.undefined;
        });
        
        it("Should return source from opened documents manager if it exists", () => {
            const textDocument: TextDocument = {
                getText: () => "snapshot source",
                languageId: "",
                lineCount: 1,
                uri: "",
                version: 1,
                offsetAt: {} as any,
                positionAt: {} as any
            };
            (openedDocumentsManager.get as sinon.SinonStub).returns(textDocument);
            const testSource = documentManager.getLinkedSnapshot("file://home/test.tsx");
            expect(configurationManager.resolveSnapshotFilePath).to.have.been.calledWith("file://home/test.tsx");
            expect(openedDocumentsManager.get).to.have.been.calledWith("file:///home/test/test.snap");
            expect(testSource).to.equal("snapshot source");
        });
        
        it("Should return source from linked documents", () => {
            (openedDocumentsManager.get as sinon.SinonStub).returns(undefined);
            linkedDocumentsMap.set("file:///home/test/test.snap", "another source");
            const testSource = documentManager.getLinkedSnapshot("file://home/test.tsx");
            expect(configurationManager.resolveSnapshotFilePath).to.have.been.calledWith("file://home/test.tsx");
            expect(testSource).to.equal("another source");
        });
        
        it("Should try to read file if requested test path is not available in opened/linked documents", () => {
            sinon.stub(fs, "readFileSync").returns("readed source");
            (openedDocumentsManager.get as sinon.SinonStub).returns(undefined);
            const testSource = documentManager.getLinkedSnapshot("file://home/test.tsx");
            expect(fs.readFileSync).to.have.been.calledWith("/home/test/test.snap");
            expect(testSource).to.equal("readed source");
            (fs.readFileSync as sinon.SinonStub).restore();
        });
    });
    
    describe("onDidChangeContent()", () => {
        let testChange: TextDocumentChangeEvent;
        let snapshotChange: TextDocumentChangeEvent;
        let untitledChange: TextDocumentChangeEvent;
        beforeEach(() => {
            const documentParams = {
                getText: () => "test",
                languageId: "",
                lineCount: 1,
                offsetAt: {} as any,
                positionAt: {} as any,
                version: 1
            };
            testChange = {
                document: {
                    ...documentParams,
                    uri: "file:///home/test.tsx"
                }
            };
            snapshotChange = {
                document: {
                    ...documentParams,
                    uri: "file:///home/test.snap"
                }
            };
            untitledChange = {
                document: {
                    ...documentParams,
                    uri: "untitled://untitled1"
                }
            };
        });
        it("Shouldn't do anything if uri is not file uri", () => {
            documentManager.onDidChangeContent(untitledChange);
            expect(documentNeedValidationCallback).to.have.not.been.called;
            expect(openedDocumentsManager.get).to.have.not.been.called;
            expect(configurationManager.resolveTestFilePath).to.have.not.been.called;
            expect(configurationManager.resolveSnapshotFilePath).to.have.not.been.called;
        });
    });
});*/