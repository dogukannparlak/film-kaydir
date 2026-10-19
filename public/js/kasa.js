'use strict';
/* ================= Anahtar kasası (API anahtarlarını hesapta şifreli saklama) ================= */
// Ayarlar › "API anahtarlarını hesabımda sakla" açıksa anahtarlar buluta yalnız şifreli gider (user_state.keys_enc).
// Şifreleme anahtarı hesap şifresinden tarayıcıda türetilir (PBKDF2-SHA256 → AES-GCM); şifre ve türetilen anahtar sunucuya hiç gitmez.
// Türetilen anahtar bu cihazda saklanır (kd_vault), böylece her açılışta şifre sorulmaz; çıkışta silinir.
// Kapalıysa anahtarlar yalnız bu cihazda kalır. Şifre sıfırlanırsa eski kopya açılamaz: anahtarlar yeniden girilir.
const VAULT_KEY = 'kd_vault';   // { user, salt, k } — k: türetilen AES anahtarı (base64)
const KDF_ROUNDS = 310000;
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let vault = store.get(VAULT_KEY, null);

async function deriveVault(user, password, salt) {
  salt = salt || b64(crypto.getRandomValues(new Uint8Array(16)));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:unb64(salt), iterations:KDF_ROUNDS }, base, 256);
  return { user, salt, k:b64(new Uint8Array(bits)) };
}
function setVault(v) { vault = v; v ? store.set(VAULT_KEY, v) : store.del(VAULT_KEY); }
const vaultFor = (user, salt) => vault && vault.user === user && (!salt || vault.salt === salt) ? vault : null;
const aesKey = v => crypto.subtle.importKey('raw', unb64(v.k), 'AES-GCM', false, ['encrypt', 'decrypt']);

// { tmdb, omdb } → { v, salt, iv, ct }
async function sealKeys(v, keys) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await aesKey(v), new TextEncoder().encode(JSON.stringify(keys)));
  return { v:1, salt:v.salt, iv:b64(iv), ct:b64(new Uint8Array(ct)) };
}
// Açılamazsa (yanlış şifre, şifre sıfırlanmış) null
async function openKeys(v, box) {
  try {
    const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(box.iv) }, await aesKey(v), unb64(box.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch { return null; }
}
