alter table public.profiles enable row level security;
alter table public.academic_titles enable row level security;
alter table public.documents enable row level security;

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
  and exists (
    select 1
    from public.profiles teacher
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and teacher.department_key = academic_titles.department_key
      and teacher.year = academic_titles.year
  )
);

create policy "users read matching academic titles"
on public.academic_titles for select
to authenticated
using (
  exists (
    select 1
    from public.profiles viewer
    where viewer.id = auth.uid()
      and viewer.department_key = academic_titles.department_key
      and viewer.year = academic_titles.year
  )
);

create policy "students manage own documents"
on public.documents for all
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles student
    where student.id = auth.uid()
      and student.role = 'student'
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles student
    where student.id = auth.uid()
      and student.role = 'student'
      and student.department_key = documents.department_key
      and student.year = documents.year
  )
);

create policy "teachers read matching academic documents"
on public.documents for select
to authenticated
using (
  category = 'academic'
  and exists (
    select 1
    from public.profiles teacher
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and teacher.department_key = documents.department_key
      and teacher.year = documents.year
  )
);

create policy "teachers delete matching academic documents"
on public.documents for delete
to authenticated
using (
  category = 'academic'
  and exists (
    select 1
    from public.profiles teacher
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and teacher.department_key = documents.department_key
      and teacher.year = documents.year
  )
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
  and exists (
    select 1 from public.profiles student
    where student.id = auth.uid()
      and student.role = 'student'
  )
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
    join public.profiles teacher on teacher.id = auth.uid()
    where doc.file_path = storage.objects.name
      and doc.category = 'academic'
      and teacher.role = 'teacher'
      and teacher.department_key = doc.department_key
      and teacher.year = doc.year
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
    join public.profiles teacher on teacher.id = auth.uid()
    where doc.file_path = storage.objects.name
      and doc.category = 'academic'
      and teacher.role = 'teacher'
      and teacher.department_key = doc.department_key
      and teacher.year = doc.year
  )
);
