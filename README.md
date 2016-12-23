# snapshot-tools
## Features
* Test file/snapshot file validation (displays warning when snapshot is redunant/snapshot hasn't been created)
* Display snapshot content on hover
* Navigation to snapshot/test file from test file/snapshot
* Show all snapshots names in symbol view

## How to get it

Install snapshot-tools extension in VS Code

### Validation

<img src="https://github.com/asvetliakov/snapshot-tools/raw/master/images/snapshot-validation.gif alt="Snapshot validation" width="100%">

### Display snapshot content on hover

<img src="https://github.com/asvetliakov/snapshot-tools/raw/master/images/snapshot-hover.gif alt="Snapshot hover" width="100%">

### Navigation to snapshot/test

<img src="https://github.com/asvetliakov/snapshot-tools/raw/master/images/snapshot-navigation.gif alt="Snapshot navigation" width="100%">

You can use *Go to definition* VS code command (F12 by default) or *Navigate to test/snapshot* (Cmd/Ctrl + Alt + F12 by default)

### Show all snapshot symbols

<img src="https://github.com/asvetliakov/snapshot-tools/raw/master/images/snapshot-symbols.gif alt="Snapshot symbols" width="100%">


## Limitations

Due to static analysis the language server can't determine snapshot calls if tests are being consructed dynamic. For example this won't work:

```js
describe("test", () => {
    const name = "my test";
    it(name, () => {
        expect(tree).toMatchSnapshot();
    });
});
```

or

```js
describe("test", () => {
    it("my test", () => {
        const checkSomething = () => {
            expect(tree).toMatchSnapshot();
        };
        checkSomething();
    });
});
```

## Configuration

You must set *snapshotTools.testFileExt* to your test files extension if they are different than ".jsx". 
Set it to ".js" if you're compiling sources before running, otherwise set to ".tsx" or leave it as ".jsx" if using typescript in-memory transpilation or babel require hook