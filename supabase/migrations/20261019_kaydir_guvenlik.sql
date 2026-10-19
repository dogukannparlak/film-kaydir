-- Kaydır: güvenlik incelemesi düzeltmeleri. Uygulandı 2026-10-19 (kaydir_guvenlik).
-- 1) log_events / visit_start: ziyaretçi başına sınıra ek olarak genel sınır (herkes yeni UUID ile yazıp tabloyu şişiremesin).
-- 2) log_events p_with_user: rıza yoksa hata raporu hesapla eşleşmez (aydınlatma metni: "kimliksiz hata raporu").
-- 3) Silme ve dışa aktarma yalnız o hesaba ait satırlara dokunur: aynı tarayıcıyı paylaşan başka hesabın kayıtları gitmez.
--    Anonim satırlar (user_id null) ve ziyaretler yalnız o cihaz kimliğini başka hesap kullanmadıysa silinir/verilir.

drop function if exists public.log_events(uuid, jsonb, text);
create function public.log_events(p_visitor uuid, p_events jsonb, p_path text default null, p_with_user boolean default true)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if jsonb_typeof(p_events) <> 'array' then return; end if;
  if (select count(*) from public.events e where e.visitor = p_visitor and e.at > now() - interval '1 hour') >= 1000 then return; end if;
  if (select count(*) from public.events e where e.at > now() - interval '1 minute') >= 3000 then return; end if; -- genel sınır
  insert into public.events (at, visitor, user_id, kind, data, path)
  select least(now(), greatest(now() - interval '1 day', coalesce((x->>'at')::timestamptz, now()))),
         p_visitor, case when coalesce(p_with_user, true) then (select auth.uid()) end, left(x->>'kind', 32),
         case when pg_column_size(x->'data') <= 2048 then x->'data' else jsonb_build_object('truncated', true) end,
         left(p_path, 200)
  from jsonb_array_elements(p_events) with ordinality as t(x, i)
  where i <= 50 and x ? 'kind';
  if random() < 0.01 then delete from public.events where at < now() - interval '90 days'; end if;
exception when others then return;
end $$;
revoke all on function public.log_events(uuid, jsonb, text, boolean) from public;
grant execute on function public.log_events(uuid, jsonb, text, boolean) to anon, authenticated;

create or replace function public.visit_start(p_visitor uuid, p_path text, p_referrer text, p_device text, p_lang text,
                                              p_logged_in boolean, p_kept boolean default false)
returns table(id uuid, token uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.visits v where v.visitor = p_visitor and v.started_at > now() - interval '1 day') >= 200 then
    raise exception 'visit_limit';
  end if;
  if (select count(*) from public.visits v where v.started_at > now() - interval '1 minute') >= 600 then raise exception 'visit_limit'; end if;
  if random() < 0.01 then delete from public.visits where started_at < now() - interval '13 months'; end if;
  return query insert into public.visits (visitor, path, referrer, device, lang, logged_in, kept)
    values (p_visitor, left(p_path, 200), left(p_referrer, 200),
            case when p_device in ('mobile', 'desktop') then p_device end, left(p_lang, 12),
            coalesce(p_logged_in, false), coalesce(p_kept, false))
    returning visits.id, visits.token;
end $$;

-- Bir hesabın "yalnız kendisine ait" cihaz kimlikleri: başka hesabın olayı olmayan ziyaretçiler
create or replace function public._own_visitors(p_user uuid)
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select distinct e.visitor from public.events e
  where e.user_id = p_user
    and not exists (select 1 from public.events o where o.visitor = e.visitor and o.user_id is not null and o.user_id <> p_user)
$$;
revoke all on function public._own_visitors(uuid) from public, anon, authenticated;

create or replace function public._delete_account_data(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.visits where visitor in (select public._own_visitors(p_user));
  delete from public.events where user_id is null and visitor in (select public._own_visitors(p_user));
  delete from public.events where user_id = p_user;
  delete from public.items where user_id = p_user;
  delete from public.user_state where user_id = p_user;
  delete from public.admins where user_id = p_user;
  delete from auth.users where id = p_user;
end $$;
revoke all on function public._delete_account_data(uuid) from public, anon, authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  perform public._delete_account_data(uid);
end $$;

create or replace function public.admin_delete_user(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_id = (select auth.uid()) then raise exception 'cannot_delete_self'; end if;
  perform public._delete_account_data(p_id);
end $$;

create or replace function public.my_data()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at)
                from auth.users u where u.id = uid),
    'state', (select to_jsonb(s) - 'user_id' from public.user_state s where s.user_id = uid),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'data', i.data, 'deleted', i.deleted, 'updated_at', i.updated_at)), '[]')
              from public.items i where i.user_id = uid),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('at', e.at, 'kind', e.kind, 'data', e.data, 'path', e.path, 'visitor', e.visitor) order by e.at), '[]')
               from public.events e where e.user_id = uid),
    'visits', (select coalesce(jsonb_agg(jsonb_build_object('started_at', v.started_at, 'last_seen', v.last_seen, 'path', v.path,
                 'referrer', v.referrer, 'device', v.device, 'lang', v.lang) order by v.started_at), '[]')
               from public.visits v where v.visitor in (select public._own_visitors(uid))),
    'is_admin', exists (select 1 from public.admins a where a.user_id = uid));
end $$;

-- Doğrulandı (2026-10-19, canlı): admin_users gövdesinde is_admin() denetimi var; _own_visitors/_delete_account_data
-- anon ve authenticated'a kapalı (yalnız security definer fonksiyonlardan çağrılır); log_events'in tek sürümü var.
