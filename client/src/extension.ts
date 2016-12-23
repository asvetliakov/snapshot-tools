import * as path from "path";

import { workspace, Disposable, ExtensionContext, commands, window, Selection, Position, Uri, TextEditorRevealType, Range } from "vscode";
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind, TextDocumentPositionParams, Location } from "vscode-languageclient";

export function activate(context: ExtensionContext) {

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join("server", "src", "server.js"));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--debug=6005"] };
	
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },

	}
	
	const configuration = workspace.getConfiguration("snapshotTools");
	const testFileExt = configuration.get("testFileExt");
	const snapshotFileExt = configuration.get("snapshotExt");
	
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: ["javascript", "typescript", "javascriptreact", "typescriptreact", "snapshot"],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: "snapshotTools",
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: [
				workspace.createFileSystemWatcher(`**/*${testFileExt}`),
				workspace.createFileSystemWatcher(`**/*${snapshotFileExt}`)
			]
		}
	}
	
	// Create the language client and start the client.
	// const client = new LanguageClient("languageServerExample", "Language server example", serverOptions, clientOptions);
	const client = new LanguageClient("SnapshotToolsServer", "Snapshot tools server", serverOptions, clientOptions);
	
	
	const commandDisposable = commands.registerTextEditorCommand("snapshotTools.navigateToDefinition", async editor => {
		const position = editor.selection.active;
		const param: TextDocumentPositionParams = {
			position: position,
			textDocument: {
				uri: editor.document.uri.toString()
			}
		};
		try {
			const response = await client.sendRequest<Location>("snapshotTools/navigateToDefinition", param);
			if (response) {
				const document = await workspace.openTextDocument(Uri.parse(response.uri));
				const editor = await window.showTextDocument(document);
				const startPosition = response.range.start;
				const endPosition = response.range.end;
				window.activeTextEditor.selection = new Selection(
					new Position(startPosition.line, startPosition.character),
					new Position(endPosition.line, endPosition.character)
				);
				window.activeTextEditor.revealRange(
					new Range(startPosition.line, startPosition.character, endPosition.line, endPosition.character),
					TextEditorRevealType.InCenter
				);
			}
		} catch (e) {

		}
	});

	const clientDisposable = client.start();
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(clientDisposable);
	context.subscriptions.push(commandDisposable);
}
