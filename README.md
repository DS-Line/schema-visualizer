# Schema Visualizer

A React/Next.js submodule for visualizing database schemas in an interactive canvas. Supports editing, highlighting, and custom node/edge rendering.

- Create/Delete connection directly from the canvas or via the editor
- Click on the connection or the table to highlight the syntax in the editor
- Editor shows syntax error and data type mismatch
- Collapsible/expandable and draggable editor
- Custom parser that supports comment like ddl `--Ref:` and `--Fetch:` for the connections rendering

## Sample Schema DDL

```
CREATE TABLE users (
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
```

## Installation

```bash
pnpm install
```

## Start the dev server:

```bash
pnpm dev
```

## Screenshots

<img alt="Canvas visible with Schema Editor Expanded" src="https://github.com/user-attachments/assets/f60f72e3-b9d2-4a30-8df6-39b94fb92e0c" />
<img alt="Canvas visible with Schema Editor Collapsed" src="https://github.com/user-attachments/assets/0b3b32f5-d52f-4ffa-9aad-f4fbda97b315" />
