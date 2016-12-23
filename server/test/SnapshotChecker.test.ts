import * as sinon from "sinon";
import { expect } from "chai";
import { ConfigurationManager } from "../src/ConfigurationManager";
import { DiagnosticCodes, SnapshotChecker } from "../src/SnapshotChecker";

const snapshotSource1 = `
exports["Test 1"] = "abc";

exports["Test 2"] = "cde";

exports["Another 1"] = "123";
`
const snapshotSource2 = `
exports["test Test 1"] = "abc";

exports["test Test 2"] = "cde";

exports["test Another 1"] = "123";
`

const snapshotIncorrect = `
exports["Test 1"] = "abc";
dsafdasf
`

const TestSource1 = `
describe("test", () => {
    it("Test", () => {
        expect().toMatchSnapshot();
        expect().toMatchSnapshot();
    });
    
    it("Another", () => {
        expect().toMatchSnapshot();
    });
});
`

const TestSource2 = `
describe("test", () => {
    it("Test", () => {
        expect().toMatchSnapshot();
    });
});
`

const TestSource3 = `
describe("test", () => {
    it("Test", () => {
        expect().toMatchSnapshot();
        expect().toMatchSnapshot();
    });
    
    it("Another", () => {
        expect().toMatchSnapshot();
        expect().toMatchSnapshot();
    });
    
    it("Third", () => {
        expect().toMatchSnapshot();
        expect().toMatchSnapshot();
    });
});
`

describe("SnapshotChecker", () => {
    let checker: SnapshotChecker;
    let configuration: ConfigurationManager;
    beforeEach(() => {
        configuration = new ConfigurationManager();
        checker = new SnapshotChecker(configuration);
    });
    
    describe("getDiagnosticForSnapshot", () => {
        it("Should return no test file error when testSource is undefined", () => {
            const res = checker.getDiagnosticForSnapshot(snapshotSource1, undefined);
            expect(res![0]).to.containSubset({
                code: DiagnosticCodes.NO_TEST_FILE,
                range: {
                    start: {
                        line: 0,
                        character: 0
                    },
                    end: {
                        line: 6,
                        character: Number.MAX_VALUE
                    }
                }
            });
        });
        
        it("Should return undefined if there was error when parsing snapshot source", () => {
            expect(checker.getDiagnosticForSnapshot(snapshotIncorrect, TestSource1)).to.be.undefined;
        });
        
        it("Should return empty array if snapshot keys and test are match", () => {
            let res = checker.getDiagnosticForSnapshot(snapshotSource1, TestSource1);
            expect(res!.length).to.equal(0);

            res = checker.getDiagnosticForSnapshot(snapshotSource2, TestSource1);
            expect(res!.length).to.equal(0);

        });
        
        it("Should return diagnostic for redunant keys", () => {
            const res1 = checker.getDiagnosticForSnapshot(snapshotSource1, TestSource2);
            const res2 = checker.getDiagnosticForSnapshot(snapshotSource2, TestSource2);
            expect(res1!.length).to.equal(2);
            expect(res2!.length).to.equal(2);

            for (let diagnosticResults of [res1, res2]) {
                expect(diagnosticResults![0]).to.containSubset({
                    code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                    range: {
                        start: {
                            line: 3,
                            character: 0
                        },
                        end: {
                            line: 3,
                            character: Number.MAX_VALUE
                        }
                    }
                });
                expect(diagnosticResults![1]).to.containSubset({
                    code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                    range: {
                        start: {
                            line: 5,
                            character: 0
                        },
                        end: {
                            line: 5,
                            character: Number.MAX_VALUE
                        }
                    }
                });
            }
        });
    });
    
    describe("getDiagnosticForTest", () => {
        it("Should return empty diagnostics if snapshotSource is undefined and test doesn't contain any of snapshot match calls", () => {
            expect(checker.getDiagnosticForTest("test()\ntest2()\n", undefined)).to.deep.equal([]);
        });
        
        it("Should return undefined if there was error when parsing snapshot source", () => {
            expect(checker.getDiagnosticForTest(TestSource1, snapshotIncorrect)).to.be.undefined;
        });
        
        it("Should return empty array if snapshot source has all test keys ", () => {
            let res = checker.getDiagnosticForTest(TestSource1, snapshotSource1);
            expect(res!.length).to.equal(0);
            
            res = checker.getDiagnosticForTest(TestSource2, snapshotSource1);
            expect(res!.length).to.equal(0);
            
            res = checker.getDiagnosticForTest(TestSource1, snapshotSource2);
            expect(res!.length).to.equal(0);

            res = checker.getDiagnosticForTest(TestSource2, snapshotSource2);
            expect(res!.length).to.equal(0);
        });
        
        it("Should return diagnostic for test with snapshot calls and no snapshot source", () => {
            const res = checker.getDiagnosticForTest(TestSource3, undefined);
            expect(res!.length).to.equal(6);
        });

        it("Should return snapshot doesn't exist diagnostic", () => {
            const res1 = checker.getDiagnosticForTest(TestSource3, snapshotSource1);
            const res2 = checker.getDiagnosticForTest(TestSource3, snapshotSource2);
            expect(res1!.length).to.equal(3);
            expect(res2!.length).to.equal(3);
            
            for (let results of [res1, res2]) {
                expect(results![0]).to.containSubset({
                    code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                    range: {
                        start: {
                            line: 9,
                        },
                        end: {
                            line: 9
                        }
                    }
                });
                expect(results![1]).to.containSubset({
                    code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                    range: {
                        start: {
                            line: 13,
                        },
                        end: {
                            line: 13
                        }
                    }
                });
                expect(results![2]).to.containSubset({
                    code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                    range: {
                        start: {
                            line: 14,
                        },
                        end: {
                            line: 14
                        }
                    }
                });
            }
        });
    });
});