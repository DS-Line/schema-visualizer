"use client"

import { SchemaBuilder } from "@schema-viz/SchemaBuilder"

const DEMO_SCHEMA = `CREATE TABLE users (
  id integer PRIMARY KEY,
  username varchar(255),
  email varchar(255),
  created_at timestamp
);

CREATE TABLE posts (
  id integer PRIMARY KEY,
  user_id integer,
  title varchar(255),
  body text,
  created_at timestamp
);

CREATE TABLE comments (
  id integer PRIMARY KEY,
  post_id integer,
  user_id integer,
  body text
);

-- View with auto-detected columns:
CREATE VIEW post_summary AS 
SELECT 
  p.id as post_id, 
  p.title, 
  u.username as author 
FROM posts p
JOIN users u ON p.user_id = u.id;

-- Standard SQL Foreign Keys:
ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users (id);

-- DBML-style relationships (SQL-like syntax):
-- Ref: comments.post_id = posts.id
-- Ref: post_summary.post_id = posts.id

-- Custom Fetch Syntax:
-- fetch: [users.email, posts.title, post_summary.author]
`

export default function DevPlayground() {
  const handleSave = async (newSchema: string) => {
    console.log("Saving to backend...\n", newSchema)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    alert("Saved! Check console for the string output.")
  }

  return (
    <main className="h-screen w-screen bg-black">
      <SchemaBuilder initialSchema={DEMO_SCHEMA} onSave={handleSave} />
    </main>
  )
}
