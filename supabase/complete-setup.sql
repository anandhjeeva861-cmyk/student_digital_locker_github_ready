-- Student Digital Locker Supabase complete setup
-- Run this file in Supabase Dashboard > SQL Editor.
-- Safe to rerun after edits; policies are dropped/recreated.

begin;

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

grant usage on schema public to anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant select, insert, delete on public.documents to authenticated;
grant select, insert on public.academic_titles to authenticated;

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

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
begin
  user_role := new.raw_user_meta_data->>'role';

  if user_role not in ('student', 'teacher') then
    return new;
  end if;

  insert into public.profiles (
    id,
    role,
    name,
    email,
    mobile,
    department,
    department_key,
    year,
    reg_no,
    photo_url
  )
  values (
    new.id,
    user_role,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), 'USER'),
    lower(coalesce(new.email, new.raw_user_meta_data->>'email')),
    coalesce(nullif(new.raw_user_meta_data->>'mobile', ''), new.id::text),
    coalesce(nullif(new.raw_user_meta_data->>'department', ''), 'UNKNOWN'),
    coalesce(nullif(new.raw_user_meta_data->>'department_key', ''), 'UNKNOWN'),
    coalesce(nullif(new.raw_user_meta_data->>'year', ''), 'UNKNOWN'),
    nullif(new.raw_user_meta_data->>'reg_no', ''),
    coalesce(new.raw_user_meta_data->>'photo_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.academic_titles enable row level security;
alter table public.documents enable row level security;

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "students create own profile" on public.profiles;
drop policy if exists "teachers create own profile" on public.profiles;
drop policy if exists "users update own profile photo" on public.profiles;
drop policy if exists "teachers read matching student profiles" on public.profiles;
drop policy if exists "teachers create matching academic titles" on public.academic_titles;
drop policy if exists "users read matching academic titles" on public.academic_titles;
drop policy if exists "students manage own documents" on public.documents;
drop policy if exists "teachers read matching academic documents" on public.documents;
drop policy if exists "teachers delete matching academic documents" on public.documents;
drop policy if exists "students upload own certificate files" on storage.objects;
drop policy if exists "students read own certificate files" on storage.objects;
drop policy if exists "students delete own certificate files" on storage.objects;
drop policy if exists "teachers read matching academic files" on storage.objects;
drop policy if exists "teachers delete matching academic files" on storage.objects;

revoke update on public.profiles from authenticated;
grant update (photo_url, updated_at) on public.profiles to authenticated;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_department_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department_key from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_year()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select year from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_department_key() to authenticated;
grant execute on function public.current_profile_year() to authenticated;

create policy "users read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "students create own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'student');

create policy "teachers create own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'teacher');

create policy "users update own profile photo"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "teachers read matching student profiles"
on public.profiles for select
to authenticated
using (
  role = 'student'
  and public.current_profile_role() = 'teacher'
  and public.current_profile_department_key() = profiles.department_key
  and public.current_profile_year() = profiles.year
);

create policy "teachers create matching academic titles"
on public.academic_titles for insert
to authenticated
with check (
  created_by_teacher_id = auth.uid()
  and public.current_profile_role() = 'teacher'
  and public.current_profile_department_key() = academic_titles.department_key
  and public.current_profile_year() = academic_titles.year
);

create policy "users read matching academic titles"
on public.academic_titles for select
to authenticated
using (
  public.current_profile_department_key() = academic_titles.department_key
  and public.current_profile_year() = academic_titles.year
);

create policy "students manage own documents"
on public.documents for all
to authenticated
using (
  owner_id = auth.uid()
  and public.current_profile_role() = 'student'
)
with check (
  owner_id = auth.uid()
  and public.current_profile_role() = 'student'
  and public.current_profile_department_key() = documents.department_key
  and public.current_profile_year() = documents.year
);

create policy "teachers read matching academic documents"
on public.documents for select
to authenticated
using (
  category = 'academic'
  and public.current_profile_role() = 'teacher'
  and public.current_profile_department_key() = documents.department_key
  and public.current_profile_year() = documents.year
);

create policy "teachers delete matching academic documents"
on public.documents for delete
to authenticated
using (
  category = 'academic'
  and public.current_profile_role() = 'teacher'
  and public.current_profile_department_key() = documents.department_key
  and public.current_profile_year() = documents.year
);

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do update set public = false;

create policy "students upload own certificate files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'certificates'
  and (
    name like 'documents/' || auth.uid()::text || '/online/%'
    or name like 'documents/' || auth.uid()::text || '/personal/%'
    or name like 'documents/' || auth.uid()::text || '/academic/%'
    or name like 'profilePhotos/' || auth.uid()::text || '/%'
  )
  and public.current_profile_role() = 'student'
);

create policy "students read own certificate files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'certificates'
  and (
    name like 'documents/' || auth.uid()::text || '/%'
    or name like 'profilePhotos/' || auth.uid()::text || '/%'
  )
);

create policy "students delete own certificate files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'certificates'
  and (
    name like 'documents/' || auth.uid()::text || '/%'
    or name like 'profilePhotos/' || auth.uid()::text || '/%'
  )
);

create policy "teachers read matching academic files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'certificates'
  and name like 'documents/%/academic/%'
  and exists (
    select 1
    from public.documents doc
    where doc.file_path = storage.objects.name
      and doc.category = 'academic'
      and public.current_profile_role() = 'teacher'
      and public.current_profile_department_key() = doc.department_key
      and public.current_profile_year() = doc.year
  )
);

create policy "teachers delete matching academic files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'certificates'
  and name like 'documents/%/academic/%'
  and exists (
    select 1
    from public.documents doc
    where doc.file_path = storage.objects.name
      and doc.category = 'academic'
      and public.current_profile_role() = 'teacher'
      and public.current_profile_department_key() = doc.department_key
      and public.current_profile_year() = doc.year
  )
);

commit;

