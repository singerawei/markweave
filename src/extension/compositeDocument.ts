import * as vscode from 'vscode';
import { DocumentGraph } from '../document/documentGraph';
import { SourceRepository } from '../document/sourceFile';
import { uriForPath } from '../document/fileIO';

export class CompositeDocument implements vscode.CustomDocument {
  undoDepth=0;redoDepth=0;
  readonly graph: DocumentGraph;
  readonly panels = new Set<vscode.WebviewPanel>();
  readonly trackedSources = new Set<string>();
  readonly rootUri: string;
  readonly openedAt = Date.now();
  readonly metrics: Record<string,number> = {};
  benchmark?: {inputP95Ms:number;scrollP95Ms:number;maxLongTaskMs:number};
  private readonly disposeEvent = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.disposeEvent.event;
  constructor(readonly uri: vscode.Uri, readonly repository: SourceRepository) {
    this.rootUri = uriForPath(uri.fsPath);
    this.graph = new DocumentGraph(repository,this.rootUri);
  }
  trackSources() { for (const uri of this.graph.sourceUris) this.trackedSources.add(uri); }
  get dirtySources() { return new Set([...this.trackedSources].filter(uri => this.repository.sources.get(uri)?.dirty)); }
  dispose() { this.disposeEvent.fire(); this.disposeEvent.dispose(); }
}
