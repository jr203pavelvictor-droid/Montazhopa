/* GIPHY client for ALTO meme inserts. Official API with the user's own key;
   search and downloads happen only on a click. Node https inside CEP. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AltoMemesClient = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var API = 'https://api.giphy.com/v1/gifs/search';
  var MAX_JSON = 4 * 1024 * 1024, MAX_MP4 = 40 * 1024 * 1024;
  // Emotion chips: Russian label, GIPHY query (English tags search best), YouTube query.
  var EMOTIONS = [
    ['Агрессия', 'angry', 'агрессия мем'], ['Недоумение', 'confused', 'недоумение мем'], ['Шок', 'shocked', 'шок мем'],
    ['Смех', 'laughing', 'смех мем'], ['Фейспалм', 'facepalm', 'фейспалм мем'], ['Грусть', 'sad', 'грустный мем'],
    ['Радость', 'happy dance', 'радость мем'], ['Страх', 'scared', 'страх мем'], ['Сарказм', 'sarcastic', 'сарказм мем'],
    ['Вау', 'wow', 'вау мем'], ['Неловко', 'awkward', 'неловкий момент мем'], ['Победа', 'victory', 'победа мем']
  ];
  function req(name) { return (typeof window !== 'undefined' && window.require ? window.require : require)(name); }
  function checkKey(key) {
    var k = String(key || '').trim();
    if (!/^[A-Za-z0-9]{16,64}$/.test(k)) throw Error('MZ_GIPHY_KEY');
    return k;
  }
  function safeMedia(value) {
    var URLClass = req('url').URL, u = new URLClass(String(value || ''));
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !/(^|\.)giphy\.com$/i.test(u.hostname) || !/\.mp4$/i.test(u.pathname)) throw Error('Unexpected GIPHY media URL');
    return u.toString();
  }
  function searchUrl(query, key, options) {
    options = options || {};
    var q = String(query || '').trim();
    if (!q || q.length > 50) throw Error('Запрос должен быть от 1 до 50 символов');
    var p = new (req('url').URLSearchParams)({ api_key: checkKey(key), q: q, limit: String(Math.max(1, Math.min(50, options.limit || 24))), offset: String(Math.max(0, Math.min(499, options.offset || 0))), rating: options.rating || 'pg-13', lang: options.lang || 'ru' });
    return API + '?' + p.toString();
  }
  function parse(json) {
    var data = typeof json === 'string' ? JSON.parse(json) : json, out = [], used = {};
    var rows = data && Array.isArray(data.data) ? data.data : [];
    for (var i = 0; i < rows.length && out.length < 50; i++) {
      var g = rows[i], img = g && g.images || {}, preview = img.fixed_width || img.preview || img.fixed_height || {}, full = img.original || img.original_mp4 || {};
      try {
        var item = { id: String(g.id || ''), title: String(g.title || 'GIPHY').replace(/\s+GIF(\s+by\s+.*)?$/i, '').trim().slice(0, 120) || 'GIPHY', preview: safeMedia(preview.mp4), mp4: safeMedia(full.mp4 || preview.mp4), width: Number(full.width) || 0, height: Number(full.height) || 0, page: String(g.url || '') };
        if (!/^[A-Za-z0-9]{5,40}$/.test(item.id) || used[item.id]) continue;
        used[item.id] = true; out.push(item);
      } catch (ignored) {}
    }
    return out;
  }
  function get(address, limit, kind) {
    var https = req('https'), URLClass = req('url').URL, u = new URLClass(address);
    if (kind === 'json' && (u.hostname !== 'api.giphy.com' || u.protocol !== 'https:')) return Promise.reject(Error('Unexpected GIPHY API URL'));
    if (kind === 'mp4') safeMedia(address);
    return new Promise(function (resolve, reject) {
      var request = https.get(u, { headers: { 'User-Agent': 'ALTO-Memes/1.0', 'Accept': kind === 'json' ? 'application/json' : 'video/mp4' }, timeout: 20000 }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && kind === 'mp4') { res.resume(); try { resolve(get(new URLClass(res.headers.location, u).toString(), limit, kind)); } catch (e) { reject(e); } return; }
        if (res.statusCode === 401 || res.statusCode === 403) { res.resume(); reject(Error('MZ_GIPHY_KEY')); return; }
        if (res.statusCode === 429) { res.resume(); reject(Error('MZ_GIPHY_LIMIT')); return; }
        if (res.statusCode !== 200) { res.resume(); reject(Error('GIPHY HTTP ' + res.statusCode)); return; }
        var parts = [], size = 0;
        res.on('data', function (chunk) { size += chunk.length; if (size > limit) { request.destroy(Error('GIPHY response is too large')); return; } parts.push(chunk); });
        res.on('end', function () { resolve(Buffer.concat(parts)); }); res.on('error', reject);
      });
      request.on('timeout', function () { request.destroy(Error('GIPHY не ответил за 20 секунд')); });
      request.on('error', reject);
    });
  }
  function search(query, key, options) {
    return get(searchUrl(query, key, options), MAX_JSON, 'json').then(function (bytes) { return parse(bytes.toString('utf8')); });
  }
  function safeName(title) {
    return String(title || 'meme').replace(/[<>:"\/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim().slice(0, 80) || 'meme';
  }
  function save(bytes, folder, title, id) {
    var fs = req('fs'), path = req('path');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    if (!bytes || bytes.length < 1000 || String(bytes.slice(4, 8)) !== 'ftyp') throw Error('GIPHY вернул не MP4');
    var base = safeName(title) + (id ? ' ' + String(id).slice(0, 12) : ''), file = path.join(folder, base + '.mp4'), n = 2;
    while (fs.existsSync(file)) file = path.join(folder, base + ' (' + (n++) + ').mp4');
    fs.writeFileSync(file, bytes, { flag: 'wx' });
    return file;
  }
  function download(item, folder) {
    return get(safeMedia(item.mp4), MAX_MP4, 'mp4').then(function (bytes) { return save(bytes, folder, item.title, item.id); });
  }
  return { EMOTIONS: EMOTIONS, searchUrl: searchUrl, parse: parse, search: search, download: download, save: save, safeMedia: safeMedia, safeName: safeName };
});
