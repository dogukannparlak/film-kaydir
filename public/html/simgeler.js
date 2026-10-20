'use strict';
// Simge seti (A · çizgi, bilet logosuyla aynı dil): bir kez gömülür, her yerde <svg class="i"><use href="#i-ad"/></svg>.
// Kaynak ve önizleme: docs/simgeler.html. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
<symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="M10.3 3.6a1.8 1.8 0 0 1 3.4 0l.3.9a1.8 1.8 0 0 0 2.5 1l.8-.4a1.8 1.8 0 0 1 2.4 2.4l-.4.8a1.8 1.8 0 0 0 1 2.5l.9.3a1.8 1.8 0 0 1 0 3.4l-.9.3a1.8 1.8 0 0 0-1 2.5l.4.8a1.8 1.8 0 0 1-2.4 2.4l-.8-.4a1.8 1.8 0 0 0-2.5 1l-.3.9a1.8 1.8 0 0 1-3.4 0l-.3-.9a1.8 1.8 0 0 0-2.5-1l-.8.4a1.8 1.8 0 0 1-2.4-2.4l.4-.8a1.8 1.8 0 0 0-1-2.5l-.9-.3a1.8 1.8 0 0 1 0-3.4l.9-.3a1.8 1.8 0 0 0 1-2.5l-.4-.8a1.8 1.8 0 0 1 2.4-2.4l.8.4a1.8 1.8 0 0 0 2.5-1z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></symbol>
<symbol id="i-pass" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke-width="2.6"/></symbol>
<symbol id="i-watched" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-want" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-9-9.6C2 7 4.3 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3 0 5.3 2.5 4.3 5.9-1.5 5-9 9.6-9 9.6z"/></symbol>
<symbol id="i-discover" viewBox="0 0 24 24"><rect x="3.5" y="5" width="9" height="13" rx="2" opacity=".55"/><g transform="rotate(12 15 12)"><rect x="9.5" y="4" width="10" height="15" rx="2.2"/><path d="M13.3 9.2v4.6l3.8-2.3z" fill="currentColor" stroke="none"/></g></symbol>
<symbol id="i-collection" viewBox="0 0 24 24"><path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16l-7.5 4.5V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M9 8.5h6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M9 7V4.5h6V7"/></symbol>
<symbol id="i-trailer" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3.5"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></symbol>
<symbol id="i-series" viewBox="0 0 24 24"><rect x="3" y="6" width="12" height="13" rx="2" opacity=".5"/><rect x="7" y="3" width="14" height="15" rx="2.2"/><path d="M10 6.5v8M18 6.5v8" stroke-dasharray="1.6 2.2"/></symbol>
<symbol id="i-watching" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/></symbol>
<symbol id="i-newseason" viewBox="0 0 24 24"><rect x="3" y="6.5" width="15" height="11" rx="2.5"/><path d="M8 20.5h5M7.5 3.5l3 3 3-3"/><path d="M20 3v4M18 5h4" stroke-width="1.8"/></symbol>
<symbol id="i-dropped" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-5.4-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.6-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></symbol>
<symbol id="i-director" viewBox="0 0 24 24"><rect x="3.5" y="10" width="17" height="10" rx="2"/><path d="m3.6 9.6 15.8-4.2-.9-3.2L2.7 6.4z"/><path d="m7 5.5 2.2 2.6M11.5 4.3l2.2 2.6"/></symbol>
<symbol id="i-upcoming" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 14.5h3"/></symbol>
<symbol id="i-sort" viewBox="0 0 24 24"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></symbol>
<symbol id="i-account" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></symbol>
<symbol id="i-cloud" viewBox="0 0 24 24"><path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.5A3.8 3.8 0 0 1 17.5 18.5z"/><path d="m9.5 13.5 2 2 3.5-3.5"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-eye-off" viewBox="0 0 24 24"><path d="m3.5 3.5 17 17M10.4 5.7c.5-.1 1-.2 1.6-.2 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.7M6.6 6.9A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.8-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6"/></symbol>
<symbol id="i-instagram" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01" stroke-width="2.6"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M4.5 4h4.2l10.8 16h-4.2zM19 4l-6 6.8M5 20l6-6.8"/></symbol>
<symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/></symbol>
<symbol id="i-import" viewBox="0 0 24 24"><path d="M12 3.5v11m0 0-4-4m4 4 4-4"/><path d="M4 15.5v3A2 2 0 0 0 6 20.5h12a2 2 0 0 0 2-2v-3"/></symbol>
<symbol id="i-ticket" viewBox="0 0 24 24"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v3.2a2.3 2.3 0 0 0 0 4.6v3.2A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-3.2a2.3 2.3 0 0 0 0-4.6V6.5A1.5 1.5 0 0 1 5 5z"/><path d="M10.5 9.3v5.4l4.3-2.7z" fill="currentColor"/></symbol>
<symbol id="i-popcorn" viewBox="0 0 24 24"><path d="M5.5 10h13l-1.6 10.2A1.5 1.5 0 0 1 15.4 21.5H8.6a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M10 10l.5 11.5M14 10l-.5 11.5"/><path d="M6 10a2.8 2.8 0 0 1 2.2-4.6A3.4 3.4 0 0 1 14.5 4a3 3 0 0 1 3.6 6"/></symbol>
<symbol id="i-guide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.2-2.5 3.6M12 16.8v.2"/></symbol>
<symbol id="i-export" viewBox="0 0 24 24"><path d="M12 15V3.5m0 0-4 4m4-4 4 4"/><path d="M4 15.5v3A2 2 0 0 0 6 20.5h12a2 2 0 0 0 2-2v-3"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></symbol>
<symbol id="i-github" viewBox="0 0 24 24"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v5.5c0 4.3 3 8 7 9.5 4-1.5 7-5.2 7-9.5V6z"/><path d="m9 12 2 2 4-4"/></symbol>
</defs></svg>
`);
