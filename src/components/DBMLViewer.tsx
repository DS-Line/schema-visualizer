import { Editor, type Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { useEffect, useRef } from "react"

// Monaco's defineTheme API requires literal hex strings — CSS variables are not supported there.
const MONACO_THEME = {
  keyword: "008080",
  typeOrString: "6E86E2",
  comment: "A5A7A9",
  number: "FF9C40",
  identifier: "1F2227",
  background: "#FAF9F5",
  lineNumber: "#BCBDBE",
  // Matches --scrollbar-thumb / --scrollbar-thumb-hover from globals.css
  scrollbarThumb: "#D9D9D980",
  scrollbarThumbHover: "#D9D9D9FF",
  scrollbarThumbActive: "#101828FF",
} as const

interface Props {
  value: string
  scrollToLine?: number
}

export default function DBMLViewer({ value, scrollToLine }: Props) {
  const monacoRef = useRef<Monaco>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null)
  const decorationsRef = useRef<string[]>([])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      scrollToLine !== undefined
        ? [
            {
              range: new monaco.Range(scrollToLine, 1, scrollToLine, 1),
              options: { isWholeLine: true, className: "dbml-highlight-line" },
            },
          ]
        : [],
    )

    if (scrollToLine !== undefined) {
      editor.revealLineInCenter(scrollToLine)
    }
  }, [scrollToLine])

  const handleMount = (
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => {
    editorRef.current = editorInstance
    monacoRef.current = monaco

    if (
      !monaco.languages
        .getLanguages()
        .some((lang: { id: string }) => lang.id === "dbml")
    ) {
      monaco.languages.register({ id: "dbml" })
    }

    monaco.languages.setMonarchTokensProvider("dbml", {
      tokenizer: {
        // Root: top-level scope (outside any block)
        root: [
          [/\/\/.*$/, "comment"],
          [/"[^"]*"/, "identifier"], // quoted identifier (table name, ref endpoint)
          [/"/, "string", "@string_double"],
          [/'/, "string", "@string_single"],
          [/`[^`]*`/, "string"],
          [/\d+(\.\d+)?/, "number"],
          [
            /\b(Table|Ref|Enum|TableGroup|Project|Note|Indexes)\b/,
            "keyword.control",
          ],
          [/<>|[<>-]/, "operator"],
          // Entering a block pushes table_body state
          [/\{/, { token: "@brackets", next: "@table_body" }],
          [/[{}()[\]]/, "@brackets"],
          [/[.,:;]/, "delimiter"],
          [/[a-zA-Z_][\w$]*/, "identifier"],
        ],

        // Inside a Table / Enum block.
        // DBML column structure: column_name  type  [constraints]
        // We use state to detect position — no type enumeration needed.
        table_body: [
          [/\/\/.*$/, "comment"],
          [/}/, { token: "@brackets", next: "@pop" }],
          // Sub-section keywords must come before the identifier rule
          [/\b(Note|note|Indexes|indexes)\b/, "keyword.control"],
          // Nested block (e.g. Indexes { ... })
          [/\{/, { token: "@brackets", next: "@table_body" }],
          // Constraint block
          [/\[/, { token: "@brackets", next: "@constraint" }],
          [/"[^"]*"/, { token: "identifier", next: "@col_type" }], // quoted column name
          [/"/, "string", "@string_double"],
          [/'/, "string", "@string_single"],
          [/`[^`]*`/, "string"],
          [/\d+(\.\d+)?/, "number"],
          [/[()[\]]/, "@brackets"],
          [/[.,:;]/, "delimiter"],
          // Column name — the next identifier after this will be the type
          [/[a-zA-Z_][\w$]*/, { token: "identifier", next: "@col_type" }],
        ],

        // Immediately after a column name: next identifier is always the type.
        // Handles any SQL or custom type without enumeration.
        col_type: [
          [/[ \t]+/, ""], // skip horizontal whitespace only
          [/"[^"]*"/, { token: "type", next: "@pop" }], // quoted type ("USER-DEFINED", "character varying", etc.)
          [/[a-zA-Z_][\w$]*/, { token: "type", next: "@pop" }],
          // Constraint block directly after name (type omitted) — bail back
          [/\[/, { token: "@brackets", next: "@pop" }],
        ],

        // Inside [...] constraint / settings block
        constraint: [
          [/]/, { token: "@brackets", next: "@pop" }],
          [/"/, "string", "@string_double"],
          [/'/, "string", "@string_single"],
          [/`[^`]*`/, "string"],
          [/\d+(\.\d+)?/, "number"],
          [
            /\b(pk|unique|increment|not|null|default|delete|update|cascade|restrict|ref|no|action|set|primary|key)\b/i,
            "keyword",
          ],
          [/<>|[<>-]/, "operator"],
          [/[.,:;]/, "delimiter"],
          [/[a-zA-Z_][\w$]*/, "identifier"],
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
          foreground: MONACO_THEME.keyword,
          fontStyle: "bold",
        },
        { token: "keyword", foreground: MONACO_THEME.keyword },
        { token: "type", foreground: MONACO_THEME.typeOrString },
        { token: "string", foreground: MONACO_THEME.typeOrString },
        { token: "comment", foreground: MONACO_THEME.comment },
        { token: "number", foreground: MONACO_THEME.number },
        { token: "identifier", foreground: MONACO_THEME.identifier },
      ],
      colors: {
        "editor.background": MONACO_THEME.background,
        "editorLineNumber.foreground": MONACO_THEME.lineNumber,
        "editorLineNumber.activeForeground": MONACO_THEME.lineNumber,
        // Match the app's custom scrollbar palette from globals.css
        "scrollbarSlider.background": MONACO_THEME.scrollbarThumb,
        "scrollbarSlider.hoverBackground": MONACO_THEME.scrollbarThumbHover,
        "scrollbarSlider.activeBackground": MONACO_THEME.scrollbarThumbActive,
        "scrollbar.shadow": "#00000000",
      },
    })

    editorInstance.updateOptions({ theme: "dbml-theme" })
  }

  return (
    <div className="absolute inset-0">
      <style>{`
        .dbml-highlight-line { background: rgba(77, 166, 166, 0.5) !important; }
        .monaco-editor .margin { border-right: 1px solid #BCBDBE; }
        .monaco-editor .lines-content { padding-left: 16px !important; }
        .monaco-scrollable-element > .scrollbar {
          background: ${MONACO_THEME.background} !important;
        }
      `}</style>
      <Editor
        defaultLanguage="dbml"
        value={value}
        height="100%"
        width="100%"
        onMount={handleMount}
        theme="dbml-theme"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontFamily: "Jetbrains Mono",
          fontSize: 12,
          lineHeight: 18,
          padding: { top: 8, bottom: 8 },
          glyphMargin: false,
          lineDecorationsWidth: 4,
          contextmenu: false,
          lineNumbersMinChars: 6,
          occurrencesHighlight: "off",
          renderLineHighlight: "none",
          guides: { indentation: false, bracketPairs: false },
          overviewRulerLanes: 0,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            useShadows: false,
            verticalScrollbarSize: 3,
            horizontalScrollbarSize: 3,
            verticalSliderSize: 3,
            horizontalSliderSize: 3,
          },
        }}
      />
    </div>
  )
}
