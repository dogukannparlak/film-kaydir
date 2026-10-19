-- Kaydır: etkinlik günlüğü (kullanıcının sitede yaptığı her şey + tarayıcı hataları). Uygulandı 2026-10-19 (kaydir_events).
-- Girişsiz ziyaretçi de kaydedilir (anonim visitor kimliğiyle, e-postasız). user_id istemciden değil auth.uid()'den gelir.
-- Saklama: 90 gün (log_events eskileri ara sıra siler).
create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor uuid not null,
  user_id uuid references auth.users on delete set null,
  kind text not null check (length(kind) <= 32),
  data jsonb check (data is null or pg_column_size(data) <= 2048),
  path text check (length(path) <= 200)
);
create index if not exists events_at_idx on public.events (at desc);
create index if not exists events_visitor_idx on public.events (visitor, at desc);
create index if not exists events_user_idx on public.events (user_id, at desc);
create index if not exists events_kind_idx on public.events (kind, at desc);
alter table public.events enable row level security; -- politika yok: yalnız aşağıdaki fonksiyonlar

-- İstemci toplu gönderir: [{ kind, data, at? }], en çok 50; ziyaretçi başına saatte en çok 1000 olay
create or replace function public.log_events(p_visitor uuid, p_events jsonb, p_path text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if jsonb_typeof(p_events) <> 'array' then return; end if;
  if (select count(*) from public.events e where e.visitor = p_visitor and e.at > now() - interval '1 hour') >= 1000 then return; end if;
  insert into public.events (at, visitor, user_id, kind, data, path)
  select least(now(), greatest(now() - interval '1 day', coalesce((x->>'at')::timestamptz, now()))),
         p_visitor, (select auth.uid()), left(x->>'kind', 32),
         case when pg_column_size(x->'data') <= 2048 then x->'data' else jsonb_build_object('truncated', true) end,
         left(p_path, 200)
  from jsonb_array_elements(p_events) with ordinality as t(x, i)
  where i <= 50 and x ? 'kind';
  if random() < 0.01 then delete from public.events where at < now() - interval '90 days'; end if;
exception when others then return; -- günlük siteyi asla bozmasın (bozuk tarih vb.)
end $$;
revoke all on function public.log_events(uuid, jsonb, text) from public;
grant execute on function public.log_events(uuid, jsonb, text) to anon, authenticated;

-- Admin: olay akışı (filtreli). p_q: e-posta, olay türü ya da veri içinde geçen metin
create or replace function public.admin_events(p_user uuid default null, p_visitor uuid default null, p_kind text default null,
                                               p_q text default null, p_limit int default 200, p_before timestamptz default null)
returns table(id bigint, at timestamptz, visitor uuid, user_id uuid, email text, kind text, data jsonb, path text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select e.id, e.at, e.visitor, e.user_id, u.email::text, e.kind, e.data, e.path
    from public.events e left join auth.users u on u.id = e.user_id
    where (p_user is null or e.user_id = p_user)
      and (p_visitor is null or e.visitor = p_visitor)
      and (p_kind is null or e.kind = p_kind)
      and (p_before is null or e.at < p_before)
      and (p_q is null or u.email ilike '%' || p_q || '%' or e.kind ilike '%' || p_q || '%' or e.data::text ilike '%' || p_q || '%'
           or e.visitor::text like p_q || '%')
    order by e.at desc limit least(greatest(p_limit, 1), 1000);
end $$;

-- Admin: ziyaretçiler (anonim dahil): ilk/son görülme, olay ve ziyaret sayısı, bağlandığı hesap
create or replace function public.admin_visitors(p_days int default 30, p_q text default null)
returns table(visitor uuid, first_at timestamptz, last_at timestamptz, events bigint, visits bigint, seconds bigint,
              user_id uuid, email text, device text, lang text)
language plpgsql stable security definer set search_path = ''
as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    with v as (select vi.visitor, min(vi.started_at) f, max(vi.last_seen) l, count(*) n,
                      sum(extract(epoch from vi.last_seen - vi.started_at))::bigint s,
                      (array_agg(vi.device order by vi.started_at desc))[1] d, (array_agg(vi.lang order by vi.started_at desc))[1] lg
               from public.visits vi where vi.last_seen >= since group by vi.visitor),
         e as (select ev.visitor, count(*) n, min(ev.at) f, max(ev.at) l,
                      (array_agg(ev.user_id order by ev.at desc) filter (where ev.user_id is not null))[1] uid
               from public.events ev where ev.at >= since group by ev.visitor)
    select coalesce(v.visitor, e.visitor), least(v.f, e.f), greatest(v.l, e.l), coalesce(e.n, 0), coalesce(v.n, 0), coalesce(v.s, 0),
           e.uid, u.email::text, v.d, v.lg
    from v full join e on e.visitor = v.visitor left join auth.users u on u.id = e.uid
    where p_q is null or u.email ilike '%' || p_q || '%' or coalesce(v.visitor, e.visitor)::text like p_q || '%'
    order by greatest(v.l, e.l) desc nulls last limit 500;
end $$;

-- Admin: hatalar, mesaja göre gruplu
create or replace function public.admin_errors(p_days int default 7)
returns table(message text, count bigint, visitors bigint, users bigint, first_at timestamptz, last_at timestamptz, sample jsonb)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select coalesce(e.data->>'msg', '?'), count(*), count(distinct e.visitor), count(distinct e.user_id), min(e.at), max(e.at),
           (array_agg(e.data || jsonb_build_object('path', e.path) order by e.at desc))[1]
    from public.events e
    where e.kind = 'error' and e.at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
    group by 1 order by max(e.at) desc limit 200;
end $$;

-- Admin: olay türü sayıları (günlük grafik ve filtre listesi için)
create or replace function public.admin_event_kinds(p_days int default 30)
returns table(kind text, count bigint) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query select e.kind, count(*) from public.events e
    where e.at >= now() - make_interval(days => greatest(1, least(p_days, 365))) group by 1 order by 2 desc;
end $$;

revoke all on function public.admin_events(uuid, uuid, text, text, int, timestamptz) from public, anon;
revoke all on function public.admin_visitors(int, text) from public, anon;
revoke all on function public.admin_errors(int) from public, anon;
revoke all on function public.admin_event_kinds(int) from public, anon;
grant execute on function public.admin_events(uuid, uuid, text, text, int, timestamptz) to authenticated;
grant execute on function public.admin_visitors(int, text) to authenticated;
grant execute on function public.admin_errors(int) to authenticated;
grant execute on function public.admin_event_kinds(int) to authenticated;
