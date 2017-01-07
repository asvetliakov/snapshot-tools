# snapshot-tools
## Features
* Test file/snapshot file validation (displays warning when snapshot is redunant/snapshot hasn't been created)
* Display snapshot content on hover
* Navigation to snapshot/test file from test file/snapshot
* Show all snapshots names in symbol view

## How to get it

Install snapshot-tools extension in VS Code

Snapshot text mate language was taken from [vscode-jest extension](https://github.com/orta/vscode-jest)

### Validation

![Snapshot validation](/client/images/snapshot-validation.gif)

### Display snapshot content on hover

![Snapshot hover](/client/images/snapshot-hover.gif)

### Navigation to snapshot/test

![Snapshot navigation](/client/images/snapshot-navigation.gif)

You can use *Go to definition* VS code command (F12 by default) or *Navigate to test/snapshot* (Cmd/Ctrl + Alt + F12 by default)

### Show all snapshot symbols

![Snapshot symbols](/client/images/snapshot-symbols.gif)


## Limitations

Due to static analysis the language server can't determine snapshot calls if tests are being consructed somehow dynamic. For example this won't work:

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

## Changelog

### [0.0.4]
- Fixed windows issues
- Fixed user configuration was not being applied properly

### [0.0.1 - 0.0.3]
- Initial release