import { Editor } from "@monaco-editor/react"
import { useRef } from "react"

interface Props {
  value: string
}

export default function DBMLEditor({ value }: Props) {
  const monacoRef = useRef<any>(null)

  const handleMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco

    // Register DBML language support
    if (
      !monaco.languages.getLanguages().some((lang: any) => lang.id === "dbml")
    ) {
      monaco.languages.register({ id: "dbml" })

      monaco.languages.setMonarchTokensProvider("dbml", {
        keywords: [
          "Table",
          "Ref",
          "Enum",
          "TableGroup",
          "Project",
          "Note",
          "Indexes",
          "pk",
          "unique",
          "not",
          "null",
          "increment",
          "default",
          "delete",
          "SET",
          "NULL",
          "CASCADE",
        ],
        typeKeywords: [
          "int",
          "integer",
          "varchar",
          "text",
          "boolean",
          "bool",
          "timestamp",
          "datetime",
          "date",
          "time",
          "decimal",
          "float",
          "double",
          "bigint",
          "numeric",
          "smallint",
          "json",
          "uuid",
        ],
        operators: ["<", ">", "-", "<>"],

        tokenizer: {
          root: [
            // Comments
            [/\/\/.*$/, "comment"],

            // Numbers
            [/\d+/, "number"],

            // Strings
            [/"([^"\\]|\\.)*$/, "string.invalid"], // non-terminated string
            [/'([^'\\]|\\.)*$/, "string.invalid"], // non-terminated string
            [/"/, "string", "@string_double"],
            [/'/, "string", "@string_single"],

            // Keywords (case-sensitive)
            [
              /\b(Table|Ref|Enum|TableGroup|Project|Note|Indexes)\b/,
              "keyword.control",
            ],
            [
              /\b(pk|unique|increment|default|not null|null|delete|SET NULL|CASCADE)\b/,
              "keyword",
            ],

            // Type keywords
            [
              /\b(int|integer|varchar|text|boolean|bool|timestamp|datetime|date|time|decimal|float|double|bigint|numeric|smallint|json|uuid)\b/,
              "type",
            ],

            // Brackets and operators
            [/[{}()[\]]/, "@brackets"],
            [/[<>-]/, "operator"],

            // Identifiers
            [/[a-z_$][\w$]*/, "identifier"],
          ],

          string_double: [
            [/[^\\"]+/, "string"],
            [/\\./, "string.escape"],
            [/"/, "string", "@pop"],
          ],

          string_single: [
            [/[^\\']+/, "string"],
            [/\\./, "string.escape"],
            [/'/, "string", "@pop"],
          ],
        },
      })

      monaco.editor.defineTheme("dbml-theme", {
        base: "vs",
        inherit: true,
        rules: [
          {
            token: "keyword.control",
            foreground: "#008080",
            fontStyle: "bold",
          },
          { token: "keyword", foreground: "#008080" },
          { token: "type", foreground: "#6E86E2" },
          { token: "string", foreground: "#6E86E2" },
          { token: "comment", foreground: "#A5A7A9" },
          { token: "number", foreground: "#FF9C40" },
          { token: "identifier", foreground: "#1F2227" },
        ],
        colors: {
          "editor.background": "#FAF9F5",
        },
      })
    }

    // Set the theme on the editor instance
    editor.updateOptions({ theme: "dbml-theme" })
  }

  return (
    <Editor
      defaultLanguage="dbml"
      value={value}
      onMount={handleMount}
      theme="dbml-theme"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontFamily: "IBM Plex Mono",
        fontSize: 14,
        lineHeight: 21,
      }}
    />
  )
}
