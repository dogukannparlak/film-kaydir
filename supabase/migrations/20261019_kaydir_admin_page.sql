-- Kaydır: yönetim sayfası (admin.html) için yalnız admin'e açık fonksiyonlar. Uygulandı 2026-10-19 (kaydir_admin_page).

-- Kullanıcı listesi: e-posta, kayıt/son giriş, öğe sayısı, anahtar kopyası var mı (içeriği değil)
create or replace function public.admin_users()
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean,
              items bigint, keys_saved boolean, last_change timestamptz, is_admin boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           (select count(*) from public.items i where i.user_id = u.id and not i.deleted),
           (select s.keys_enc is not null from public.user_state s where s.user_id = u.id),
           (select max(i.updated_at) from public.items i where i.user_id = u.id),
           exists (select 1 from public.admins a where a.user_id = u.id)
    from auth.users u order by u.created_at desc;
end $$;

-- Kullanıcıyı ve bütün verisini sil (kendini silemezsin)
create or replace function public.admin_delete_user(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_id = (select auth.uid()) then raise exception 'cannot_delete_self'; end if;
  delete from public.items where user_id = p_id;
  delete from public.user_state where user_id = p_id;
  delete from public.admins where user_id = p_id;
  delete from auth.users where id = p_id;
end $$;

-- Veritabanı: toplam boyut, tablo başına satır ve boyut
create or replace function public.admin_db()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (select jsonb_agg(jsonb_build_object('name', c.relname, 'rows', c.reltuples::bigint,
                 'bytes', pg_total_relation_size(c.oid)) order by pg_total_relation_size(c.oid) desc)
               from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r'));
end $$;

revoke all on function public.admin_users() from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
revoke all on function public.admin_db() from public, anon;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_db() to authenticated;

-- Rol atama (kaydir_admin_set_role, 2026-10-19): 'user' | 'admin'. Kendini düşüremezsin (panelden kilitlenme olmasın).
create or replace function public.admin_set_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_role not in ('user', 'admin') then raise exception 'bad_role'; end if;
  if p_id = (select auth.uid()) and p_role <> 'admin' then raise exception 'cannot_demote_self'; end if;
  if not exists (select 1 from auth.users where id = p_id) then raise exception 'no_user'; end if;
  if p_role = 'admin' then insert into public.admins (user_id) values (p_id) on conflict do nothing;
  else delete from public.admins where user_id = p_id; end if;
end $$;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
