import { SchemaBuilder } from "./components/SchemaBuilder"
import type { SchemaBuilderValue } from "./lib/types"

const sampleDBML = `// Tables
Table users {
  id        int      [pk, increment]
  name      varchar  [not null]
  email     varchar  [unique, not null]
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id        int      [pk, increment]
  title     varchar(255)  [not null]
  content   text
  author_id int      [not null]
  created_at timestamp [default: \`now()\`]
}

Table comments {
  id        int      [pk, increment]
  post_id   int      [not null]
  user_id   int      [not null]
  message   text     [not null]
  created_at timestamp [default: \`now()\`]
}

// Relationships
Ref: posts.author_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
  `

export default function App() {
  return (
    <div className="h-screen w-screen">
      {/*
        Uncontrolled — component owns state, parent just listens.
        Swap `defaultValue` for `value` to go fully controlled.
      */}
      <SchemaBuilder
        defaultValue={{ schema: sampleDBML, selectedColumns: [] }}
        onChange={(data: SchemaBuilderValue & { isDirty: boolean }) => {
          console.log("changed", data)
        }}
        onSave={async (data) => {
          console.log("saved", data)
        }}
        readonly={true}
      />
    </div>
  )
}
