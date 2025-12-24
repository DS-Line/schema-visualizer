"use client";

import { useEffect, useRef } from "react";

import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import { SchemaError, SchemaTable } from "@schema-viz/lib/types";
import { Loader2 } from "lucide-react";
import type { editor, IDisposable, languages, Position } from "monaco-editor";

interface MonacoWrapperProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  schemaTables?: SchemaTable[];
  validationErrors?: SchemaError[];
  onCursorChange?: (line: number, col: number) => void;
  highlightRequest?: { line: number; col: number; ts: number } | null;
}

export const MonacoWrapper = ({
  value,
  onChange,
  readOnly,
  schemaTables = [],
  validationErrors = [],
  onCursorChange,
  highlightRequest,
}: MonacoWrapperProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const highlightCollectionRef =
    useRef<editor.IEditorDecorationsCollection | null>(null);

  const completionDisposableRef = useRef<IDisposable | null>(null);

  const updateDecorations = (
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco,
    text: string
  ) => {
    const model = editorInstance.getModel();
    if (!model) return;

    const metadataMatches: editor.IModelDeltaDecoration[] = [];
    const regex = /--\s*(Ref:|fetch:).*/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      metadataMatches.push({
        range: new monacoInstance.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        ),
        options: { inlineClassName: "metadata-token" },
      });
    }
    decorationsRef.current = editorInstance.deltaDecorations(
      decorationsRef.current,
      metadataMatches
    );
  };

  // Scroll and highlight
  useEffect(() => {
    if (!highlightRequest || !editorRef.current || !monacoRef.current) return;

    const { line, col } = highlightRequest;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    editor.revealLineInCenterIfOutsideViewport(line);
    editor.setPosition({ lineNumber: line, column: col });
    editor.focus();

    // Create collection
    if (!highlightCollectionRef.current) {
      highlightCollectionRef.current = editor.createDecorationsCollection();
    }

    highlightCollectionRef.current.set([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "line-highlight-brief",
        },
      },
    ]);

    const timer = setTimeout(() => {
      highlightCollectionRef.current?.clear();
    }, 500);

    return () => clearTimeout(timer);
  }, [highlightRequest]);

  // Squiggly Lines (Markers)
  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const markers = validationErrors.map((err) => ({
          severity: 8,
          message: err.message,
          startLineNumber: err.startLineNumber,
          startColumn: err.startColumn,
          endLineNumber: err.endLineNumber,
          endColumn: err.endColumn,
        }));
        monacoRef.current.editor.setModelMarkers(model, "owner", markers);
      }
    }
  }, [validationErrors]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !schemaTables) return;
    if (completionDisposableRef.current)
      completionDisposableRef.current.dispose();

    completionDisposableRef.current =
      monaco.languages.registerCompletionItemProvider("sql", {
        triggerCharacters: ["."],
        provideCompletionItems: (
          model: editor.ITextModel,
          position: Position
        ) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          const textUntilCursor = model
            .getLineContent(position.lineNumber)
            .substring(0, position.column - 1);
          const isMemberAccess = textUntilCursor.trim().endsWith(".");

          const suggestions: languages.CompletionItem[] = [];

          if (isMemberAccess) {
            const match = textUntilCursor.match(/(\w+)[\s]*\.$/);
            const tableName = match ? match[1] : null;
            if (tableName) {
              const table = schemaTables.find((n) => n.name === tableName);
              if (table) {
                table.columns.forEach((col) => {
                  suggestions.push({
                    label: col.name,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: col.name,
                    detail: `${col.type} (${table.name})`,
                    range: range,
                  });
                });
              }
            }
          } else {
            schemaTables.forEach((node) => {
              suggestions.push({
                label: node.name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: node.name,
                detail: node.type === "view" ? "View" : "Table",
                range: range,
              });
            });
            [
              "SELECT",
              "FROM",
              "WHERE",
              "CREATE TABLE",
              "INSERT INTO",
              "UPDATE",
              "DELETE",
              "ALTER TABLE",
            ].forEach((kw) => {
              suggestions.push({
                label: kw,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: kw,
                range: range,
              });
            });
          }
          return { suggestions };
        },
      });

    return () => {
      if (completionDisposableRef.current)
        completionDisposableRef.current.dispose();
    };
  }, [schemaTables]);

  const handleMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    monacoInstance.editor.defineTheme("custom-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#f2f2ed",
        "editor.lineHighlightBackground": "#e5e7eb",
      },
    });
    monacoInstance.editor.setTheme("custom-light");

    updateDecorations(editorInstance, monacoInstance, value);

    if (onCursorChange) {
      editorInstance.onDidChangeCursorPosition((e) => {
        onCursorChange(e.position.lineNumber, e.position.column);
      });
    }
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current)
      updateDecorations(editorRef.current, monacoRef.current, value);
  }, [value]);

  const handleChange = (val: string | undefined) => {
    const newValue = val || "";
    onChange(newValue);
    if (editorRef.current && monacoRef.current)
      updateDecorations(editorRef.current, monacoRef.current, newValue);
  };

  return (
    <div
      className="h-full w-full relative"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <style>{`
        .metadata-token { color: #c93fdfff !important; font-weight: 500; }
        .line-highlight-brief { background: rgba(67, 132, 236, 0.3) !important; border-left: 3px solid #3b82f6; }
      `}</style>
      <Editor
        height="100%"
        width="100%"
        defaultLanguage="sql"
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        loading={<Loader2 className="animate-spin" />}
        options={{
          automaticLayout: true,
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'Inter', monospace",
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          suggest: { showKeywords: false },
          unicodeHighlight: {
            invisibleCharacters: false,
            ambiguousCharacters: false, // Helps with weird quote marks
          },
        }}
      />
    </div>
  );
};
