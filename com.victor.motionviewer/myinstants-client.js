/* User-initiated Myinstants adapter; no unofficial API servers, batch crawling or login. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AltoMyinstantsClient = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var SITE = 'https://www.myinstants.com';
  var MAX_HTML = 2 * 1024 * 1024;
  var MAX_MP3 = 24 * 1024 * 1024;
  function decode(value) {
    return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (whole, code) {
      var c = code.toLowerCase();
      if (c === 'amp') return '&';
      if (c === 'lt') return '<';
      if (c === 'gt') return '>';
      if (c === 'quot') return '"';
      if (c === 'apos') return "'";
      if (c === 'nbsp') return ' ';
      var n = c.slice(0, 2) === '#x' ? parseInt(c.slice(2), 16) : c[0] === '#' ? parseInt(c.slice(1), 10) : NaN;
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    });
  }
  function attr(markup, name) {
    var match = new RegExp('\\b' + name + '\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1', 'i').exec(markup);
    return match ? decode(match[2]) : '';
  }
  function safeUrl(value, type) {
    var URLClass = require('url').URL;
    var u = new URLClass(String(value || ''), SITE);
    if (u.protocol !== 'https:' || u.username || u.password || u.hostname !== 'www.myinstants.com' || u.port) throw Error('Unexpected Myinstants URL');
    if (type === 'mp3' && (!/^\/media\/sounds\/[^?#]+\.mp3$/i.test(u.pathname) || u.search)) throw Error('Unexpected audio path');
    if (type === 'search' && u.pathname !== '/en/search/') throw Error('Unexpected search path');
    return u.toString();
  }
  function searchUrl(query) {
    var q = String(query || '').trim();
    if (!q || q.length > 100) throw Error('Search must be 1–100 characters');
    return safeUrl(SITE + '/en/search/?name=' + encodeURIComponent(q), 'search');
  }
  function parseResults(html) {
    var result = [], used = new Set(), source = String(html || '');
    var start = /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\binstant\b[^"']*\1[^>]*>/gi, match, positions = [];
    while ((match = start.exec(source)) && positions.length < 120) positions.push({at:match.index,contentAt:start.lastIndex});
    for (var i=0;i<positions.length;i++) {
      var segment = source.slice(positions[i].contentAt, i+1 < positions.length ? positions[i+1].at : positions[i].contentAt + 6500);
      var link = /<a\b[^>]*\bclass\s*=\s*(["'])[^"']*\binstant-link\b[^"']*\1[^>]*>[\s\S]*?<\/a>/i.exec(segment);
      if (!link) continue;
      var href = attr(link[0], 'href');
      var title = decode(link[0].replace(/^<a\b[^>]*>/i, '').replace(/<\/a>[\s\S]*$/i, '').replace(/<[^>]*>/g, '').trim()).replace(/\s+/g, ' ').slice(0, 160);
      var play = /\bplay\(\s*['"]([^'"]+\.mp3)['"]\s*\)/i.exec(segment);
      if (!title || !play || !/^\/(?:en\/)?instant\/[^?#]+\/?$/.test(href)) continue;
      try {
        var mp3 = safeUrl(play[1], 'mp3');
        var page = safeUrl(href, 'page');
        if (!used.has(mp3)) { used.add(mp3); result.push({title:title,page:page,mp3:mp3}); }
      } catch (ignored) {}
      if (result.length >= 60) break;
    }
    return result;
  }
  function safeName(title) {
    return String(title || 'myinstants').replace(/[<>:"\/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim().slice(0, 92) || 'myinstants';
  }
  function requestBytes(address, kind, limit, redirects) {
    var https = require('https');
    var URLClass = require('url').URL;
    var target = safeUrl(address, kind);
    return new Promise(function (resolve, reject) {
      var u = new URLClass(target);
      var req = https.get(u, {
        headers: {'User-Agent':'ALTO-MemeSounds/1.0', 'Accept':kind==='search'?'text/html':'audio/mpeg, application/octet-stream', 'Accept-Encoding':'identity'},
        timeout:15000
      }, function (res) {
        var status = res.statusCode || 0;
        if ([301,302,303,307,308].indexOf(status) !== -1) {
          var next;
          try {next = safeUrl(new URLClass(res.headers.location, target).toString(), kind);}
          catch (e) {res.resume(); reject(e); return;}
          res.resume();
          if (redirects >= 3) {reject(Error('Too many redirects')); return;}
          requestBytes(next, kind, limit, redirects+1).then(resolve, reject);
          return;
        }
        if (status !== 200) {res.resume();reject(Error('Myinstants HTTP '+status));return;}
        var mime = String(res.headers['content-type'] || '').toLowerCase();
        if (kind === 'search' && mime && mime.indexOf('text/html') < 0) {res.resume();reject(Error('Search did not return HTML'));return;}
        if (kind === 'mp3' && mime && !/audio\/|application\/octet-stream/.test(mime)) {res.resume();reject(Error('Not an MP3 response'));return;}
        var size=0, parts=[];
        res.on('data',function (chunk) {
          size += chunk.length;
          if (size > limit) {res.destroy(Error('File exceeds size limit'));return;}
          parts.push(chunk);
        });
        res.on('error',reject);
        res.on('end',function () {
          var buffer=Buffer.concat(parts);
          if (kind==='mp3' && !(buffer.length > 4 && (buffer.toString('ascii',0,3)==='ID3' || (buffer[0]===0xff && (buffer[1]&0xe0)===0xe0)))) {reject(Error('Download is not a valid MP3 stream'));return;}
          resolve(buffer);
        });
      });
      req.on('timeout', function(){req.destroy(Error('Myinstants request timed out'));});
      req.on('error',reject);
    });
  }
  async function search(query) {
    var bytes = await requestBytes(searchUrl(query), 'search', MAX_HTML, 0);
    var data = parseResults(bytes.toString('utf8'));
    if (!data.length) throw Error('No results found, or Myinstants changed its page layout');
    return data;
  }
  async function mp3(url) {return requestBytes(url, 'mp3', MAX_MP3, 0);}
  function save(buffer, folder, title) {
    var fs=require('fs'), path=require('path');
    if (!Buffer.isBuffer(buffer) || buffer.length<5) throw Error('MP3 data missing');
    var stat=fs.statSync(folder);
    if (!stat.isDirectory()) throw Error('Choose a valid destination folder');
    var base=safeName(title),dest='',fd;
    for(var i=0;i<1000;i++){
      dest=path.join(folder,base+(i?' ('+(i+1)+')':'')+'.mp3');
      try {fd=fs.openSync(dest,'wx');break;}catch(e){if(e.code!=='EEXIST')throw e;}
    }
    if(fd===undefined) throw Error('Too many files with this name');
    try {fs.writeFileSync(fd,buffer);fs.closeSync(fd);fd=undefined;}
    catch(e){if(fd!==undefined)try{fs.closeSync(fd);}catch(ignore){}try{fs.unlinkSync(dest);}catch(ignore){}throw e;}
    return dest;
  }
  return {search:search,parseResults:parseResults,mp3:mp3,save:save,safeUrl:safeUrl,searchUrl:searchUrl,safeName:safeName};
});
