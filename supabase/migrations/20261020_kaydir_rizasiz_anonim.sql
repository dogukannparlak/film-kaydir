-- Kaydır: rıza verisinin anonim toplamları (kişisel veri yok). Uygulandı 2026-10-20 (kaydir_rizasiz_anonim).
-- Rıza vermeyen (bantı yok sayan ya da reddeden) ziyaretçiyi kimlik veya cihaz kaydı olmadan YALNIZ SAYAR:
-- tek satırlık sayaç tablosu; kimlik, IP, sayfa yolu ya da zamanla eşleştirilebilir kayıt içermez
-- → kişisel veri olmadığından KVKK/GDPR kapsamı dışı (anonim veri), saklama silme hakkı gerektirmez.
-- - anon_bump: bant gösterildi / ilk seçim (kabul, reddet, kısmi) / rızasız sayfa yüklemesi
-- - admin_anon_stats: toplamları yalnız admin okur
-- İstemciden çağrılır (js/riza.js › anonBump). Rıza sonrası ziyaret/etkinlik sayımı zaten visits/events'te olur.

create table if not exists public.stats_anon (
  id boolean primary key default true check (id), -- tek satır
  shown bigint not null default 0,  -- rıza bandının gösterilme sayısı
  accept bigint not null default 0, -- ilk seçim: ikisini de açtı
  reject bigint not null default 0, -- ilk seçim: ikisini de kapattı
  pick bigint not null default 0,   -- ilk seçim: kısmi (birini açtı, birini kapatı)
  visit bigint not null default 0,  -- rızasız sayfa yüklemesi (kimliksiz)
  updated_at timestamptz not null default now()
);
insert into public.stats_anon (id) values (true) on conflict (id) do nothing;
alter table public.stats_anon enable row level security; -- politika yok: okuma/yazma yalnız aşağıdaki fonksiyonlardan

create or replace function public.anon_bump(p_kind text)
returns void language sql security definer set search_path = ''
as $$
  update public.stats_anon set
    shown  = least(shown  + (p_kind = 'shown')::int,  1000000000),
    accept = least(accept + (p_kind = 'accept')::int, 1000000000),
    reject = least(reject + (p_kind = 'reject')::int, 1000000000),
    pick   = least(pick   + (p_kind = 'pick')::int,   1000000000),
    visit  = least(visit  + (p_kind = 'visit')::int,  1000000000),
    updated_at = now()
  where id and p_kind in ('shown', 'accept', 'reject', 'pick', 'visit');
$$;
revoke all on function public.anon_bump(text) from public;
grant execute on function public.anon_bump(text) to anon, authenticated; -- rızasız ziyaretçi de sayabilmeli

-- Admin: anonim toplamları oku
create or replace function public.admin_anon_stats()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select to_jsonb(s) - 'id' - 'updated_at' from public.stats_anon s);
end $$;
revoke all on function public.admin_anon_stats() from public, anon;
grant execute on function public.admin_anon_stats() to authenticated;
