import { ConfigurationManager } from "../ConfigurationManager";
import { DiagnosticCodes, SnapshotChecker } from "../SnapshotChecker";

const simpleSnapshotSource1 = `
exports["desc test 1"] = "abc";
`;

const simpleTestSource1 = `
describe("desc", () => {
    it("test", () => {
        expect().toMatchSnapshot();
    });
});
`;


describe("SnapshotChecker", () => {
    let checker: SnapshotChecker;
    let configuration: ConfigurationManager;
    beforeEach(() => {
        configuration = new ConfigurationManager();
        checker = new SnapshotChecker(configuration);
    });
    
    describe("getDiagnosticForSnapshot/getDiagnosticForTest", () => {
        describe("getDiagnosticForSnapshot", () => {
            it("Should return no test file error when testSource is undefined", () => {
                const res = checker.getDiagnosticForSnapshot(simpleSnapshotSource1, undefined);
                expect(res![0]).toMatchObject({
                    code: DiagnosticCodes.NO_TEST_FILE,
                    range: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 2,
                            character: Number.MAX_VALUE
                        }
                    }
                });
            });
        });
        
        describe("getDiagnosticForTest", () => {
            it("Should return empty diagnostics if snapshotSource is undefined and test doesn't contain any of snapshot match calls", () => {
                const res = checker.getDiagnosticForTest("test()\ntest2()\n", undefined);
                expect(res!.length).toEqual(0);
            });
        });
        
        
        describe("Should return diagnostic", () => {
            describe("Jest like", () => {
                it("Simple test and snapshot", () => {
                    let res = checker.getDiagnosticForSnapshot(simpleSnapshotSource1, simpleTestSource1);
                    expect(res!.length).toEqual(0);
                    
                    res = checker.getDiagnosticForTest(simpleTestSource1, simpleSnapshotSource1);
                    expect(res!.length).toEqual(0);

                    const source = `
                    describe("desc", () => {
                        it("another", () => {
                            expect().toMatchSnapshot();
                        });
                    });
                    `;
                    res = checker.getDiagnosticForSnapshot(simpleSnapshotSource1, source);
                    expect(res!.length).toEqual(1);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: {
                                line: 1,
                                character: 0
                            },
                            end: {
                                line: 1,
                                character: Number.MAX_VALUE
                            }
                        }
                    });
                    
                    res = checker.getDiagnosticForTest(source, simpleSnapshotSource1);
                    expect(res!.length).toEqual(1);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                        range: {
                            start: {
                                line: 4,
                            },
                            end: {
                                line: 4,
                            }
                        }
                    });
                });
                
                it("nested test calls", () => {
                    let snapshotSource = `
                    exports["desc1 nested1 test 1"] = "abc";
                    
                    exports["desc1 nested1 test 2"] = "cde";
                    
                    exports["desc2 nested2 test 1"] = "efg";
                    
                    exports["desc2 nested3 inner test 1"] = "qwe";
                    `;
                    
                    let testSource = `
                    describe("desc1", () => {
                        describe("nested1", () => {
                            it("test", () => {
                                expect().toMatchSnapshot();
                                expect().toMatchSnapshot();
                            });
                        });
                    });
                    describe("desc2", function () {
                        describe("nested2", () => {
                            it("test", () => {
                                expect().toMatchSnapshot();
                            });
                        });
                        
                        describe("nested3", () => {
                            describe("inner", function () {
                                it("test", () => {
                                    expect().toMatchSnapshot();
                                });
                            });
                        });
                    });
                    `;

                    let res = checker.getDiagnosticForSnapshot(snapshotSource, testSource);
                    expect(res!.length).toEqual(0);
                    
                    res = checker.getDiagnosticForTest(testSource, snapshotSource);
                    expect(res!.length).toEqual(0);
                    
                    testSource = `
                    describe("desc1", () => {
                        describe("nested1", () => {
                            it("test", () => {
                                expect().toMatchSnapshot();
                                expect().toMatchSnapshot();
                            });
                        });
                    });
                    `;
                    
                    res = checker.getDiagnosticForSnapshot(snapshotSource, testSource);
                    expect(res!.length).toEqual(2);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: {
                                line: 5
                            }
                        }
                    });
                    expect(res![1]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: {
                                line: 7
                            }
                        }
                    });
                    
                    snapshotSource = `
                    exports["desc1 nested1 test 1"] = "abc";
                    `;
                    
                    res = checker.getDiagnosticForTest(testSource, snapshotSource);
                    expect(res!.length).toEqual(1);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                        range: {
                            start: {
                                line: 5
                            }
                        }
                    });
                });
                
                it("calls with exact snapshot name", () => {
                    let snapshotSource = `
                    exports["given name 1"] = "abc";
                    
                    exports["ololo name 1"] = "cde";
                    `;
                    
                    let testSource = `
                    describe("test", () => {
                        it("some test", () => {
                            expect().toMatchSnapshot("given name");
                        });
                    });
                    
                    describe("test2", function () {
                        it("test2 test", function () {
                            expect().toMatchSnapshot("ololo name");
                        });
                    });
                    `;
                    
                    let res = checker.getDiagnosticForSnapshot(snapshotSource, testSource);
                    expect(res!.length).toEqual(0);
                    
                    res = checker.getDiagnosticForTest(testSource, snapshotSource);
                    expect(res!.length).toEqual(0);
                    
                    testSource = `
                    describe("test", () => {
                        it("some test", () => {
                            expect().toMatchSnapshot("given name");
                        });
                    });
                    `;
                    res = checker.getDiagnosticForSnapshot(snapshotSource, testSource);
                    expect(res!.length).toEqual(1);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: {
                                line: 3
                            }
                        }
                    });
                    
                    snapshotSource = `
                    exports["some other name 1"] = "abc";
                    
                    exports["some name 1"] = "cde";
                    `;
                    
                    testSource = `
                    describe("test", () => {
                        it("some test", () => {
                            expect().toMatchSnapshot("another");
                        });
                        
                        it("test", () => {
                            expect().toMatchSnapshot("some name");
                        });
                    });
                    `;
                    
                    res = checker.getDiagnosticForTest(testSource, snapshotSource);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                        range: {
                            start: {
                                line: 3
                            }
                        }
                    });
                });
            });
            
            describe("Ava like", () => {
                it("Should return diagnostic", () => {
                    const snapshotSource = `
                    exports["test 1"] = "abc";

                    exports["test 2"] = "cde";

                    exports["another test 1"] = "efg";
                    `;
                    
                    let testSource = `
                    test("test", t => {
                        t.snapshot();
                        t.snapshot();
                    });
                    
                    test("another test", (t) => {
                        t.snapshot();
                    });
                    `;
                    
                    let res = checker.getDiagnosticForSnapshot(snapshotSource, testSource);
                    expect(res!.length).toEqual(0);
                    
                    res = checker.getDiagnosticForTest(testSource, snapshotSource);
                    expect(res!.length).toEqual(0);
                    
                    testSource = `
                    test("another test", (t) => {
                        t.snapshot();
                    });
                    `;
                    
                    res = checker.getDiagnosticForSnapshot(snapshotSource, testSource);
                    expect(res!.length).toEqual(2);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: {
                                line: 1
                            }
                        }
                    });
                    expect(res![1]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_REDUNANT,
                        range: {
                            start: {
                                line: 3
                            }
                        }
                    });
                    
                    testSource = `
                    test("test", t => {
                        t.snapshot();
                        t.snapshot();
                        t.snapshot();
                    });
                    
                    test("another test", (t) => {
                        t.snapshot();
                    });
                    test("some other test", t => {
                        t.snapshot();
                    });
                    `;
                    
                    res = checker.getDiagnosticForTest(testSource, snapshotSource);
                    expect(res!.length).toEqual(2);
                    expect(res![0]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                        range: {
                            start: {
                                line: 4
                            }
                        }
                    });
                    expect(res![1]).toMatchObject({
                        code: DiagnosticCodes.SNAPSHOT_DOESNT_EXIST,
                        range: {
                            start: {
                                line: 11
                            }
                        }
                    });
                });
            });
        });
    });
    
    describe("getAllSnapshots()", () => {
        it("Should return empty array if snapshot parsing was failed", () => {
            const source = `exports["abc`;
            
            const res = checker.getAllSnapshots(source);
            expect(res.length).toEqual(0);
        });
        
        it("Should return empty array if it's not snapshot file", () => {
            const source = `describe("test", () => {})`;
            const res = checker.getAllSnapshots(source);
            expect(res.length).toEqual(0);
        });
        
        it("Should return snapshot information", () => {
            const source = `
            exports["desc1 test 1"] = "abc";
            exports["desc1 test 2"] = "cde";
            exports["desc2 test 1"] = "efg";
            `;
            
            const res = checker.getAllSnapshots(source);
            expect(res.length).toEqual(3);
            expect(res[0]).toMatchObject({
                source: "abc",
                name: "desc1 test 1",
                line: 1
            });
            expect(res[1]).toMatchObject({
                source: "cde",
                name: "desc1 test 2",
                line: 2
            });
            expect(res[2]).toMatchObject({
                source: "efg",
                name: "desc2 test 1",
                line: 3
            });
        });
    });
});