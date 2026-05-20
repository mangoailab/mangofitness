-- Track whether an athlete completed a programmed/self-created workout.

create table if not exists public.athlete_workout_statuses (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  status text not null check (status = 'done'),
  notes text,
  marked_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, workout_id)
);

create index if not exists athlete_workout_statuses_athlete_idx on public.athlete_workout_statuses(athlete_id, marked_on desc);
create index if not exists athlete_workout_statuses_workout_idx on public.athlete_workout_statuses(workout_id);

alter table public.athlete_workout_statuses enable row level security;

alter table public.athlete_workout_statuses
  drop constraint if exists athlete_workout_statuses_status_check;
alter table public.athlete_workout_statuses
  add constraint athlete_workout_statuses_status_check check (status = 'done');

create or replace function public.can_mark_workout_status(p_workout_id uuid, p_athlete_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_coach()
    or (
      p_athlete_id in (select public.current_athlete_ids())
      and exists (
        select 1
        from public.workouts w
        where w.id = p_workout_id
          and (
            coalesce(w.assignment_type, 'everyone') = 'everyone'
            or exists (
              select 1
              from public.workout_assignments wa
              where wa.workout_id = w.id
                and wa.athlete_id = p_athlete_id
            )
          )
      )
    )
$$;

drop policy if exists "read own athlete workout statuses" on public.athlete_workout_statuses;
create policy "read own athlete workout statuses" on public.athlete_workout_statuses for select to authenticated using (
  public.is_coach()
  or auth_user_id = auth.uid()
  or athlete_id in (select public.current_athlete_ids())
);

drop policy if exists "insert own athlete workout statuses" on public.athlete_workout_statuses;
create policy "insert own athlete workout statuses" on public.athlete_workout_statuses for insert to authenticated with check (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_mark_workout_status(workout_id, athlete_id)
    and status = 'done'
  )
);

drop policy if exists "update own athlete workout statuses" on public.athlete_workout_statuses;
create policy "update own athlete workout statuses" on public.athlete_workout_statuses for update to authenticated using (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_mark_workout_status(workout_id, athlete_id)
  )
) with check (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_mark_workout_status(workout_id, athlete_id)
    and status = 'done'
  )
);

drop policy if exists "delete own athlete workout statuses" on public.athlete_workout_statuses;
create policy "delete own athlete workout statuses" on public.athlete_workout_statuses for delete to authenticated using (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);

create or replace function public.set_athlete_workout_status(
  p_workout_id uuid,
  p_status text,
  p_notes text default null,
  p_marked_on date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_status text;
  v_id uuid;
begin
  select id into v_athlete_id
  from public.athletes
  where auth_user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by created_at desc
  limit 1;

  if v_athlete_id is null then
    raise exception 'Athlete profile not found.';
  end if;
  if p_workout_id is null then
    raise exception 'Workout is required.';
  end if;
  v_status := lower(trim(coalesce(p_status, '')));
  if v_status <> 'done' then
    raise exception 'Status must be done.';
  end if;
  if not public.can_mark_workout_status(p_workout_id, v_athlete_id) then
    raise exception 'You cannot mark this workout status.';
  end if;

  insert into public.athlete_workout_statuses (athlete_id, auth_user_id, workout_id, status, notes, marked_on, updated_at)
  values (v_athlete_id, auth.uid(), p_workout_id, v_status, nullif(trim(coalesce(p_notes, '')), ''), coalesce(p_marked_on, current_date), now())
  on conflict (athlete_id, workout_id)
  do update set status = excluded.status, notes = excluded.notes, marked_on = excluded.marked_on, updated_at = now(), auth_user_id = excluded.auth_user_id
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.set_athlete_workout_status(uuid, text, text, date) to authenticated;

create or replace function public.clear_athlete_workout_status(p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
begin
  select id into v_athlete_id
  from public.athletes
  where auth_user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by created_at desc
  limit 1;

  if v_athlete_id is null then
    raise exception 'Athlete profile not found.';
  end if;
  if p_workout_id is null then
    raise exception 'Workout is required.';
  end if;
  if not public.can_mark_workout_status(p_workout_id, v_athlete_id) then
    raise exception 'You cannot clear this workout status.';
  end if;

  delete from public.athlete_workout_statuses
  where workout_id = p_workout_id
    and athlete_id = v_athlete_id;
end;
$$;

grant execute on function public.clear_athlete_workout_status(uuid) to authenticated;

create or replace function public.delete_athlete_self_workout(p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_allowed boolean;
begin
  select id into v_athlete_id
  from public.athletes
  where auth_user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by created_at desc
  limit 1;

  if v_athlete_id is null then
    raise exception 'Athlete profile not found.';
  end if;

  select exists (
    select 1
    from public.workouts w
    join public.workout_assignments wa on wa.workout_id = w.id
    where w.id = p_workout_id
      and wa.athlete_id = v_athlete_id
      and coalesce(w.assignment_type, '') = 'athlete_created'
      and w.created_by = auth.uid()
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'Only your own athlete-created workouts can be deleted.';
  end if;

  delete from public.workouts where id = p_workout_id;
end;
$$;

grant execute on function public.delete_athlete_self_workout(uuid) to authenticated;
