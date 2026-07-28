# Database Design

SQLite database path defaults to:

```text
server/data/locker.db
```

## profiles

- `id` primary key
- `role` student or teacher
- `name`
- `email` unique
- `mobile` unique
- `department`
- `department_key`
- `year`
- `reg_no` unique, student only
- `photo_path`
- `password_hash`
- `created_at`
- `updated_at`

## academic_titles

- `id` primary key
- `title`
- `department`
- `department_key`
- `year`
- `created_by_teacher_id`
- `created_at`
- unique title per department/year

## documents

- `id` primary key
- `owner_id` references `profiles.id`
- `owner_name`
- `owner_reg_no`
- `department`
- `department_key`
- `year`
- `category`: online, personal, academic
- `title`
- `file_name`
- `file_path`
- `uploaded_at`
- unique owner/category/title
