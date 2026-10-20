-- Geçtiklerimi otomatik sıfırlama süresi hesapta (gün; 0 = hiç, null = hiç seçilmedi). İstemci: js/eylemler.js, js/hesap.js
alter table public.user_state add column if not exists pass_reset integer
  check (pass_reset is null or pass_reset between 0 and 3650);
