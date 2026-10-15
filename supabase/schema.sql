-- Calvin Grounds database (Supabase: Postgres + PostGIS).
-- Run once in the Supabase SQL editor. Safe to re-run.

create extension if not exists postgis;

-- A named area of the grounds. One zone can be made of several drawn polygons (patches).
create table if not exists public.zone_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  area_type  text not null default 'other'
             check (area_type in ('lawn', 'garden', 'natural_reserve', 'path', 'wooded', 'other')),
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.zone_patches (
  id         uuid primary key default gen_random_uuid(),
  zone_id    uuid not null references public.zone_areas (id) on delete cascade,
  geom       geometry (Polygon, 4326) not null,
  created_at timestamptz not null default now()
);

create index if not exists zone_patches_zone_id_idx on public.zone_patches (zone_id);
create index if not exists zone_patches_geom_idx on public.zone_patches using gist (geom);

-- Maintenance work. entity_type/entity_id leave room for tasks on things other than zones.
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null default 'zone_area',
  entity_id     uuid not null,
  title         text not null,
  category      text not null default 'other'
                check (category in ('mowing', 'weeding', 'clearing', 'inspection', 'repair', 'other')),
  priority      smallint not null default 3 check (priority between 1 and 5),  -- 1 urgent ... 5 optional
  status        text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  due_date      date,
  interval_days integer check (interval_days > 0),  -- recurring: next task is created when this one is done
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists tasks_entity_idx on public.tasks (entity_type, entity_id);
create index if not exists tasks_status_idx on public.tasks (status, priority);

-- Zones with their patches as GeoJSON, in the shape the map expects:
-- [{ id, name, area_type, notes, patches: [{ id, geojson }] }]
create or replace function public.get_zone_areas()
returns json
language sql
stable
as $$
  select coalesce(json_agg(z order by z.name), '[]'::json)
  from (
    select
      a.id,
      a.name,
      a.area_type,
      a.notes,
      coalesce(
        (
          select json_agg(json_build_object('id', p.id, 'geojson', st_asgeojson(p.geom)::json) order by p.created_at)
          from public.zone_patches p
          where p.zone_id = a.id
        ),
        '[]'::json
      ) as patches
    from public.zone_areas a
  ) z;
$$;

-- Create a zone from its first drawn polygon; returns the new zone id.
create or replace function public.create_zone_area(p_name text, p_area_type text, p_geojson json)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.zone_areas (name, area_type)
  values (p_name, p_area_type)
  returning id into new_id;

  insert into public.zone_patches (zone_id, geom)
  values (new_id, st_setsrid(st_geomfromgeojson(p_geojson::text), 4326));

  return new_id;
end;
$$;

-- Add another polygon to an existing zone; returns the new patch id.
create or replace function public.add_zone_patch(p_zone_id uuid, p_geojson json)
returns uuid
language sql
as $$
  insert into public.zone_patches (zone_id, geom)
  values (p_zone_id, st_setsrid(st_geomfromgeojson(p_geojson::text), 4326))
  returning id;
$$;

-- Access. The app has no sign-in: the browser talks to Supabase with the anon key, so these
-- policies let anyone who has the project URL and anon key read and edit everything.
-- Add Supabase Auth and narrow these to `authenticated` before exposing the app publicly.
alter table public.zone_areas enable row level security;
alter table public.zone_patches enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "crew can do everything" on public.zone_areas;
create policy "crew can do everything" on public.zone_areas for all to anon, authenticated using (true) with check (true);

drop policy if exists "crew can do everything" on public.zone_patches;
create policy "crew can do everything" on public.zone_patches for all to anon, authenticated using (true) with check (true);

drop policy if exists "crew can do everything" on public.tasks;
create policy "crew can do everything" on public.tasks for all to anon, authenticated using (true) with check (true);
