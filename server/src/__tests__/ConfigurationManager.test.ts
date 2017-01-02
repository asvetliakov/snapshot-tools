import { ConfigurationManager } from "../ConfigurationManager";

describe("ConfigurationManager", () => {
    let manager: ConfigurationManager;
    beforeEach(() => {
        manager = new ConfigurationManager();
        manager.workspaceRoot = "/home/test/workspace";
    });
    
    describe("resolveSnapshotFilePath()", () => {
        it("Should return undefined if given uri is not file scheme", () => {
            expect(manager.resolveSnapshotFilePath("untitled://untitled1")).toBeUndefined();
        });
        
        it("Should return snapshot file path based on default params", () => {
            const path = manager.resolveSnapshotFilePath("file:///home/test/workspace/src/__tests__/test.tsx");
            expect(path).toEqual("/home/test/workspace/src/__tests__/__snapshots__/test.tsx.snap");
        });
        
        it("Should resolve with custom snapshotDir and snapshotExt", () => {
            manager.snapshotExt = ".supersnap";
            manager.snapshotDir = "./snapshots/";
            const path = manager.resolveSnapshotFilePath("file:///home/test/workspace/src/__tests__/test.tsx");
            expect(path).toEqual("/home/test/workspace/src/__tests__/snapshots/test.tsx.supersnap");
        });
        
        it("Should work with ${workspaceRoot} and ${relativePath} in snapshotDir", () => {
            manager.snapshotDir = "${workspaceRoot}/snapshots/${relativePath}";
            const path = manager.resolveSnapshotFilePath("file:///home/test/workspace/src/test/test.tsx");
            expect(path).toEqual("/home/test/workspace/snapshots/src/test/test.tsx.snap");
        });
        
        it("Should work with non-default relative root", () => {
            manager.snapshotDir = "${workspaceRoot}/snapshots/${relativePath}";
            manager.testFileRoot = "./src";
            const path = manager.resolveSnapshotFilePath("file:///home/test/workspace/src/test/test.tsx");
            expect(path).toEqual("/home/test/workspace/snapshots/test/test.tsx.snap");
        });
    });

    describe("resolveTestFilePath()", () => {
        it("Should return undefined if given uri is not file scheme", () => {
            expect(manager.resolveTestFilePath("untitled://untitled1")).toBeUndefined();
        });
        
        it("Should return test file path based on default params", () => {
            const path = manager.resolveTestFilePath("file:///home/test/workspace/src/__tests__/__snapshots__/test.tsx.snap");
            expect(path).toEqual("/home/test/workspace/src/__tests__/test.tsx");
        });
        
        it("Should resolve with custom testFileDir and testFileExt", () => {
            manager.testFileExt = ".jsx";
            manager.testFileDir = "../";
            const path = manager.resolveTestFilePath("file:///home/test/workspace/src/tests/snapshots/test.jsx.snap");
            expect(path).toEqual("/home/test/workspace/src/tests/test.jsx");
        });
        
        it("Should work with ${workspaceRoot} and ${relativePath} in testFileDir", () => {
            manager.testFileDir = "${workspaceRoot}/tests/${relativePath}";
            const path = manager.resolveTestFilePath("file:///home/test/workspace/snapshots/test/test.tsx.snap");
            expect(path).toEqual("/home/test/workspace/tests/snapshots/test/test.tsx");
        });
        
        it("Should work with non-default relative root", () => {
            manager.testFileDir = "${workspaceRoot}/tests/${relativePath}";
            manager.snapshotRoot = "./snapshots";
            const path = manager.resolveTestFilePath("file:///home/test/workspace/snapshots/test/test.tsx.snap");
            expect(path).toEqual("/home/test/workspace/tests/test/test.tsx");
        });
    });
});