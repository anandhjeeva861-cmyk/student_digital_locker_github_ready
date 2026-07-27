create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  name text not null,
  email text not null unique,
  mobile text not null unique,
  department text not null,
  department_key text not null,
  year text not null,
  reg_no text unique,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  department_key text not null,
  year text not null,
  created_by_teacher_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (title, department_key, year)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_name text not null,
  owner_reg_no text,
  department text not null,
  department_key text not null,
  year text not null,
  category text not null check (category in ('online', 'personal', 'academic')),
  title text not null,
  file_name text not null,
  file_path text not null,
  file_url text,
  uploaded_at timestamptz not null default now(),
  unique (owner_id, category, title)
);

create index if not exists profiles_role_scope_idx on public.profiles (role, department_key, year);
create index if not exists documents_owner_category_idx on public.documents (owner_id, category);
create index if not exists documents_scope_category_idx on public.documents (department_key, year, category);
create index if not exists academic_titles_scope_idx on public.academic_titles (department_key, year);

create or replace function public.profile_value_exists(check_column text, check_value text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if check_column not in ('mobile', 'reg_no', 'email') then
    raise exception 'Unsupported duplicate check column';
  end if;

  if check_value is null or length(trim(check_value)) = 0 then
    return false;
  end if;

  if check_column = 'mobile' then
    return exists (select 1 from public.profiles where mobile = check_value);
  elsif check_column = 'reg_no' then
    return exists (select 1 from public.profiles where reg_no = check_value);
  end if;

  return exists (select 1 from public.profiles where email = lower(check_value));
end;
$$;

grant execute on function public.profile_value_exists(text, text) to anon, authenticated;
