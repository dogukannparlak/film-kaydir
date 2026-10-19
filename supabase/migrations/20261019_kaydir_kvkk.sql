-- Kaydır: KVKK / GDPR hakları ve saklama süreleri. Uygulandı 2026-10-19 (kaydir_kvkk).
-- - forget_visitor: bir cihazın (anonim kimlik) ziyaret ve etkinlik kayıtlarını siler (kimliği bilen = o cihaz; UUID tahmin edilemez)
-- - my_data: giriş yapmış kullanıcının bütün verisi (veri taşınabilirliği / erişim hakkı)
-- - delete_my_account: kullanıcı kendi hesabını ve bütün verisini siler (silme hakkı)
-- - visits 13 ay, events 90 gün saklanır (visit_start / log_events ara sıra eskileri siler)

create or replace function public.forget_visitor(p_visitor uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.events where visitor = p_visitor;
  delete from public.visits where visitor = p_visitor;
$$;
revoke all on function public.forget_visitor(uuid) from public;
grant execute on function public.forget_visitor(uuid) to anon, authenticated;

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
               from public.visits v where v.visitor in (select distinct e.visitor from public.events e where e.user_id = uid)),
    'is_admin', exists (select 1 from public.admins a where a.user_id = uid));
end $$;
revoke all on function public.my_data() from public, anon;
grant execute on function public.my_data() to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  delete from public.visits where visitor in (select distinct visitor from public.events where user_id = uid);
  delete from public.events where visitor in (select distinct visitor from public.events where user_id = uid);
  delete from public.events where user_id = uid;
  delete from public.items where user_id = uid;
  delete from public.user_state where user_id = uid;
  delete from public.admins where user_id = uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Admin silmesi de cihaz kayıtlarını silsin (önceden events'te user_id null kalıyordu)
create or replace function public.admin_delete_user(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_id = (select auth.uid()) then raise exception 'cannot_delete_self'; end if;
  delete from public.visits where visitor in (select distinct visitor from public.events where user_id = p_id);
  delete from public.events where visitor in (select distinct visitor from public.events where user_id = p_id);
  delete from public.items where user_id = p_id;
  delete from public.user_state where user_id = p_id;
  delete from public.admins where user_id = p_id;
  delete from auth.users where id = p_id;
end $$;

-- Ziyaretler 13 ay saklanır
create or replace function public.visit_start(p_visitor uuid, p_path text, p_referrer text, p_device text, p_lang text,
                                              p_logged_in boolean, p_kept boolean default false)
returns table(id uuid, token uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.visits v where v.visitor = p_visitor and v.started_at > now() - interval '1 day') >= 200 then
    raise exception 'visit_limit';
  end if;
  if random() < 0.01 then delete from public.visits where started_at < now() - interval '13 months'; end if;
  return query insert into public.visits (visitor, path, referrer, device, lang, logged_in, kept)
    values (p_visitor, left(p_path, 200), left(p_referrer, 200),
            case when p_device in ('mobile', 'desktop') then p_device end, left(p_lang, 12),
            coalesce(p_logged_in, false), coalesce(p_kept, false))
    returning visits.id, visits.token;
end $$;
