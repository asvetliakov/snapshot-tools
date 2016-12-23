import {
    createConnection,
    IConnection,
    IPCMessageReader,
    IPCMessageWriter,
    TextDocuments
} from "vscode-languageserver";
import { ConfigurationManager } from "./ConfigurationManager";
import { DocumentManager } from "./DocumentManager";
import { LinkedDocumentsMap } from "./LinkedDocumentsMap";
import { ServerManager } from "./ServerManager";
import { SnapshotChecker } from "./SnapshotChecker";

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

const confManager = new ConfigurationManager();
const linkedDocumentsMap = new LinkedDocumentsMap();
const textDocuments = new TextDocuments();
const documentManager = new DocumentManager(textDocuments, confManager, linkedDocumentsMap);
const snapshotChecker = new SnapshotChecker(confManager);
const serverManager = new ServerManager(connection, documentManager, snapshotChecker, confManager);

serverManager.listen();
