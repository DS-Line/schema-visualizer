"use client";
import React, { useRef, useEffect } from "react";
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import type {
  editor,
  languages,
  Position,
  IDisposable,
} from "monaco-editor";
import { Loader2 } from "lucide-react";
import { SchemaNode } from "@/lib/types";

interface MonacoWrapperProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  schemaNodes?: SchemaNode[];
}

export const MonacoWrapper: React.FC<MonacoWrapperProps> = ({
  value,
  onChange,
  readOnly,
  schemaNodes = [],
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

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
        options: {
          inlineClassName: "metadata-token",
        },
      });
    }

    decorationsRef.current = editorInstance.deltaDecorations(
      decorationsRef.current,
      metadataMatches
    );
  };

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !schemaNodes) return;

    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    completionDisposableRef.current =
      monaco.languages.registerCompletionItemProvider("sql", {
        triggerCharacters: ["."],
        provideCompletionItems: (
          model: editor.ITextModel,
          position: Position,
        ) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const lineContent = model.getLineContent(position.lineNumber);
          const textUntilCursor = lineContent.substring(0, position.column - 1);
          const isMemberAccess = textUntilCursor.trim().endsWith(".");

          const suggestions: languages.CompletionItem[] = [];

          if (isMemberAccess) {
            const match = textUntilCursor.match(/(\w+)[\s]*\.$/);
            const tableName = match ? match[1] : null;

            if (tableName) {
              const table = schemaNodes.find((n) => n.name === tableName);
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
            schemaNodes.forEach((node) => {
              suggestions.push({
                label: node.name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: node.name,
                detail: node.type === "view" ? "View" : "Table",
                range: range,
              });
            });

            const keywords = [
              "SELECT",
              "FROM",
              "WHERE",
              "CREATE TABLE",
              "INSERT INTO",
              "UPDATE",
              "DELETE",
              "ALTER TABLE",
            ];
            keywords.forEach((kw) => {
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
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
    };
  }, [schemaNodes]);

  const handleMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    monacoInstance.editor.defineTheme("custom-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: { "editor.background": "#0f172a" },
    });
    monacoInstance.editor.setTheme("custom-dark");

    updateDecorations(editorInstance, monacoInstance, value);
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      updateDecorations(editorRef.current, monacoRef.current, value);
    }
  }, [value]);

  const handleChange = (val: string | undefined) => {
    const newValue = val || "";
    onChange(newValue);
    if (editorRef.current && monacoRef.current) {
      updateDecorations(editorRef.current, monacoRef.current, newValue);
    }
  };

  return (
    <div className="h-full w-full relative">
      <style>{`
        .metadata-token {
          color: #f472b6 !important; 
          font-weight: bold;
          font-style: normal !important;
        }
      `}</style>
      <Editor
        height="100%"
        defaultLanguage="sql"
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        loading={<Loader2 className="animate-spin text-blue-500" />}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          suggest: {
            showKeywords: false,
          },
        }}
      />
    </div>
  );
};
