# Schema Visualizer

An interactive database schema editor built with React. Accepts a DBML schema, renders it as a visual canvas of tables and relationships, and lets you create or delete relationships directly by dragging between columns.

## Getting started

```bash
pnpm install
pnpm dev
```

## Usage

`SchemaEditor` supports both controlled and uncontrolled usage, following the same `value` / `defaultValue` convention as native HTML inputs.

### Uncontrolled (component owns state)

```tsx
import { SchemaEditor } from "@denzing/schema-visualizer"

<SchemaEditor
  defaultValue={{
    schema: myDBML,
    cachedColumns: [],
  }}
  onChange={({ schema, cachedColumns, refs, isDirty }) => {
    console.log("changed", { schema, cachedColumns, refs, isDirty })
  }}
/>
```

### Controlled (parent owns state)

```tsx
const [value, setValue] = useState({
  schema: myDBML,
  cachedColumns: [],
})

<SchemaEditor
  value={value}
  onChange={(data) => setValue({
    schema: data.schema,
    cachedColumns: data.cachedColumns,
  })}
/>
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultValue` | `SchemaEditorValue` | — | Seed value for uncontrolled mode. Read once on mount. |
| `value` | `SchemaEditorValue` | — | Controlled value. Component syncs whenever this changes. |
| `onChange` | `(data: SchemaEditorChangeData) => void` | — | Fires on every ref or cached column change. |
| `defaultCollapsed` | `boolean` | `false` | Start with the DBML sidebar collapsed. |
| `readonly` | `boolean` | `false` | Disables edge creation/deletion and column checkboxes. |

## Types

```ts
interface SchemaEditorValue {
  schema: string         // DBML string
  cachedColumns: string[] // e.g. ["users.email", "posts.title"]
}

interface SchemaEditorChangeData extends SchemaEditorValue {
  refs: SchemaRef[]  // live relationship list
  isDirty: boolean   // true if refs or cachedColumns differ from the initial value
}

interface SchemaRef {
  id: string
  fromTable: string
  fromCol: string
  toTable: string
  toCol: string
  relationType: ">" | "<" | "-" | "<>"
}
```

## DBML format

The component parses standard [DBML](https://dbml.dbdiagram.io/docs/). Tables, columns, and `Ref:` lines are all supported.

```dbml
Table users {
  id         int       [pk, increment]
  email      varchar   [unique, not null]
  created_at timestamp [default: `now()`]
}

Table posts {
  id        int     [pk, increment]
  author_id int     [not null]
  title     varchar(255)
  content   text
}

Ref: posts.author_id > users.id
```

Ref relation types follow DBML convention: `>` (many-to-one), `<` (one-to-many), `-` (one-to-one), `<>` (many-to-many). New refs created on the canvas default to `>`.

## Features

- **Resizable sidebar** — drag the divider to resize (min 300px / max 800px). Collapses to icon on screens narrower than 768px.
- **Auto layout** — dagre-based layout for connected tables; isolated tables use a balanced grid.
- **Edge interactions** — click an edge to select it (teal animated dash + open arrow); hover to reveal a delete button.
- **Column selection** — check text-type columns to cache them (max 20). Visible in the info panel as a diff against the initial state.
- **Drawing relationships** — drag from a column's right handle to another column's left handle.
- **Fullscreen** — sidebar auto-collapses on fullscreen enter and restores on exit.
- **Auto-arrange** — toggle to re-layout automatically whenever relationships change.

## Stack

- [React 19](https://react.dev)
- [@xyflow/react](https://reactflow.dev) — canvas and node/edge rendering
- [@dbml/parse](https://github.com/holistics/dbml) — DBML parsing
- [dagre](https://github.com/dagrejs/dagre) — automatic graph layout
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) — read-only DBML viewer with syntax highlighting
- [Tailwind CSS v4](https://tailwindcss.com)
- [Vite](https://vitejs.dev)
