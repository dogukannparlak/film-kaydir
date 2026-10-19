-- Kaydır: şifreli API anahtarları, kalıcı anonim ziyaretçi işareti, admin paneli istatistikleri.
-- Önceki göçler (kaydir_init, kaydir_tighten_grants, kaydir_size_limits, kaydir_visits) Supabase panelinde/MCP ile uygulandı.

-- 1) API anahtarları: istemcide AES-GCM ile şifrelenmiş kopya ({v, salt, iv, ct}). Düz metin sütunları
--    (tmdb_key, omdb_key) yeni istemci hep boşaltır; eski istemciler önbellekten düşünce kaldırılabilir.
alter table public.user_state add column if not exists keys_enc jsonb
  check (keys_enc is null or pg_column_size(keys_enc) <= 4096);

-- 2) Ziyaret: anonim kimlik cihazda kalıcı mı (rıza verildi) yoksa oturumluk mu. Kalıcı değilse
--    "geri dönen ziyaretçi" hesaplanamaz; bu sütunla istatistikte ayrılır.
alter table public.visits add column if not exists kept boolean not null default false;
create index if not exists visits_started_idx on public.visits (started_at);
create index if not exists visits_visitor_idx on public.visits (visitor, started_at);

drop function if exists public.visit_start(uuid, text, text, text, text, boolean);
create function public.visit_start(p_visitor uuid, p_path text, p_referrer text, p_device text, p_lang text,
                                   p_logged_in boolean, p_kept boolean default false)
returns table(id uuid, token uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.visits v where v.visitor = p_visitor and v.started_at > now() - interval '1 day') >= 200 then
    raise exception 'visit_limit';
  end if;
  return query insert into public.visits (visitor, path, referrer, device, lang, logged_in, kept)
    values (p_visitor, left(p_path, 200), left(p_referrer, 200),
            case when p_device in ('mobile', 'desktop') then p_device end, left(p_lang, 12),
            coalesce(p_logged_in, false), coalesce(p_kept, false))
    returning visits.id, visits.token;
end $$;
revoke all on function public.visit_start(uuid, text, text, text, text, boolean, boolean) from public;
grant execute on function public.visit_start(uuid, text, text, text, text, boolean, boolean) to anon, authenticated;

-- 3) Admin: yalnız bu tabloda olan hesaplar. Satırı panelden ya da SQL ile elle ekle:
--    insert into public.admins (user_id) select id from auth.users where email = '<senin e-postan>';
create table if not exists public.admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.admins enable row level security; -- politika yok: istemci okuyamaz, yalnız aşağıdaki fonksiyonlar

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Son p_days günün özeti (jsonb). Admin değilse hata.
create or replace function public.admin_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1);
  r jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  with v as (
    select *, extract(epoch from last_seen - started_at)::int as secs from public.visits where started_at >= since
  ),
  firsts as ( -- kalıcı kimliklerin ilk geliş zamanı (pencere öncesi dahil)
    select visitor, min(started_at) as first_at from public.visits where kept group by visitor
  )
  select jsonb_build_object(
    'since', since,
    'online', (select count(distinct visitor) from public.visits where last_seen > now() - interval '90 seconds'),
    'visits', (select count(*) from v),
    'visitors', (select count(distinct visitor) from v),
    'avg_secs', (select coalesce(round(avg(secs)), 0) from v),
    'median_secs', (select coalesce(percentile_cont(0.5) within group (order by secs), 0) from v),
    'kept_visitors', (select count(distinct visitor) from v where kept),
    'returning', (select count(distinct v.visitor) from v join firsts f using (visitor) where v.kept and f.first_at < since),
    'logged_in_share', (select coalesce(round(100.0 * avg(logged_in::int)), 0) from v),
    'daily', (select coalesce(jsonb_agg(d order by d->>'day'), '[]') from (
        select jsonb_build_object('day', to_char(g.day, 'YYYY-MM-DD'),
          'visits', count(v.id), 'visitors', count(distinct v.visitor), 'avg_secs', coalesce(round(avg(v.secs)), 0)) as d
        from generate_series(since, date_trunc('day', now()), interval '1 day') as g(day)
        left join v on date_trunc('day', v.started_at) = g.day group by g.day) x),
    'devices', (select coalesce(jsonb_object_agg(coalesce(device, '?'), n), '{}') from (select device, count(*) n from v group by device) x),
    'langs', (select coalesce(jsonb_agg(jsonb_build_object('k', lang, 'n', n) order by n desc), '[]') from (
        select coalesce(lang, '?') lang, count(*) n from v group by 1 order by 2 desc limit 8) x),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('k', ref, 'n', n) order by n desc), '[]') from (
        select coalesce(nullif(referrer, ''), '(doğrudan)') ref, count(*) n from v group by 1 order by 2 desc limit 10) x),
    'users', (select count(*) from auth.users),
    'users_new', (select count(*) from auth.users where created_at >= since),
    'users_active', (select count(distinct user_id) from public.items where updated_at >= since),
    'items', (select count(*) from public.items where not deleted)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats(int) from public;
grant execute on function public.admin_stats(int) to authenticated;
