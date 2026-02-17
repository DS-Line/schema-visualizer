# Schema Visualizer

An interactive database schema editor built with React. Accepts a DBML schema, renders it as a visual canvas of tables and relationships, and lets you create or delete relationships directly by dragging between columns.

## Features

- **Visual canvas** — tables and columns rendered as draggable nodes, auto-laid out with dagre
- **Draw relationships** — drag from any column to another to create a ref; drag on the canvas handles type compatibility validation
- **Delete relationships** — hover any edge and click the delete button
- **Read-only DBML editor** — always reflects the live state of the schema including any ref changes
- **Column selection** — check up to 20 text columns across tables (useful for passing selected fields upstream)
- **Collapsible / resizable sidebar** — drag the divider or collapse the editor panel entirely
- **Copy to clipboard** — copies the current DBML with live refs applied
- **Dirty tracking** — save and reset buttons only activate when something has changed
- **Type validation** — incompatible column types are rejected with an inline toast

## Getting started

```bash
pnpm install
pnpm dev
```

## Usage

`SchemaBuilder` supports both controlled and uncontrolled usage, following the same `value` / `defaultValue` convention as native HTML inputs.

### Uncontrolled (component owns state)

The simplest way. Pass `defaultValue` once and listen to changes via `onChange`.

```tsx
import { SchemaBuilder } from "@denzing/schema-visualizer"

<SchemaBuilder
  defaultValue={{
    schema: myDBML,
    selectedColumns: [],
  }}
  onChange={({ schema, selectedColumns, refs, isDirty }) => {
    console.log("changed", { schema, selectedColumns, refs, isDirty })
  }}
  onSave={async ({ schema, selectedColumns, refs }) => {
    await saveToDatabase({ schema, selectedColumns, refs })
  }}
/>
```

### Controlled (parent owns state)

Pass `value` and keep it updated via `onChange`. The component re-syncs whenever `value` changes.

```tsx
const [value, setValue] = useState({
  schema: myDBML,
  selectedColumns: [],
})

<SchemaBuilder
  value={value}
  onChange={(data) => setValue({
    schema: data.schema,
    selectedColumns: data.selectedColumns,
  })}
  onSave={async (data) => {
    await saveToDatabase(data)
  }}
/>
```

## Props

| Prop | Type | Description |
|---|---|---|
| `defaultValue` | `SchemaBuilderValue` | Seed value for uncontrolled mode. Read once on mount. |
| `value` | `SchemaBuilderValue` | Controlled value. Component syncs whenever this changes. |
| `onChange` | `(data: SchemaBuilderChangeData) => void` | Fires on every ref or column selection change. |
| `onSave` | `(data: SchemaBuilderChangeData) => Promise<void>` | Called when the user clicks Save. Omitting this prop hides the Save button. |
| `defaultCollapsed` | `boolean` | Start with the editor sidebar collapsed. Defaults to `false`. |

## Types

```ts
interface SchemaBuilderValue {
  schema: string          // DBML string
  selectedColumns: string[] // e.g. ["users.email", "posts.title"]
}

interface SchemaBuilderChangeData extends SchemaBuilderValue {
  refs: SchemaRef[]  // live relationship list
  isDirty: boolean   // true if refs or selectedColumns differ from the initial value
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

## Stack

- [React 19](https://react.dev)
- [@xyflow/react](https://reactflow.dev) — canvas and node/edge rendering
- [@dbml/parse](https://github.com/holistics/dbml) — DBML parsing
- [dagre](https://github.com/dagrejs/dagre) — automatic graph layout
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) — read-only DBML editor with syntax highlighting
- [Tailwind CSS v4](https://tailwindcss.com)
- [Vite](https://vitejs.dev)
