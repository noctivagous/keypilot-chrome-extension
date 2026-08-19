/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on 2026-08-19T04:39:38.035Z
 */

var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../node_modules/mdurl/index.mjs
var mdurl_exports = {};
__export(mdurl_exports, {
  decode: () => decode_default,
  encode: () => encode_default,
  format: () => format,
  parse: () => parse_default
});

// ../node_modules/mdurl/lib/decode.mjs
var decodeCache = {};
function getDecodeCache(exclude) {
  let cache = decodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = decodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache.push(ch);
  }
  for (let i = 0; i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
  }
  return cache;
}
function decode(string, exclude) {
  if (typeof exclude !== "string") {
    exclude = decode.defaultChars;
  }
  const cache = getDecodeCache(exclude);
  return string.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
    let result = "";
    for (let i = 0, l = seq.length; i < l; i += 3) {
      const b1 = parseInt(seq.slice(i + 1, i + 3), 16);
      if (b1 < 128) {
        result += cache[b1];
        continue;
      }
      if ((b1 & 224) === 192 && i + 3 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        if ((b2 & 192) === 128) {
          const chr = b1 << 6 & 1984 | b2 & 63;
          if (chr < 128) {
            result += "\uFFFD\uFFFD";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 3;
          continue;
        }
      }
      if ((b1 & 240) === 224 && i + 6 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128) {
          const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
          if (chr < 2048 || chr >= 55296 && chr <= 57343) {
            result += "\uFFFD\uFFFD\uFFFD";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 6;
          continue;
        }
      }
      if ((b1 & 248) === 240 && i + 9 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq.slice(i + 10, i + 12), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
          let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
          if (chr < 65536 || chr > 1114111) {
            result += "\uFFFD\uFFFD\uFFFD\uFFFD";
          } else {
            chr -= 65536;
            result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
          }
          i += 9;
          continue;
        }
      }
      result += "\uFFFD";
    }
    return result;
  });
}
decode.defaultChars = ";/?:@&=+$,#";
decode.componentChars = "";
var decode_default = decode;

// ../node_modules/mdurl/lib/encode.mjs
var encodeCache = {};
function getEncodeCache(exclude) {
  let cache = encodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = encodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    if (/^[0-9a-z]$/i.test(ch)) {
      cache.push(ch);
    } else {
      cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
    }
  }
  for (let i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }
  return cache;
}
function encode(string, exclude, keepEscaped) {
  if (typeof exclude !== "string") {
    keepEscaped = exclude;
    exclude = encode.defaultChars;
  }
  if (typeof keepEscaped === "undefined") {
    keepEscaped = true;
  }
  const cache = getEncodeCache(exclude);
  let result = "";
  for (let i = 0, l = string.length; i < l; i++) {
    const code2 = string.charCodeAt(i);
    if (keepEscaped && code2 === 37 && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue;
      }
    }
    if (code2 < 128) {
      result += cache[code2];
      continue;
    }
    if (code2 >= 55296 && code2 <= 57343) {
      if (code2 >= 55296 && code2 <= 56319 && i + 1 < l) {
        const nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 56320 && nextCode <= 57343) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue;
        }
      }
      result += "%EF%BF%BD";
      continue;
    }
    result += encodeURIComponent(string[i]);
  }
  return result;
}
encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";
var encode_default = encode;

// ../node_modules/mdurl/lib/format.mjs
function format(url) {
  let result = "";
  result += url.protocol || "";
  result += url.slashes ? "//" : "";
  result += url.auth ? url.auth + "@" : "";
  if (url.hostname && url.hostname.indexOf(":") !== -1) {
    result += "[" + url.hostname + "]";
  } else {
    result += url.hostname || "";
  }
  result += url.port ? ":" + url.port : "";
  result += url.pathname || "";
  result += url.search || "";
  result += url.hash || "";
  return result;
}

// ../node_modules/mdurl/lib/parse.mjs
function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}
var protocolPattern = /^([a-z0-9.+-]+:)/i;
var portPattern = /:[0-9]*$/;
var simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
var delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
var unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
var autoEscape = ["'"].concat(unwise);
var nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
var hostEndingChars = ["/", "?", "#"];
var hostnameMaxLen = 255;
var hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
var hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
var hostlessProtocol = {
  javascript: true,
  "javascript:": true
};
var slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  "http:": true,
  "https:": true,
  "ftp:": true,
  "gopher:": true,
  "file:": true
};
function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url) return url;
  const u = new Url();
  u.parse(url, slashesDenoteHost);
  return u;
}
Url.prototype.parse = function(url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;
  rest = rest.trim();
  if (!slashesDenoteHost && url.split("#").length === 1) {
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }
  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === "//";
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }
  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
    let hostEnd = -1;
    for (let i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    let auth, atSign;
    if (hostEnd === -1) {
      atSign = rest.lastIndexOf("@");
    } else {
      atSign = rest.lastIndexOf("@", hostEnd);
    }
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }
    hostEnd = -1;
    for (let i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }
    if (rest[hostEnd - 1] === ":") {
      hostEnd--;
    }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);
    this.parseHost(host);
    this.hostname = this.hostname || "";
    const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length; i < l; i++) {
        const part = hostparts[i];
        if (!part) {
          continue;
        }
        if (!part.match(hostnamePartPattern)) {
          let newpart = "";
          for (let j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              newpart += "x";
            } else {
              newpart += part[j];
            }
          }
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join(".") + rest;
            }
            this.hostname = validParts.join(".");
            break;
          }
        }
      }
    }
    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = "";
    }
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf("?");
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) {
    this.pathname = rest;
  }
  if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
    this.pathname = "";
  }
  return this;
};
Url.prototype.parseHost = function(host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ":") {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) {
    this.hostname = host;
  }
};
var parse_default = urlParse;

// ../node_modules/uc.micro/build/index.mjs
var build_exports = {};
__export(build_exports, {
  Any: () => Any,
  Cc: () => Cc,
  Cf: () => Cf,
  P: () => P,
  S: () => S,
  Z: () => Z
});
var Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var Cc = /[\0-\x1F\x7F-\x9F]/;
var Cf = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
var P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B4E\u1B4F\u1B5A-\u1B60\u1B7D-\u1B7F\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDD6E\uDEAD\uDED0\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9\uDFD4\uDFD5\uDFD7\uDFD8]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09\uDFE1]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDD6D-\uDD6F\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD839\uDDFF|\uD83A[\uDD5E\uDD5F]/;
var S = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C1\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2429\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E5\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD803[\uDD8E\uDD8F\uDED1-\uDED8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDC00-\uDCEF\uDCFA-\uDCFC\uDD00-\uDEB3\uDEBA-\uDED0\uDEE0-\uDEF0\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED8\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0-\uDCBB\uDCC0\uDCC1\uDCD0-\uDCD8\uDD00-\uDE57\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE8A\uDE8E-\uDEC6\uDEC8\uDECD-\uDEDC\uDEDF-\uDEEA\uDEEF-\uDEF8\uDF00-\uDF92\uDF94-\uDFEF\uDFFA]/;
var Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

// ../node_modules/entities/dist/decode-codepoint.js
var decodeMap = /* @__PURE__ */ new Map([
  [0, 65533],
  // C1 Unicode control character reference replacements
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
]);
function replaceCodePoint(codePoint) {
  if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
    return 65533;
  }
  return decodeMap.get(codePoint) ?? codePoint;
}

// ../node_modules/entities/dist/internal/decode-shared.js
function decodeBase64(input) {
  const binary = atob(input);
  const evenLength = binary.length & ~1;
  const out = new Uint16Array(evenLength / 2);
  for (let index = 0, outIndex = 0; index < evenLength; index += 2) {
    const lo = binary.charCodeAt(index);
    const hi = binary.charCodeAt(index + 1);
    out[outIndex++] = lo | hi << 8;
  }
  return out;
}

// ../node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree = /* @__PURE__ */ decodeBase64("QR08ALkAAgH6AYsDNQR2BO0EPgXZBQEGLAbdBxMISQrvCmQLfQurDKQNLw4fD4YPpA+6D/IPAAAAAAAAAAAAAAAAKhBMEY8TmxUWF2EYLBkxGuAa3RsJHDscWR8YIC8jSCSIJcMl6ie3Ku8rEC0CLjoupS7kLgAIRU1hYmNmZ2xtbm9wcnN0dVQAWgBeAGUAaQBzAHcAfgCBAIQAhwCSAJoAoACsALMAbABpAGcAO4DGAMZAUAA7gCYAJkBjAHUAdABlADuAwQDBQHIiZXZlAAJhAAFpeW0AcgByAGMAO4DCAMJAEGRyAADgNdgE3XIAYQB2AGUAO4DAAMBA8CFoYZFj4SFjcgBhZAAAoFMqAAFncIsAjgBvAG4ABGFmAADgNdg43fAlbHlGdW5jdGlvbgCgYSBpAG4AZwA7gMUAxUAAAWNzpACoAHIAAOA12Jzc6SFnbgCgVCJpAGwAZABlADuAwwDDQG0AbAA7gMQAxEAABGFjZWZvcnN1xQDYANoA7QDxAPYA+QD8AAABY3LJAM8AayNzbGFzaAAAoBYidgHTANUAAKDnKmUAZAAAoAYjeQARZIABY3J0AOAA5QDrAGEidXNlAACgNSLuI291bGxpcwCgLCFhAJJjcgAA4DXYBd1wAGYAAOA12Dnd5SF2ZdhiYwDyAOoAbSJwZXEAAKBOIgAHSE9hY2RlZmhpbG9yc3UXARoBHwE6AVIBVQFiAWQBZgGCAakB6QHtAfIBYwB5ACdkUABZADuAqQCpQIABY3B5ACUBKAE1AfUhdGUGYWmg0iJ0KGFsRGlmZmVyZW50aWFsRAAAoEUhbCJleXMAAKAtIQACYWVpb0EBRAFKAU0B8iFvbgxhZABpAGwAO4DHAMdAcgBjAAhhbiJpbnQAAKAwIm8AdAAKYQABZG5ZAV0BaSJsbGEAuGB0I2VyRG90ALdg8gA5AWkAp2NyImNsZQAAAkRNUFRwAXQBeQF9AW8AdAAAoJkiaSJudXMAAKCWIuwhdXMAoJUiaSJtZXMAAKCXIm8AAAFjc4cBlAFrKndpc2VDb250b3VySW50ZWdyYWwAAKAyImUjQ3VybHkAAAFEUZwBpAFvJXVibGVRdW90ZQAAoB0gdSJvdGUAAKAZIAACbG5wdbABtgHNAdgBbwBuAGWgNyIAoHQqgAFnaXQAvAHBAcUB8iJ1ZW50AKBhIm4AdAAAoC8i7yV1ckludGVncmFsAKAuIgABZnLRAdMBAKACIe8iZHVjdACgECJuLnRlckNsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbAAAoDMi7yFzcwCgLypjAHIAAOA12J7ccABDoNMiYQBwAACgTSKABURKU1phY2VmaW9zAAsCEgIVAhgCGwIsAjQCOQI9AnMCfwNvoEUh9CJyYWhkAKARKWMAeQACZGMAeQAFZGMAeQAPZIABZ3JzACECJQIoAuchZXIAoCEgcgAAoKEhaAB2AACg5CoAAWF5MAIzAvIhb24OYRRkbAB0oAciYQCUY3IAAOA12AfdAAFhZkECawIAAWNtRQJnAvIjaXRpY2FsAAJBREdUUAJUAl8CYwJjInV0ZQC0YG8AdAFZAloC2WJiJGxlQWN1dGUA3WJyImF2ZQBgYGkibGRlANxi7yFuZACgxCJmJWVyZW50aWFsRAAAoEYhcAR9AgAAAAAAAIECjgIAABoDZgAA4DXYO91EoagAhQKJAm8AdAAAoNwgcSJ1YWwAAKBQIuIhbGUAA0NETFJVVpkCqAK1Au8C/wIRA28AbgB0AG8AdQByAEkAbgB0AGUAZwByAGEA7ADEAW8AdAKvAgAAAACwAqhgbiNBcnJvdwAAoNMhAAFlb7kC0AJmAHQAgAFBUlQAwQLGAs0CciJyb3cAAKDQIekkZ2h0QXJyb3cAoNQhZQDlACsCbgBnAAABTFLWAugC5SFmdAABQVLcAuECciJyb3cAAKD4J+kkZ2h0QXJyb3cAoPon6SRnaHRBcnJvdwCg+SdpImdodAAAAUFU9gL7AnIicm93AACg0iFlAGUAAKCoInAAQQIGAwAAAAALA3Iicm93AACg0SFvJHduQXJyb3cAAKDVIWUlcnRpY2FsQmFyAACgJSJuAAADQUJMUlRhJAM2AzoDWgNxA3oDciJyb3cAAKGTIUJVLAMwA2EAcgAAoBMpcCNBcnJvdwAAoPUhciJldmUAEWPlIWZ00gJDAwAASwMAAFIDaSVnaHRWZWN0b3IAAKBQKWUkZVZlY3RvcgAAoF4p5SJjdG9yQqC9IWEAcgAAoFYpaSJnaHQA1AFiAwAAaQNlJGVWZWN0b3IAAKBfKeUiY3RvckKgwSFhAHIAAKBXKWUAZQBBoKQiciJyb3cAAKCnIXIAcgBvAPcAtAIAAWN0gwOHA3IA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YwAAoN8i4SFycnCgtiEAoD0pgKIqImJjZG9zACsVMBU6FT4VQRVyImNhcAAAoEgqAAFhdTQVNxVwAACgRipwAACgSipvAHQAAKCNInIAAKBFKgDgKiIA/gACYWxydksVURVuFXMVcgByAG2gtyEAoDwpeQCAAWV2dwBYFWUVaRVxAHACXxUAAAAAYxVyAGUA4wAXFXUA4wAZFWUAZQAAoM4iZSJkZ2UAAKDPImUAbgA7gKQApEBlI2Fycm93AAABbHJ7FX8V5SFmdACgtiFpImdodAAAoLchZQDkAG0VAAFjaYsVkRVvAG4AaQBuAPQAkwFuAHQAAKAxImwiY3R5AACgLSOACUFIYWJjZGVmaGlqbG9yc3R1d3oAuBW7Fb8V1RXgFegV+RUKFhUWHxZUFlcWZRbFFtsW7xb7FgUXChdyAPIAtAJhAHIAAKBlKQACZ2xyc8YVyhXOFdAV5yFlcgCgICDlIXRoAKA4IfIA9QxoAHagECAAoKMiawHZFd4VYSJyb3cAAKAPKWEA4wBfAgABYXnkFecV8iFvbg9hNGQAoUYhYW/tFfQVAAFnciEC8RVyAACgyiF0InNlcQAAoHcqgAFnbG0A/xUCFgUWO4CwALBAdABhALRjcCJ0eXYAAKCxKQABaXIOFhIW8yFodACgfykA4DXYId1hAHIAAAFschsWHRYAoMMhAKDCIYACYWVnc3YAKBauAjYWOhY+Fm0AAKHEIm9zLhY0Fm4AZABzoMQi9SFpdACgZiZhIm1tYQDdY2kAbgAAoPIiAKH3AGlvQxZRFmQAZQAAgfcAO29KFksW90BuI3RpbWVzAACgxyJuAPgAUBZjAHkAUmRjAG8CXhYAAAAAYhZyAG4AAKAeI28AcAAAoA0jgAJscHR1dwBuFnEWdRaSFp4W7CFhciRgZgAA4DXYVd0AotkCZW1wc30WhBaJFo0WcQBkoFAibwB0AACgUSJpIm51cwAAoDgi7CF1cwCgFCLxInVhcmUAoKEiYgBsAGUAYgBhAHIAdwBlAGQAZwDlANcAbgCAAWFkaAClFqoWtBZyAHIAbwD3APUMbwB3AG4AYQByAHIAbwB3APMA8xVhI3Jwb29uAAABbHK8FsAWZQBmAPQAHBZpAGcAaAD0AB4WYgHJFs8WawBhAHIAbwD3AJILbwLUFgAAAADYFnIAbgAAoB8jbwBwAACgDCOAAWNvdADhFukW7BYAAXJ55RboFgDgNdi53FVkbAAAoPYp8iFvaxFhAAFkcvMW9xZvAHQAAKDxImkA5qC/JVsSAAFhaP8WAhdyAPIANQNhAPIA1wvhIm5nbGUAoKYpAAFjaQ4XEBd5AF9k5yJyYXJyAKD/JwAJRGFjZGVmZ2xtbm9wcXJzdHV4MRc4F0YXWxcyBF4XaRd5F40XrBe0F78X2RcVGCEYLRg1GEAYAAFEbzUXgRZvAPQA+BUAAWNzPBdCF3UAdABlADuA6QDpQPQhZXIAoG4qAAJhaW95TRdQF1YXWhfyIW9uG2FyAGOgViI7gOoA6kDsIW9uAKBVIk1kbwB0ABdhAAFEcmIXZhdvAHQAAKBSIgDgNdgi3XKhmipuF3QXYQB2AGUAO4DoAOhAZKCWKm8AdAAAoJgqgKGZKmlscwCAF4UXhxfuInRlcnMAoOcjAKATIWSglSpvAHQAAKCXKoABYXBzAJMXlheiF2MAcgATYXQAeQBzogUinxcAAAAAoRdlAHQAAKAFInAAMaADIDMBqRerFwCgBCAAoAUgAAFnc7AXsRdLYXAAAKACIAABZ3C4F7sXbwBuABlhZgAA4DXYVt2AAWFscwDFF8sXzxdyAHOg1SJsAACg4yl1AHMAAKBxKmkAAKG1A2x21RfYF28AbgC1Y/VjAAJjc3V24BfoF/0XEBgAAWlv5BdWF3IAYwAAoFYiaQLuFwAAAADwF+0ADQThIW50AAFnbPUX+Rd0AHIAAKCWKuUhc3MAoJUqgAFhZWkAAxgGGAoYbABzAD1gcwB0AACgXyJ2AESgYSJEAACgeCrwImFyc2wAoOUpAAFEYRkYHRhvAHQAAKBTInIAcgAAoHEpgAFjZGkAJxgqGO0XcgAAoC8hbwD0AIwCAAFhaDEYMhi3YzuA8ADwQAABbXI5GD0YbAA7gOsA60BvAACgrCCAAWNpcABGGEgYSxhsACFgcwD0ACwEAAFlb08YVxhjAHQAYQB0AGkAbwDuABoEbgBlAG4AdABpAGEAbADlADME4Ql1GAAAgRgAAIMYiBgAAAAAoRilGAAAqhgAALsYvhjRGAAA1xgnGWwAbABpAG4AZwBkAG8AdABzAGUA8QBlF3kARGRtImFsZQAAoEAmgAFpbHIAjRiRGJ0Y7CFpZwCgA/tpApcYAAAAAJoYZwAAoAD7aQBnAACgBPsA4DXYI93sIWlnAKAB++whaWcA4GYAagCAAWFsdACvGLIYthh0AACgbSZpAGcAAKAC+24AcwAAoLElbwBmAJJh8AHCGAAAxhhmAADgNdhX3QABYWvJGMwYbADsAGsEdqDUIgCg2SphI3J0aW50AACgDSoAAWFv2hgiGQABY3PeGB8ZsQPnGP0YBRkSGRUZAAAdGbID7xjyGPQY9xj5GAAA+xg7gL0AvUAAoFMhO4C8ALxAAKBVIQCgWSEAoFshswEBGQAAAxkAoFQhAKBWIbQCCxkOGQAAAAAQGTuAvgC+QACgVyEAoFwhNQAAoFghtgEZGQAAGxkAoFohAKBdITgAAKBeIWwAAKBEIHcAbgAAoCIjYwByAADgNdi73IAIRWFiY2RlZmdpamxub3JzdHYARhlKGVoZXhlmGWkZkhmWGZkZnRmgGa0ZxhnLGc8Z4BkjGmygZyIAoIwqgAFjbXAAUBlTGVgZ9SF0ZfVhbQBhAOSgswM6FgCghipyImV2ZQAfYQABaXliGWUZcgBjAB1hM2RvAHQAIWGAoWUibHFzAMYEcBl6GfGhZSLOBAAAdhlsAGEAbgD0AN8EgKF+KmNkbACBGYQZjBljAACgqSpvAHQAb6CAKmyggioAoIQqZeDbIgD+cwAAoJQqcgAA4DXYJN3noGsirATtIWVsAKA3IWMAeQBTZIChdyJFYWoApxmpGasZAKCSKgCgpSoAoKQqAAJFYWVztBm2Gb0ZwhkAoGkicABwoIoq8iFveACgiipxoIgq8aCIKrUZaQBtAACg5yJwAGYAAOA12FjdYQB2AOUAYwIAAWNp0xnWGXIAAKAKIW0AAKFzImVs3BneGQCgjioAoJAqAIM+ADtjZGxxco0E6xn0GfgZ/BkBGgABY2nvGfEZAKCnKnIAAKB6Km8AdAAAoNci0CFhcgCglSl1ImVzdAAAoHwqgAJhZGVscwAKGvQZFhrVBCAa8AEPGgAAFBpwAHIAbwD4AFkZcgAAoHgpcQAAAWxxxAQbGmwAZQBzAPMASRlpAO0A5AQAAWVuJxouGnIjdG5lcXEAAOBpIgD+xQAsGgAFQWFiY2Vma29zeUAaQxpmGmoabRqDGocalhrCGtMacgDyAMwCAAJpbG1yShpOGlAaVBpyAHMA8ABxD2YAvWBpAGwA9AASBQABZHJYGlsaYwB5AEpkAKGUIWN3YBpkGmkAcgAAoEgpAKCtIWEAcgAAoA8h6SFyYyVhgAFhbHIAcxp7Gn8a8iF0c3WgZSZpAHQAAKBlJuwhaXAAoCYg4yFvbgCguSJyAADgNdgl3XMAAAFld4wakRphInJvdwAAoCUpYSJyb3cAAKAmKYACYW1vcHIAnxqjGqcauhq+GnIAcgAAoP8h9CFodACgOyJrAAABbHKsGrMaZSRmdGFycm93AACgqSHpJGdodGFycm93AKCqIWYAAOA12Fnd4iFhcgCgFSCAAWNsdADIGswa0BpyAADgNdi93GEAcwDoAGka8iFvaydhAAFicNca2xr1IWxsAKBDIOghZW4AoBAg4Qr2GgAA/RoAAAgbExsaGwAAIRs7GwAAAAA+G2IbmRuVG6sbAACyG80b0htjAHUAdABlADuA7QDtQAChYyBpeQEbBhtyAGMAO4DuAO5AOGQAAWN4CxsNG3kANWRjAGwAO4ChAKFAAAFmcssCFhsA4DXYJt1yAGEAdgBlADuA7ADsQIChSCFpbm8AJxsyGzYbAAFpbisbLxtuAHQAAKAMKnQAAKAtIuYhaW4AoNwpdABhAACgKSHsIWlnM2GAAWFvcABDG1sbXhuAAWNndABJG0sbWRtyACthgAFlbHAAcQVRG1UbaQBuAOUAyAVhAHIA9AByBWgAMWFmAACgtyJlAGQAtWEAoggiY2ZvdGkbbRt1G3kb4SFyZQCgBSFpAG4AdKAeImkAZQAAoN0pZABvAPQAWxsAoisiY2VscIEbhRuPG5QbYQBsAACguiIAAWdyiRuNG2UAcgDzACMQ4wCCG2EicmhrAACgFyryIW9kAKA8KgACY2dwdJ8boRukG6gbeQBRZG8AbgAvYWYAAOA12FrdYQC5Y3UAZQBzAHQAO4C/AL9AAAFjabUbuRtyAADgNdi+3G4AAKIIIkVkc3bCG8QbyBvQAwCg+SJvAHQAAKD1Inag9CIAoPMiaaBiIOwhZGUpYesB1hsAANkbYwB5AFZkbAA7gO8A70AAA2NmbW9zdeYb7hvyG/Ub+hsFHAABaXnqG+0bcgBjADVhOWRyAADgNdgn3eEhdGg3YnAAZgAA4DXYW93jAf8bAAADHHIAAOA12L/c8iFjeVhk6yFjeVRkAARhY2ZnaGpvcxUcGhwiHCYcKhwtHDAcNRzwIXBhdqC6A/BjAAFleR4cIRzkIWls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ZmdobG1vcHJzdHV3CiwNLBEsHSwnLDEsQCxLLFIsYix6LIQsjyzLLOgs7Sz/LAotcgDyAAkDYQByAACgYykAAWNyFSwbLHUAdABlADuA+gD6QPIACQ1yAOMBIywAACUseQBeZHYAZQBtYQABaXkrLDAscgBjADuA+wD7QENkgAFhYmgANyw6LD0scgDyANEO7CFhY3FhYQDyAOAOAAFpckQsSCzzIWh0AKB+KQDgNdgy3XIAYQB2AGUAO4D5APlAYQFWLF8scgAAAWxyWixcLACgvyEAoL4hbABrAACggCUAAWN0Zix2LG8CbCwAAAAAcyxyAG4AZaAcI3IAAKAcI28AcAAAoA8jcgBpAACg+CUAAWFsfiyBLGMAcgBrYTuAqACoQAABZ3CILIssbwBuAHNhZgAA4DXYZt0AA2FkaGxzdZksniynLLgsuyzFLHIAcgBvAPcACQ1vAHcAbgBhAHIAcgBvAPcA2A5hI3Jwb29uAAABbHKvLLMsZQBmAPQAWyxpAGcAaAD0AF0sdQDzAKYOaQAAocUDaGzBLMIs0mNvAG4AxWPwI2Fycm93cwCgyCGAAWNpdADRLOEs5CxvAtcsAAAAAN4scgBuAGWgHSNyAACgHSNvAHAAAKAOI24AZwBvYXIAaQAAoPklYwByAADgNdjK3IABZGlyAPMs9yz6LG8AdAAAoPAi7CFkZWlhaQBmoLUlAKC0JQABYW0DLQYtcgDyAMosbAA7gPwA/EDhIm5nbGUAoKcpgAdBQkRhY2RlZmxub3Byc3oAJy0qLTAtNC2bLZ0toS2/LcMtxy3TLdgt3C3gLfwtcgDyABADYQByAHag6CoAoOkqYQBzAOgA/gIAAW5yOC08LechcnQAoJwpgANla25wcnN0AJkpSC1NLVQtXi1iLYItYQBwAHAA4QAaHG8AdABoAGkAbgDnAKEXgAFoaXIAoSmzJFotbwBwAPQAdCVooJUh7wD4JgABaXVmLWotZwBtAOEAuygAAWJwbi14LXMjZXRuZXEAceCKIgD+AODLKgD+cyNldG5lcQBx4IsiAP4A4MwqAP4AAWhyhi2KLWUAdADhABIraSNhbmdsZQAAAWxyki2WLeUhZnQAoLIiaSJnaHQAAKCzInkAMmThIXNoAKCiIoABZWxyAKcttC24LWKiKCKuLQAAAACyLWEAcgAAoLsicQAAoFoi7CFpcACg7iIAAWJ0vC1eD2EA8gBfD3IAAOA12DPddAByAOkAlS1zAHUAAAFicM0t0C0A4IIi0iAA4IMi0iBwAGYAAOA12GfdcgBvAPAAWQt0AHIA6QCaLQABY3XkLegtcgAA4DXYy9wAAWJw7C30LW4AAAFFZXUt8S0A4IoiAP5uAAABRWV/LfktAOCLIgD+6SJnemFnAKCaKYADY2Vmb3BycwANLhAuJS4pLiMuLi40LukhcmN1YQABZGkULiEuAAFiZxguHC5hAHIAAKBfKmUAcaAnIgCgWSLlIXJwAKAYIXIAAOA12DTdcABmAADgNdho3WWgQCJhAHQA6ABqD2MAcgAA4DXYzNzjCuQRUC4AAFQuAABYLmIuAAAAAGMubS5wLnQuAAAAAIguki4AAJouJxIqEnQAcgDpAB0ScgAA4DXYNd0AAUFhWy5eLnIA8gDnAnIA8gCTB75jAAFBYWYuaS5yAPIA4AJyAPIAjAdhAPAAeh5pAHMAAKD7IoABZHB0APgReS6DLgABZmx9LoAuAOA12GnddQDzAP8RaQBtAOUABBIAAUFhiy6OLnIA8gDuAnIA8gCaBwABY3GVLgoScgAA4DXYzdwAAXB0nS6hLmwAdQDzACUScgDpACASAARhY2VmaW9zdbEuvC7ELsguzC7PLtQu2S5jAAABdXm2LrsudABlADuA/QD9QE9kAAFpecAuwy5yAGMAd2FLZG4AO4ClAKVAcgAA4DXYNt1jAHkAV2RwAGYAAOA12GrdYwByAADgNdjO3AABY23dLt8ueQBOZGwAO4D/AP9AAAVhY2RlZmhpb3N38y73Lv8uAi8MLxAvEy8YLx0vIi9jInV0ZQB6YQABYXn7Lv4u8iFvbn5hN2RvAHQAfGEAAWV0Bi8KL3QAcgDmAB8QYQC2Y3IAAOA12DfdYwB5ADZk5yJyYXJyAKDdIXAAZgAA4DXYa91jAHIAAOA12M/cAAFqbiYvKC8AoA0gagAAoAwg");

// ../node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags;
(function(BinTrieFlags2) {
  BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags2[BinTrieFlags2["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
})(BinTrieFlags || (BinTrieFlags = {}));

// ../node_modules/entities/dist/decode.js
var CharCodes;
(function(CharCodes2) {
  CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
  CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
  CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
  CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
  CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
  CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
  CharCodes2[CharCodes2["LOWER_F"] = 102] = "LOWER_F";
  CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
  CharCodes2[CharCodes2["LOWER_Z"] = 122] = "LOWER_Z";
  CharCodes2[CharCodes2["UPPER_A"] = 65] = "UPPER_A";
  CharCodes2[CharCodes2["UPPER_F"] = 70] = "UPPER_F";
  CharCodes2[CharCodes2["UPPER_Z"] = 90] = "UPPER_Z";
})(CharCodes || (CharCodes = {}));
var TO_LOWER_BIT = 32;
function isNumber(code2) {
  return code2 >= CharCodes.ZERO && code2 <= CharCodes.NINE;
}
function isHexadecimalCharacter(code2) {
  return code2 >= CharCodes.UPPER_A && code2 <= CharCodes.UPPER_F || code2 >= CharCodes.LOWER_A && code2 <= CharCodes.LOWER_F;
}
function isAsciiAlphaNumeric(code2) {
  return code2 >= CharCodes.UPPER_A && code2 <= CharCodes.UPPER_Z || code2 >= CharCodes.LOWER_A && code2 <= CharCodes.LOWER_Z || isNumber(code2);
}
function isEntityInAttributeInvalidEnd(code2) {
  return code2 === CharCodes.EQUALS || isAsciiAlphaNumeric(code2);
}
var EntityDecoderState;
(function(EntityDecoderState2) {
  EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function(DecodingMode2) {
  DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
  DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
  DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
var EntityDecoder = class {
  decodeTree;
  emitCodePoint;
  errors;
  constructor(decodeTree, emitCodePoint, errors2) {
    this.decodeTree = decodeTree;
    this.emitCodePoint = emitCodePoint;
    this.errors = errors2;
  }
  /** The current state of the decoder. */
  state = EntityDecoderState.EntityStart;
  /** Characters that were consumed while parsing an entity. */
  consumed = 1;
  /**
   * The result of the entity.
   *
   * Either the result index of a numeric entity, or the codepoint of a
   * numeric entity.
   */
  result = 0;
  /** The current index in the decode tree. */
  treeIndex = 0;
  /** The number of characters that were consumed in excess. */
  excess = 1;
  /** The mode in which the decoder is operating. */
  decodeMode = DecodingMode.Strict;
  /** The number of characters that have been consumed in the current run. */
  runConsumed = 0;
  /**
   * Resets the instance to make it reusable.
   * @param decodeMode Entity decoding mode to use.
   */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = EntityDecoderState.EntityStart;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.consumed = 1;
    this.runConsumed = 0;
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   *
   * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
   * entity is incomplete, and resume when the next string is written.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes.NUM) {
          this.state = EntityDecoderState.NumericStart;
          this.consumed += 1;
          return this.stateNumericStart(input, offset + 1);
        }
        this.state = EntityDecoderState.NamedEntity;
        return this.stateNamedEntity(input, offset);
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset);
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset);
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset);
      }
      case EntityDecoderState.NamedEntity: {
        return this.stateNamedEntity(input, offset);
      }
    }
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
      this.state = EntityDecoderState.NumericHex;
      this.consumed += 1;
      return this.stateNumericHex(input, offset + 1);
    }
    this.state = EntityDecoderState.NumericDecimal;
    return this.stateNumericDecimal(input, offset);
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexademical character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset) {
    while (offset < input.length) {
      const char = input.charCodeAt(offset);
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        const digit = char <= CharCodes.NINE ? char - CharCodes.ZERO : (char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10;
        this.result = this.result * 16 + digit;
        this.consumed++;
        offset++;
      } else {
        return this.emitNumericEntity(char, 3);
      }
    }
    return -1;
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset) {
    while (offset < input.length) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        this.result = this.result * 10 + (char - CharCodes.ZERO);
        this.consumed++;
        offset++;
      } else {
        return this.emitNumericEntity(char, 2);
      }
    }
    return -1;
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexademical character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    if (this.consumed <= expectedLength) {
      this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CharCodes.SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CharCodes.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  /**
   * Parses a named entity.
   *
   * Equivalent to the `Named character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNamedEntity(input, offset) {
    const { decodeTree } = this;
    let current = decodeTree[this.treeIndex];
    let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
    while (offset < input.length) {
      if (valueLength === 0 && (current & BinTrieFlags.FLAG13) !== 0) {
        const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        if (this.runConsumed === 0) {
          const firstChar = current & BinTrieFlags.JUMP_TABLE;
          if (input.charCodeAt(offset) !== firstChar) {
            return this.result === 0 ? 0 : this.emitNotTerminatedNamedEntity();
          }
          offset++;
          this.excess++;
          this.runConsumed++;
        }
        while (this.runConsumed < runLength) {
          if (offset >= input.length) {
            return -1;
          }
          const charIndexInPacked = this.runConsumed - 1;
          const packedWord = decodeTree[this.treeIndex + 1 + (charIndexInPacked >> 1)];
          const expectedChar = charIndexInPacked % 2 === 0 ? packedWord & 255 : packedWord >> 8 & 255;
          if (input.charCodeAt(offset) !== expectedChar) {
            this.runConsumed = 0;
            return this.result === 0 ? 0 : this.emitNotTerminatedNamedEntity();
          }
          offset++;
          this.excess++;
          this.runConsumed++;
        }
        this.runConsumed = 0;
        this.treeIndex += 1 + (runLength >> 1);
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      }
      if (offset >= input.length)
        break;
      const char = input.charCodeAt(offset);
      if (char === CharCodes.SEMI && valueLength !== 0 && (current & BinTrieFlags.FLAG13) !== 0) {
        return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
      }
      this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
      if (this.treeIndex < 0) {
        return this.result === 0 || // If we are parsing an attribute
        this.decodeMode === DecodingMode.Attribute && // We shouldn't have consumed any characters after the entity,
        (valueLength === 0 || // And there should be no invalid characters.
        isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
      }
      current = decodeTree[this.treeIndex];
      valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      if (valueLength !== 0) {
        if (char === CharCodes.SEMI) {
          return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
        }
        if (this.decodeMode !== DecodingMode.Strict && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = this.treeIndex;
          this.consumed += this.excess;
          this.excess = 0;
        }
      }
      offset++;
      this.excess++;
    }
    return -1;
  }
  /**
   * Emit a named entity that was not terminated with a semicolon.
   * @returns The number of characters consumed.
   */
  emitNotTerminatedNamedEntity() {
    const { result, decodeTree } = this;
    const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
    this.emitNamedEntityData(result, valueLength, this.consumed);
    this.errors?.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
  /**
   * Emit a named entity.
   * @param result The index of the entity in the decode tree.
   * @param valueLength The number of bytes in the entity.
   * @param consumed The number of characters consumed.
   * @returns The number of characters consumed.
   */
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this;
    this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~(BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13) : decodeTree[result + 1], consumed);
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed);
    }
    return consumed;
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   * @returns The number of characters consumed.
   */
  end() {
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      }
      // Otherwise, emit a numeric entity if we have one.
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2);
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3);
      }
      case EntityDecoderState.NumericStart: {
        this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      case EntityDecoderState.EntityStart: {
        return 0;
      }
    }
  }
};
function getDecoder(decodeTree) {
  let returnValue = "";
  const decoder = new EntityDecoder(decodeTree, (data) => returnValue += String.fromCodePoint(data));
  return function decodeWithTrie(input, decodeMode) {
    let lastIndex = 0;
    let offset = 0;
    while ((offset = input.indexOf("&", offset)) >= 0) {
      returnValue += input.slice(lastIndex, offset);
      decoder.startEntity(decodeMode);
      const length = decoder.write(
        input,
        // Skip the "&"
        offset + 1
      );
      if (length < 0) {
        lastIndex = offset + decoder.end();
        break;
      }
      lastIndex = offset + length;
      offset = length === 0 ? lastIndex + 1 : lastIndex;
    }
    const result = returnValue + input.slice(lastIndex);
    returnValue = "";
    return result;
  };
}
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (branchCount === 0) {
    return jumpOffset !== 0 && char === jumpOffset ? nodeIndex : -1;
  }
  if (jumpOffset) {
    const value = char - jumpOffset;
    return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIndex + value] - 1;
  }
  const packedKeySlots = branchCount + 1 >> 1;
  let lo = 0;
  let hi = branchCount - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const slot = mid >> 1;
    const packed = decodeTree[nodeIndex + slot];
    const midKey = packed >> (mid & 1) * 8 & 255;
    if (midKey < char) {
      lo = mid + 1;
    } else if (midKey > char) {
      hi = mid - 1;
    } else {
      return decodeTree[nodeIndex + packedKeySlots + mid];
    }
  }
  return -1;
}
var htmlDecoder = /* @__PURE__ */ getDecoder(htmlDecodeTree);
function decodeHTMLStrict(htmlString) {
  return htmlDecoder(htmlString, DecodingMode.Strict);
}

// ../node_modules/entities/dist/index.js
var EntityLevel;
(function(EntityLevel2) {
  EntityLevel2[EntityLevel2["XML"] = 0] = "XML";
  EntityLevel2[EntityLevel2["HTML"] = 1] = "HTML";
})(EntityLevel || (EntityLevel = {}));
var EncodingMode;
(function(EncodingMode2) {
  EncodingMode2[EncodingMode2["UTF8"] = 0] = "UTF8";
  EncodingMode2[EncodingMode2["ASCII"] = 1] = "ASCII";
  EncodingMode2[EncodingMode2["Extensive"] = 2] = "Extensive";
  EncodingMode2[EncodingMode2["Attribute"] = 3] = "Attribute";
  EncodingMode2[EncodingMode2["Text"] = 4] = "Text";
})(EncodingMode || (EncodingMode = {}));

// ../node_modules/linkify-it/build/index.mjs
var REBuilder = class {
  src_Any = Any.source;
  src_Cc = Cc.source;
  src_Z = Z.source;
  src_P = P.source;
  src_ZPCc = [
    this.src_Z,
    this.src_P,
    this.src_Cc
  ].join("|");
  src_ZCc = [this.src_Z, this.src_Cc].join("|");
  cache = {};
  opts = {
    maxLength: 1e4,
    urlAuth: false,
    schema_names: []
  };
  constructor(opts = {}) {
    this.opts = {
      ...this.opts,
      ...opts
    };
  }
  set(opts = {}) {
    this.opts = {
      ...this.opts,
      ...opts
    };
    this.cache = {};
    return this;
  }
  escapeRE(str) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
  }
  nestedPairRE(open, close, depth = 4) {
    const openRE = this.escapeRE(open);
    const closeRE = this.escapeRE(close);
    const atom = `(?:(?!${this.src_ZCc}|${openRE}|${closeRE}).)`;
    let pair = `${openRE}${atom}{0,1000}${closeRE}`;
    for (let level = 2; level <= depth; level++) pair = `${openRE}(?:${atom}|${pair}){0,1000}${closeRE}`;
    return pair;
  }
  get_text_separators() {
    return this.cache.text_separators ??= /[><\uff5c]/;
  }
  get_pseudo_letter() {
    return this.cache.src_pseudo_letter ??= new RegExp(`(?:(?!${this.get_text_separators().source}|${this.src_ZPCc})${this.src_Any})`);
  }
  get_ipv4_addr() {
    return this.cache.src_ip4 ??= /* @__PURE__ */ new RegExp("(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])[.]){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])");
  }
  get_ipv6_addr() {
    const h16 = "[0-9A-Fa-f]{1,4}";
    const ls32 = `(?:(?:${h16}:${h16})|${this.get_ipv4_addr().source})`;
    return this.cache.src_ip6_addr ??= new RegExp(`(?:(?:${h16}:){6}${ls32}|::(?:${h16}:){5}${ls32}|(?:${h16})?::(?:${h16}:){4}${ls32}|(?:(?:${h16}:){0,1}${h16})?::(?:${h16}:){3}${ls32}|(?:(?:${h16}:){0,2}${h16})?::(?:${h16}:){2}${ls32}|(?:(?:${h16}:){0,3}${h16})?::${h16}:${ls32}|(?:(?:${h16}:){0,4}${h16})?::${ls32}|(?:(?:${h16}:){0,5}${h16})?::${h16}|(?:(?:${h16}:){0,6}${h16})?::)`);
  }
  get_ipv6_url_host() {
    return this.cache.src_ip6_host ??= new RegExp(`\\[${this.get_ipv6_addr().source}\\]`);
  }
  get_ipv6_mail_host() {
    return this.cache.src_ipv6_mail_host ??= new RegExp(`\\[IPv6:${this.get_ipv6_addr().source}\\]`);
  }
  get_auth() {
    return this.cache.src_auth ??= new RegExp(`(?:(?:(?!${this.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`);
  }
  get_port() {
    return this.cache.src_port ??= /* @__PURE__ */ new RegExp("(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?");
  }
  get_host_terminator() {
    return this.cache.src_host_terminator ??= new RegExp(`(?=$|${this.get_text_separators().source}|${this.src_ZPCc})(?!${this.opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${this.src_ZPCc}))`);
  }
  get_path_terminator() {
    return this.cache.src_path_terminator ??= new RegExp(`${this.src_ZPCc}|${this.get_text_separators().source}`);
  }
  get_path() {
    return this.cache.src_path ??= new RegExp(`(?:[/?#](?:${this.nestedPairRE("[", "]")}|${this.nestedPairRE("(", ")")}|${this.nestedPairRE("{", "}")}|\\"(?:(?!${this.src_ZCc}|["]).){1,100}\\"|\\'(?:(?!${this.src_ZCc}|[']).){1,100}\\'|\\'(?=${this.get_pseudo_letter().source}|[-])|\\.{2,20}[:]?[a-zA-Z0-9%/&]|\\.(?!${this.src_ZCc}|[.]|$)|` + (this.opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-{0,19})|" : "\\-{1,20}|") + `,(?!${this.src_ZCc}|$)|;(?!${this.src_ZCc}|$)|\\!{1,20}(?!${this.src_ZCc}|[!]|$)|\\?(?!${this.src_ZCc}|[?]|$)|` + this.get_path_extra().source + `[\\\\/:%@#&=_~*]|(?!${this.get_path_terminator().source}).){1,${this.opts.maxLength}}|\\/)?`);
  }
  get_mail_name() {
    return this.cache.src_mail_name ??= /* @__PURE__ */ new RegExp("[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9](?:[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9]|[.](?=[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9])){0,63}");
  }
  get_xn() {
    return this.cache.src_xn ??= /* @__PURE__ */ new RegExp("xn--[a-z0-9\\-]{1,59}");
  }
  get_tld() {
    if (this.cache.tld) return this.cache.tld;
    const tlds_src = [...new Set(this.opts.tlds || [])].sort().reverse().join("|");
    this.cache.tld = new RegExp(`${tlds_src || "$#none#$"}|${this.get_xn().source}`);
    return this.cache.tld;
  }
  get_domain_root() {
    return this.cache.src_domain_root ??= new RegExp("(?:" + this.get_xn().source + `|${this.get_pseudo_letter().source}{1,63})`);
  }
  get_domain() {
    return this.cache.src_domain ??= new RegExp("(?:" + this.get_xn().source + `|(?:${this.get_pseudo_letter().source})|(?:${this.get_pseudo_letter().source}(?:-|${this.get_pseudo_letter().source}){0,61}${this.get_pseudo_letter().source}))`);
  }
  get_url_host_port() {
    return this.cache.url_host_port ??= new RegExp("(?:" + this.get_ipv6_url_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,10}${this.get_domain().source}))` + this.get_port().source + this.get_host_terminator().source);
  }
  get_fuzzy_url_host_port() {
    return this.cache.fuzzy_url_host_port ??= new RegExp("(?:" + (this.opts.fuzzyIP ? this.get_ipv4_addr().source + "|" : "") + `(?:(?:(?:${this.get_domain().source})\\.){1,10}(?:${this.get_tld().source})))` + this.get_host_terminator().source);
  }
  get_mail_host() {
    return this.cache.src_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,4}${this.get_domain().source}))` + this.get_host_terminator().source);
  }
  get_fuzzy_mail_host() {
    return this.cache.src_fuzzy_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})[.]){1,4}${this.get_domain_root().source}))` + this.get_host_terminator().source);
  }
  get_path_extra() {
    return this.cache.src_path_extra ??= /* @__PURE__ */ new RegExp("");
  }
  get_fuzzy_mail_host_search() {
    return this.cache.mail_fuzzy_host_search ??= new RegExp(`@${this.get_fuzzy_mail_host().source}`, "ig");
  }
  get_fuzzy_link_search() {
    return this.cache.link_fuzzy_search ??= new RegExp(`(^|(?![.:/\\-_@])(?:[$+<=>^\`|\uFF5C]|${this.src_ZPCc}))(?:(?![$+<=>^\`|\uFF5C])${this.get_fuzzy_url_host_port().source}${this.get_path().source})`, "ig");
  }
  get_http_validator() {
    return this.cache.http_validator ??= new RegExp("\\/\\/" + (this.opts.urlAuth ? this.get_auth().source : "") + this.get_url_host_port().source + this.get_path().source, "iy");
  }
  get_relative_proto_validator() {
    return this.cache.relative_proto_validator ??= new RegExp((this.opts.urlAuth ? this.get_auth().source : "") + `(?:localhost|${this.get_ipv6_url_host().source}|(?:(?:${this.get_domain().source})[.]){1,10}${this.get_domain_root().source})` + this.get_port().source + this.get_host_terminator().source + this.get_path().source, "iy");
  }
  get_mail_name_validator() {
    return this.cache.mail_name_validator ??= new RegExp(`(?:^|${this.get_text_separators().source}|"|\\(|${this.src_ZCc})(${this.get_mail_name().source})$`);
  }
  get_mailto_validator() {
    return this.cache.mailto_validator ??= new RegExp(`${this.get_mail_name().source}@${this.get_mail_host().source}`, "iy");
  }
  get_schema_names() {
    return this.cache.schema_names ??= new RegExp((this.opts.schema_names || []).map((name) => this.escapeRE(name)).join("|"));
  }
  get_schema_search() {
    return this.cache.schema_search ??= new RegExp(`(^|(?!_)(?:[><\uFF5C]|${this.src_ZPCc}))(${this.get_schema_names().source})`, "ig");
  }
  get_schema_at_start() {
    return this.cache.schema_at_start ??= new RegExp(`^${this.get_schema_search().source}`, "i");
  }
};
var web_schema = {
  validate: (text2, pos, self) => {
    const re = self.re.get_http_validator();
    re.lastIndex = pos;
    const m = re.exec(text2);
    return m ? m[0].length : 0;
  },
  normalize: (match, self) => self.normalize(match)
};
var defaultSchemas = {
  "http:": web_schema,
  "https:": web_schema,
  "ftp:": web_schema,
  "//": {
    validate: function(text2, pos, self) {
      const re = self.re.get_relative_proto_validator();
      re.lastIndex = pos;
      const m = re.exec(text2);
      if (m) {
        if (pos >= 3 && text2[pos - 3] === ":") return 0;
        if (pos >= 3 && text2[pos - 3] === "/") return 0;
        return m[0].length;
      }
      return 0;
    },
    normalize: (match, self) => self.normalize(match)
  },
  "mailto:": {
    validate: function(text2, pos, self) {
      const re = self.re.get_mailto_validator();
      re.lastIndex = pos;
      const m = re.exec(text2);
      return m ? m[0].length : 0;
    },
    normalize: (match, self) => self.normalize(match)
  }
};
var tlds_2ch = "a:cdefgilmnoqrstuwxz|b:abdefghijmnorstvwyz|c:acdfghiklmnoruvwxyz|d:ejkmoz|e:cegrstu|f:ijkmor|g:abdefghilmnpqrstuwy|h:kmnrtu|i:delmnoqrst|j:emop|k:eghimnprwyz|l:abcikrstuvy|m:acdeghklmnopqrstuvwxyz|n:acefgilopruz|o:m|p:aefghklmnrstwy|q:a|r:eosuw|s:abcdeghijklmnortuvxyz|t:cdfghjklmnortvwz|u:agksyz|v:aceginu|w:fs|y:et|z:amw";
var tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|\u0440\u0444";
function unpackTlds() {
  const result = tlds_default.split("|");
  tlds_2ch.split("|").forEach((item) => {
    const sep = item.indexOf(":");
    const prefix = item.slice(0, sep);
    for (const suffix of item.slice(sep + 1)) result.push(prefix + suffix);
  });
  return result;
}
var defaultOptions = {
  fuzzyLink: false,
  fuzzyEmail: true,
  fuzzyIP: false,
  "---": false,
  tlds: unpackTlds(),
  urlAuth: false,
  maxLength: 1e4
};
var Match = class {
  /** Prefix (protocol) for matched string. Empty for fuzzy links. */
  schema;
  /** First position of matched string. */
  index;
  /** Next position after matched string. */
  lastIndex;
  /** Matched string. */
  raw;
  /** Normalized text of matched string. */
  text;
  /** Normalized URL of matched string. */
  url;
  constructor(text2, schema, index, lastIndex) {
    const raw = text2.slice(index, lastIndex);
    this.schema = schema.toLowerCase();
    this.index = index;
    this.lastIndex = lastIndex;
    this.raw = raw;
    this.text = raw;
    this.url = raw;
  }
};
var LinkifyIt = class {
  __opts__;
  __schemas__;
  re;
  /**
  * Creates new linkifier instance.
  *
  * By default understands:
  *
  * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
  * - "fuzzy" emails (foo@bar.com).
  *
  * See {@link LinkifyConstructorOptions} for available options.
  *
  * @param options Recognition options.
  *
  * @example
  * ```javascript
  * import { LinkifyIt } from 'linkify-it'
  *
  * const linkify = new LinkifyIt({ fuzzyLink: true })
  *
  * linkify
  *   .tlds(require('tlds'))       // Reload with full TLD list
  *   .tlds('onion', true)         // Add unofficial `.onion` domain
  *   .add('ftp:', null)           // Disable `ftp:` protocol
  *   .set({ fuzzyIP: true })      // Enable IPs in fuzzy links
  *
  * console.log(linkify.test('Site github.com!')) // true
  * console.log(linkify.match('Site github.com!'))
  * ```
  */
  constructor(options = {}) {
    const { rebuilder, ...linkifyOptions } = options;
    this.__opts__ = {
      ...defaultOptions,
      ...linkifyOptions
    };
    this.__schemas__ = { ...defaultSchemas };
    this.re = rebuilder || new REBuilder();
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
  }
  /**
  * Add new rule definition.
  *
  * `schema` is a link prefix (usually, protocol name with `:` at the end,
  * `skype:` for example). `linkify-it` makes sure that prefix is not
  * preceded with alphanumeric char and symbols. Only whitespaces and
  * punctuation allowed.
  *
  * `definition` is a rule to check tail after link prefix. To disable an
  * existing rule, pass `null`.
  *
  * @param schema Rule name (fixed pattern prefix).
  * @param definition Schema definition, or `null` to disable the rule.
  *
  * See [twitter mentions example](https://github.com/markdown-it/linkify-it/blob/master/examples/twitter.mjs).
  */
  add(schema, definition = null) {
    if (!definition) delete this.__schemas__[schema];
    else {
      const def = {
        normalize: (match, self) => self.normalize(match),
        ...definition
      };
      this.__schemas__[schema] = def;
    }
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Set recognition options for links without schema.
  *
  * @param options Recognition options.
  */
  set(options = {}) {
    this.__opts__ = {
      ...this.__opts__,
      ...options
    };
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Searches linkifiable pattern and returns `true` on success or `false` on fail.
  *
  * @param text Text to scan.
  */
  test(text2) {
    if (!text2.length) return false;
    let m, re;
    re = this.re.get_schema_search();
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) if (this.testSchemaAt(text2, m[2], re.lastIndex)) return true;
    if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
      re = this.re.get_fuzzy_link_search();
      re.lastIndex = 0;
      if (re.exec(text2) !== null) return true;
    }
    if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
      if (text2.indexOf("@") >= 0) {
        const mailHostRe = this.re.get_fuzzy_mail_host_search();
        const mailNameRe = this.re.get_mail_name_validator();
        mailHostRe.lastIndex = 0;
        while ((m = mailHostRe.exec(text2)) !== null) {
          const name = text2.slice(Math.max(0, m.index - 65), m.index);
          if (mailNameRe.test(name)) return true;
        }
      }
    }
    return false;
  }
  /**
  * Similar to {@link LinkifyIt.test} but checks only specific protocol tail exactly
  * at given position. Returns length of found pattern (0 on fail).
  *
  * @param text Text to scan.
  * @param schema Rule (schema) name.
  * @param pos Text offset to check from.
  */
  testSchemaAt(text2, schema, pos) {
    if (!this.__schemas__[schema.toLowerCase()]) return 0;
    return this.__schemas__[schema.toLowerCase()].validate(text2.slice(0, pos + this.__opts__.maxLength), pos, this);
  }
  /**
  * Returns array of found link descriptions or `null` on fail. We strongly
  * recommend to use {@link LinkifyIt.test} first, for best speed.
  *
  * @param text Text to scan.
  */
  match(text2) {
    const result = [];
    const schemaRe = this.re.get_schema_search();
    let fuzzyLinkRe;
    let mailHostRe;
    let mailNameRe;
    let fuzzyLinkCandidate;
    let fuzzyEmailCandidate;
    let schemaPrefix;
    let schemaDone = false;
    let fuzzyLinkDone = false;
    let fuzzyEmailDone = false;
    let pos = 0;
    if (!text2.length) return null;
    schemaRe.lastIndex = 0;
    if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
      fuzzyLinkRe = this.re.get_fuzzy_link_search();
      fuzzyLinkRe.lastIndex = 0;
    }
    if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
      mailHostRe = this.re.get_fuzzy_mail_host_search();
      mailHostRe.lastIndex = 0;
      mailNameRe = this.re.get_mail_name_validator();
    }
    for (; ; ) {
      const scanFrom = Math.max(pos - 1, 0);
      if (mailHostRe && mailNameRe && !fuzzyEmailDone && (!fuzzyEmailCandidate || fuzzyEmailCandidate.index < pos)) {
        if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
        for (; ; ) {
          const m = mailHostRe.exec(text2);
          if (!m) {
            fuzzyEmailDone = true;
            fuzzyEmailCandidate = void 0;
            break;
          }
          const name = mailNameRe.exec(text2.slice(Math.max(0, m.index - 65), m.index));
          if (!name) continue;
          fuzzyEmailCandidate = {
            schema: "mailto:",
            index: m.index - name[1].length,
            lastIndex: m.index + m[0].length
          };
          if (fuzzyEmailCandidate.index >= pos) break;
          if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
        }
      }
      if (fuzzyLinkRe && !fuzzyLinkDone && (!fuzzyLinkCandidate || fuzzyLinkCandidate.index < pos)) {
        if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
        for (; ; ) {
          const m = fuzzyLinkRe.exec(text2);
          if (!m) {
            fuzzyLinkDone = true;
            fuzzyLinkCandidate = void 0;
            break;
          }
          fuzzyLinkCandidate = {
            schema: "",
            index: m.index + m[1].length,
            lastIndex: m.index + m[0].length
          };
          if (fuzzyLinkCandidate.index >= pos) break;
          if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
        }
      }
      let fuzzyCandidate = fuzzyEmailCandidate;
      if (!fuzzyCandidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < fuzzyCandidate.index || fuzzyLinkCandidate.index === fuzzyCandidate.index && fuzzyLinkCandidate.lastIndex > fuzzyCandidate.lastIndex)) fuzzyCandidate = fuzzyLinkCandidate;
      let schemaCandidate;
      if (!schemaDone) for (; ; ) {
        if (!schemaPrefix) {
          if (schemaRe.lastIndex < scanFrom) schemaRe.lastIndex = scanFrom;
          const m = schemaRe.exec(text2);
          if (!m) {
            schemaDone = true;
            break;
          }
          schemaPrefix = {
            schema: m[2],
            index: m.index + m[1].length,
            lastIndex: m.index + m[0].length
          };
        }
        if (schemaPrefix.index < pos) {
          schemaPrefix = void 0;
          continue;
        }
        if (fuzzyCandidate && schemaPrefix.index > fuzzyCandidate.index) break;
        const prefix = schemaPrefix;
        schemaPrefix = void 0;
        const len = this.testSchemaAt(text2, prefix.schema, prefix.lastIndex);
        if (len) {
          schemaCandidate = {
            schema: prefix.schema,
            index: prefix.index,
            lastIndex: prefix.lastIndex + len
          };
          break;
        }
      }
      let candidate = schemaCandidate;
      if (!candidate || fuzzyEmailCandidate && (fuzzyEmailCandidate.index < candidate.index || fuzzyEmailCandidate.index === candidate.index && fuzzyEmailCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyEmailCandidate;
      if (!candidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < candidate.index || fuzzyLinkCandidate.index === candidate.index && fuzzyLinkCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyLinkCandidate;
      if (!candidate) break;
      if (candidate === fuzzyEmailCandidate) fuzzyEmailCandidate = void 0;
      else if (candidate === fuzzyLinkCandidate) fuzzyLinkCandidate = void 0;
      const match = new Match(text2, candidate.schema, candidate.index, candidate.lastIndex);
      if (match.schema) this.__schemas__[match.schema].normalize(match, this);
      else this.normalize(match);
      result.push(match);
      pos = candidate.lastIndex;
    }
    if (result.length) return result;
    return null;
  }
  /**
  * Returns fully-formed (not fuzzy) link if it starts at the beginning
  * of the string, and null otherwise.
  *
  * @param text Text to scan.
  */
  matchAtStart(text2) {
    if (!text2.length) return null;
    const m = this.re.get_schema_at_start().exec(text2);
    if (!m) return null;
    const len = this.testSchemaAt(text2, m[2], m[0].length);
    if (!len) return null;
    const match = new Match(text2, m[2], m.index + m[1].length, m.index + m[0].length + len);
    this.__schemas__[match.schema].normalize(match, this);
    return match;
  }
  /**
  * Load (or merge) new TLDs list. Those are used for fuzzy links (without
  * prefix) to avoid false positives. By default this algorithm is used:
  *
  * - hostname with any 2-letter root zones are ok.
  * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
  *   are ok.
  * - encoded (`xn--...`) root zones are ok.
  *
  * If list is replaced, then exact match for 2-chars root zones will be checked.
  *
  * @param list List of TLDs.
  * @param keepOld Merge with current list if `true` (`false` by default).
  */
  tlds(list2, keepOld = false) {
    list2 = Array.isArray(list2) ? list2 : [list2];
    if (!keepOld) this.__opts__.tlds = list2;
    else this.__opts__.tlds = this.__opts__.tlds.concat(list2);
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Default normalizer (if schema does not define its own).
  *
  * @param match Match to normalize.
  */
  normalize(match) {
    if (!match.schema) match.url = `http://${match.url}`;
    if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) match.url = `mailto:${match.url}`;
  }
};

// ../node_modules/punycode.js/punycode.es6.js
var maxInt = 2147483647;
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128;
var delimiter = "-";
var regexPunycode = /^xn--/;
var regexNonASCII = /[^\0-\x7F]/;
var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
var errors = {
  "overflow": "Overflow: input needs wider integers to process",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "invalid-input": "Invalid input"
};
var baseMinusTMin = base - tMin;
var floor = Math.floor;
var stringFromCharCode = String.fromCharCode;
function error(type2) {
  throw new RangeError(errors[type2]);
}
function map(array, callback) {
  const result = [];
  let length = array.length;
  while (length--) {
    result[length] = callback(array[length]);
  }
  return result;
}
function mapDomain(domain, callback) {
  const parts = domain.split("@");
  let result = "";
  if (parts.length > 1) {
    result = parts[0] + "@";
    domain = parts[1];
  }
  domain = domain.replace(regexSeparators, ".");
  const labels = domain.split(".");
  const encoded = map(labels, callback).join(".");
  return result + encoded;
}
function ucs2decode(string) {
  const output = [];
  let counter = 0;
  const length = string.length;
  while (counter < length) {
    const value = string.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length) {
      const extra = string.charCodeAt(counter++);
      if ((extra & 64512) == 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
var ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
var basicToDigit = function(codePoint) {
  if (codePoint >= 48 && codePoint < 58) {
    return 26 + (codePoint - 48);
  }
  if (codePoint >= 65 && codePoint < 91) {
    return codePoint - 65;
  }
  if (codePoint >= 97 && codePoint < 123) {
    return codePoint - 97;
  }
  return base;
};
var digitToBasic = function(digit, flag) {
  return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};
var adapt = function(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? floor(delta / damp) : delta >> 1;
  delta += floor(delta / numPoints);
  for (; delta > baseMinusTMin * tMax >> 1; k += base) {
    delta = floor(delta / baseMinusTMin);
  }
  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};
var decode2 = function(input) {
  const output = [];
  const inputLength = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;
  let basic = input.lastIndexOf(delimiter);
  if (basic < 0) {
    basic = 0;
  }
  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 128) {
      error("not-basic");
    }
    output.push(input.charCodeAt(j));
  }
  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (index >= inputLength) {
        error("invalid-input");
      }
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= base) {
        error("invalid-input");
      }
      if (digit > floor((maxInt - i) / w)) {
        error("overflow");
      }
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }
      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) {
        error("overflow");
      }
      w *= baseMinusT;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi == 0);
    if (floor(i / out) > maxInt - n) {
      error("overflow");
    }
    n += floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
};
var encode2 = function(input) {
  const output = [];
  input = ucs2decode(input);
  const inputLength = input.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (const currentValue of input) {
    if (currentValue < 128) {
      output.push(stringFromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (const currentValue of input) {
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (const currentValue of input) {
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(
            stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
          );
          q = floor(qMinusT / baseMinusT);
        }
        output.push(stringFromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
};
var toUnicode = function(input) {
  return mapDomain(input, function(string) {
    return regexPunycode.test(string) ? decode2(string.slice(4).toLowerCase()) : string;
  });
};
var toASCII = function(input) {
  return mapDomain(input, function(string) {
    return regexNonASCII.test(string) ? "xn--" + encode2(string) : string;
  });
};
var punycode = {
  /**
   * A string representing the current Punycode.js version number.
   * @memberOf punycode
   * @type String
   */
  "version": "2.3.1",
  /**
   * An object of methods to convert from JavaScript's internal character
   * representation (UCS-2) to Unicode code points, and back.
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode
   * @type Object
   */
  "ucs2": {
    "decode": ucs2decode,
    "encode": ucs2encode
  },
  "decode": decode2,
  "encode": encode2,
  "toASCII": toASCII,
  "toUnicode": toUnicode
};
var punycode_es6_default = punycode;

// ../node_modules/markdown-it/dist/markdown-it.mjs
var __defProp2 = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp2(target, name, {
    get: all[name],
    enumerable: true
  });
  if (!no_symbols) __defProp2(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
var utils_exports = /* @__PURE__ */ __exportAll({
  arrayReplaceAt: () => arrayReplaceAt,
  asciiTrim: () => asciiTrim,
  callable: () => callable,
  escapeHtml: () => escapeHtml,
  escapeRE: () => escapeRE,
  fromCodePoint: () => fromCodePoint,
  isMdAsciiPunct: () => isMdAsciiPunct,
  isPunctChar: () => isPunctChar,
  isPunctCharCode: () => isPunctCharCode,
  isSpace: () => isSpace,
  isValidEntityCode: () => isValidEntityCode,
  isWhiteSpace: () => isWhiteSpace,
  lib: () => lib,
  normalizeReference: () => normalizeReference,
  unescapeAll: () => unescapeAll,
  unescapeMd: () => unescapeMd
});
function callable(cls) {
  const wrapper = function(...args) {
    return Reflect.construct(cls, args, new.target && new.target !== wrapper ? new.target : cls);
  };
  Object.defineProperty(wrapper, "name", { value: cls.name });
  Object.setPrototypeOf(wrapper, cls);
  wrapper.prototype = cls.prototype;
  return wrapper;
}
function arrayReplaceAt(src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}
function isValidEntityCode(c) {
  if (c >= 55296 && c <= 57343) return false;
  if (c >= 64976 && c <= 65007) return false;
  if ((c & 65535) === 65535 || (c & 65535) === 65534) return false;
  if (c >= 0 && c <= 8) return false;
  if (c === 11) return false;
  if (c >= 14 && c <= 31) return false;
  if (c >= 127 && c <= 159) return false;
  if (c > 1114111) return false;
  return true;
}
function fromCodePoint(c) {
  if (c > 65535) {
    c -= 65536;
    const surrogate1 = 55296 + (c >> 10);
    const surrogate2 = 56320 + (c & 1023);
    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}
var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
var UNESCAPE_ALL_RE = new RegExp(`${UNESCAPE_MD_RE.source}|${/&([a-z#][a-z0-9]{1,31});/gi.source}`, "gi");
var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
function replaceEntityPattern(match, name) {
  if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code2 = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    if (isValidEntityCode(code2)) return fromCodePoint(code2);
    return match;
  }
  const decoded = decodeHTMLStrict(match);
  if (decoded !== match) return decoded;
  return match;
}
function unescapeMd(str) {
  if (str.indexOf("\\") < 0) return str;
  return str.replace(UNESCAPE_MD_RE, "$1");
}
function unescapeAll(str) {
  if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) return str;
  return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity2) {
    if (escaped) return escaped;
    return replaceEntityPattern(match, entity2);
  });
}
var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};
function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}
function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  return str;
}
var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
function escapeRE(str) {
  return str.replace(REGEXP_ESCAPE_RE, "\\$&");
}
function isSpace(code2) {
  switch (code2) {
    case 9:
    case 32:
      return true;
  }
  return false;
}
function isWhiteSpace(code2) {
  if (code2 >= 8192 && code2 <= 8202) return true;
  switch (code2) {
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 32:
    case 160:
    case 5760:
    case 8239:
    case 8287:
    case 12288:
      return true;
  }
  return false;
}
function isPunctChar(ch) {
  return P.test(ch) || S.test(ch);
}
function isPunctCharCode(code2) {
  return isPunctChar(fromCodePoint(code2));
}
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 33:
    case 34:
    case 35:
    case 36:
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
    case 42:
    case 43:
    case 44:
    case 45:
    case 46:
    case 47:
    case 58:
    case 59:
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 124:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function normalizeReference(str) {
  str = str.trim().replace(/\s+/g, " ");
  return str.toLowerCase().toUpperCase();
}
function isAsciiTrimmable(c) {
  return c === 32 || c === 9 || c === 10 || c === 13;
}
function asciiTrim(str) {
  let start = 0;
  for (; start < str.length; start++) if (!isAsciiTrimmable(str.charCodeAt(start))) break;
  let end = str.length - 1;
  for (; end >= start; end--) if (!isAsciiTrimmable(str.charCodeAt(end))) break;
  return str.slice(start, end + 1);
}
var lib = {
  mdurl: mdurl_exports,
  ucmicro: build_exports
};
function parseLinkLabel(state, start, disableNested) {
  let level, found, marker, prevPos;
  const max = state.posMax;
  const oldPos = state.pos;
  state.pos = start + 1;
  level = 1;
  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 93) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }
    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 91) {
      if (prevPos === state.pos - 1) level++;
      else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }
  let labelEnd = -1;
  if (found) labelEnd = state.pos;
  state.pos = oldPos;
  return labelEnd;
}
function parseLinkDestination(str, start, max) {
  let code2;
  let pos = start;
  const result = {
    ok: false,
    pos: 0,
    str: ""
  };
  if (str.charCodeAt(pos) === 60) {
    pos++;
    while (pos < max) {
      code2 = str.charCodeAt(pos);
      if (code2 === 10) return result;
      if (code2 === 60) return result;
      if (code2 === 62) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code2 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      pos++;
    }
    return result;
  }
  let level = 0;
  while (pos < max) {
    code2 = str.charCodeAt(pos);
    if (code2 === 32) break;
    if (code2 < 32 || code2 === 127) break;
    if (code2 === 92 && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 32) {
        pos++;
        continue;
      }
      pos += 2;
      continue;
    }
    if (code2 === 40) {
      level++;
      if (level > 32) return result;
    }
    if (code2 === 41) {
      if (level === 0) break;
      level--;
    }
    pos++;
  }
  if (start === pos) return result;
  if (level !== 0) return result;
  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result;
}
function parseLinkTitle(str, start, max, prev_state) {
  let code2;
  let pos = start;
  const state = {
    ok: false,
    can_continue: false,
    pos: 0,
    str: "",
    marker: 0
  };
  if (prev_state) {
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max) return state;
    let marker = str.charCodeAt(pos);
    if (marker !== 34 && marker !== 39 && marker !== 40) return state;
    start++;
    pos++;
    if (marker === 40) marker = 41;
    state.marker = marker;
  }
  while (pos < max) {
    code2 = str.charCodeAt(pos);
    if (code2 === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state;
    } else if (code2 === 40 && state.marker === 41) return state;
    else if (code2 === 92 && pos + 1 < max) pos++;
    pos++;
  }
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state;
}
var helpers_exports = /* @__PURE__ */ __exportAll({
  parseLinkDestination: () => parseLinkDestination,
  parseLinkLabel: () => parseLinkLabel,
  parseLinkTitle: () => parseLinkTitle
});
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}
function toPrimitive(t, r) {
  if ("object" != _typeof(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}
function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
var Token = class {
  constructor(type2, tag, nesting) {
    _defineProperty(
      this,
      /**
      * Source map info. Format: `[ line_begin, line_end ]`
      */
      "map",
      null
    );
    _defineProperty(
      this,
      /**
      * nesting level, the same as `state.level`
      */
      "level",
      0
    );
    _defineProperty(
      this,
      /**
      * An array of child nodes (inline and img tokens)
      */
      "children",
      null
    );
    _defineProperty(
      this,
      /**
      * In a case of self-closing tag (code, html, fence, etc.),
      * it has contents of this tag.
      */
      "content",
      ""
    );
    _defineProperty(
      this,
      /**
      * '*' or '_' for emphasis, fence string for fence, etc.
      */
      "markup",
      ""
    );
    _defineProperty(
      this,
      /**
      * Additional information:
      *
      * - Info string for "fence" tokens
      * - The value "auto" for autolink "link_open" and "link_close" tokens
      * - The string value of the item marker for ordered-list "list_item_open" tokens
      */
      "info",
      ""
    );
    _defineProperty(
      this,
      /**
      * True for block-level tokens, false for inline tokens.
      * Used in renderer to calculate line breaks
      */
      "block",
      false
    );
    _defineProperty(
      this,
      /**
      * If it's true, ignore this element when rendering. Used for tight lists
      * to hide paragraphs.
      */
      "hidden",
      false
    );
    this.type = type2;
    this.tag = tag;
    this.attrs = null;
    this.nesting = nesting;
    this.meta = null;
  }
  /**
  * Search attribute index by name.
  */
  attrIndex(name) {
    if (!this.attrs) return -1;
    const attrs = this.attrs;
    for (let i = 0, len = attrs.length; i < len; i++) if (attrs[i][0] === name) return i;
    return -1;
  }
  /**
  * Add `[ name, value ]` attribute to list. Init attrs if necessary
  */
  attrPush(attrData) {
    if (this.attrs) this.attrs.push(attrData);
    else this.attrs = [attrData];
  }
  /**
  * Set `name` attribute to `value`. Override old value if exists.
  */
  attrSet(name, value) {
    const idx = this.attrIndex(name);
    const attrData = [name, value];
    if (idx < 0) this.attrPush(attrData);
    else this.attrs[idx] = attrData;
  }
  /**
  * Get the value of attribute `name`, or null if it does not exist.
  */
  attrGet(name) {
    const idx = this.attrIndex(name);
    let value = null;
    if (idx >= 0) value = this.attrs[idx][1];
    return value;
  }
  /**
  * Join value to existing attribute via space. Or create new attribute if not
  * exists. Useful to operate with token classes.
  */
  attrJoin(name, value) {
    const idx = this.attrIndex(name);
    if (idx < 0) this.attrPush([name, value]);
    else this.attrs[idx][1] = `${this.attrs[idx][1]} ${value}`;
  }
};
var Ruler = class {
  constructor() {
    _defineProperty(this, "__rules__", []);
    _defineProperty(this, "__cache__", null);
  }
  __find__(name) {
    for (let i = 0; i < this.__rules__.length; i++) if (this.__rules__[i].name === name) return i;
    return -1;
  }
  __compile__() {
    const chains = /* @__PURE__ */ new Set();
    this.__rules__.forEach((rule) => {
      if (!rule.enabled) return;
      rule.alt.forEach((altName) => {
        if (altName) chains.add(altName);
      });
    });
    this.__cache__ = /* @__PURE__ */ Object.create(null);
    this.__cache__[""] = [];
    this.__rules__.forEach((rule) => {
      if (rule.enabled) this.__cache__[""].push(rule.fn);
    });
    chains.forEach((chain) => {
      this.__cache__[chain] = [];
      this.__rules__.forEach((rule) => {
        if (rule.enabled && rule.alt.indexOf(chain) >= 0) this.__cache__[chain].push(rule.fn);
      });
    });
  }
  /**
  * Replace rule by name with new function & options. Throws error if name not
  * found.
  *
  * @param name Rule name to replace.
  * @param fn New rule function.
  * @param options Rule options. `alt` is an array with names of "alternate"
  * chains.
  *
  * @example Replace existing typographer replacement rule with new one
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.core.ruler.at('replacements', function replace(state) {
  *   //...
  * });
  * ```
  */
  at(name, fn, options = {}) {
    const index = this.__find__(name);
    if (index === -1) throw new Error(`Parser rule not found: ${name}`);
    this.__rules__[index].fn = fn;
    this.__rules__[index].alt = options.alt || [];
    this.__cache__ = null;
  }
  /**
  * Add new rule to chain before one with given name. See also
  * {@link Ruler.after}, {@link Ruler.push}.
  *
  * @param beforeName New rule will be added before this one.
  * @param ruleName Name of added rule.
  * @param fn Rule function.
  * @param options Rule options. `alt` is an array with names of "alternate"
  * chains.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  before(beforeName, ruleName, fn, options = {}) {
    const index = this.__find__(beforeName);
    if (index === -1) throw new Error(`Parser rule not found: ${beforeName}`);
    this.__rules__.splice(index, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Add new rule to chain after one with given name. See also
  * {@link Ruler.before}, {@link Ruler.push}.
  *
  * @param afterName New rule will be added after this one.
  * @param ruleName Name of added rule.
  * @param fn Rule function.
  * @param options Rule options. `alt` is an array with names of "alternate"
  * chains.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.inline.ruler.after('text', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  after(afterName, ruleName, fn, options = {}) {
    const index = this.__find__(afterName);
    if (index === -1) throw new Error(`Parser rule not found: ${afterName}`);
    this.__rules__.splice(index + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Push new rule to the end of chain. See also
  * {@link Ruler.before}, {@link Ruler.after}.
  *
  * @param ruleName Name of added rule.
  * @param fn Rule function.
  * @param options Rule options. `alt` is an array with names of "alternate"
  * chains.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.core.ruler.push('my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  push(ruleName, fn, options = {}) {
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Enable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * See also {@link Ruler.disable}, {@link Ruler.enableOnly}.
  *
  * @param list List of rule names to enable.
  * @param ignoreInvalid Set `true` to ignore errors when rule not found.
  * @returns List of found rule names (if no exception happened).
  */
  enable(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    const result = [];
    list2.forEach((name) => {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) return;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = true;
      result.push(name);
    });
    this.__cache__ = null;
    return result;
  }
  /**
  * Enable rules with given names, and disable everything else. If any rule name
  * not found - throw Error. Errors can be disabled by second param.
  *
  * See also {@link Ruler.disable}, {@link Ruler.enable}.
  *
  * @param list List of rule names to enable (whitelist).
  * @param ignoreInvalid Set `true` to ignore errors when rule not found.
  */
  enableOnly(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    this.__rules__.forEach((rule) => {
      rule.enabled = false;
    });
    this.enable(list2, ignoreInvalid);
  }
  /**
  * Disable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * See also {@link Ruler.enable}, {@link Ruler.enableOnly}.
  *
  * @param list List of rule names to disable.
  * @param ignoreInvalid Set `true` to ignore errors when rule not found.
  * @returns List of found rule names (if no exception happened).
  */
  disable(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    const result = [];
    list2.forEach((name) => {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) return;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = false;
      result.push(name);
    });
    this.__cache__ = null;
    return result;
  }
  /**
  * Return array of active functions (rules) for given chain name. It analyzes
  * rules configuration, compiles caches if not exists and returns result.
  *
  * Default chain name is `''` (empty string). It can't be skipped. That's
  * done intentionally, to keep signature monomorphic for high speed.
  */
  getRules(chainName) {
    if (!this.__cache__) this.__compile__();
    return this.__cache__[chainName] || [];
  }
};
var default_rules = {};
default_rules.code_inline = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<code${slf.renderAttrs(token)}>${escapeHtml(token.content)}</code>`;
};
default_rules.code_block = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<pre${slf.renderAttrs(token)}><code>${escapeHtml(tokens[idx].content)}</code></pre>
`;
};
default_rules.fence = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : "";
  let langName = "";
  let langAttrs = "";
  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join("");
  }
  let highlighted;
  if (options.highlight) highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content);
  else highlighted = escapeHtml(token.content);
  if (highlighted.indexOf("<pre") === 0) return highlighted + "\n";
  if (info) {
    const i = token.attrIndex("class");
    const tmpAttrs = token.attrs ? token.attrs.slice() : [];
    if (i < 0) tmpAttrs.push(["class", `${options.langPrefix}${langName}`]);
    else {
      tmpAttrs[i] = [tmpAttrs[i][0], tmpAttrs[i][1]];
      tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`;
    }
    const tmpToken = { attrs: tmpAttrs };
    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>
`;
  }
  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>
`;
};
default_rules.image = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
  return slf.renderToken(tokens, idx, options);
};
default_rules.hardbreak = function(tokens, idx, options) {
  return options.xhtmlOut ? "<br />\n" : "<br>\n";
};
default_rules.softbreak = function(tokens, idx, options) {
  return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
};
default_rules.text = function(tokens, idx) {
  return escapeHtml(tokens[idx].content);
};
default_rules.html_block = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.html_inline = function(tokens, idx) {
  return tokens[idx].content;
};
var Renderer = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * Contains render rules for tokens. Can be updated and extended.
      *
      * See [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts)
      * for more details and examples.
      *
      * @example Custom render rules
      * ```javascript
      * import MarkdownIt from 'markdown-it'
      * const md = new MarkdownIt()
      *
      * md.renderer.rules.strong_open  = function () { return '<b>'; };
      * md.renderer.rules.strong_close = function () { return '</b>'; };
      *
      * const result = md.renderInline(...);
      * ```
      *
      * @example Each rule is called as independent static function with fixed signature
      * ```javascript
      * function my_token_render(tokens, idx, options, env, renderer) {
      *   // ...
      *   return renderedHTML;
      * }
      * ```
      */
      "rules",
      Object.assign({}, default_rules)
    );
  }
  /**
  * Render token attributes to string.
  */
  renderAttrs(token) {
    let i, l, result;
    if (!token.attrs) return "";
    result = "";
    for (i = 0, l = token.attrs.length; i < l; i++) result += ` ${escapeHtml(token.attrs[i][0])}="${escapeHtml(String(token.attrs[i][1]))}"`;
    return result;
  }
  /**
  * Default token renderer. Can be overriden by custom function
  * in {@link Renderer.rules}.
  *
  * @param tokens List of tokens.
  * @param idx Token index to render.
  * @param options Params of parser instance.
  */
  renderToken(tokens, idx, options) {
    const token = tokens[idx];
    let result = "";
    if (token.hidden) return "";
    let prev = idx - 1;
    while (prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === 0) prev--;
    if (token.block && token.nesting !== -1 && prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === -1) result += "\n";
    result += (token.nesting === -1 ? "</" : "<") + token.tag;
    result += this.renderAttrs(token);
    if (token.nesting === 0 && options.xhtmlOut) result += " /";
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        let next = idx + 1;
        while (next < tokens.length && tokens[next].hidden && tokens[next].nesting === 0) next++;
        if (next < tokens.length) {
          const nextToken = tokens[next];
          if (nextToken.type === "inline" || nextToken.hidden) needLf = false;
          else if (nextToken.nesting === -1 && nextToken.tag === token.tag) needLf = false;
        }
      }
    }
    result += needLf ? ">\n" : ">";
    return result;
  }
  /**
  * The same as {@link Renderer.render}, but for single token of `inline` type.
  *
  * @param tokens List on block tokens to render.
  * @param options Params of parser instance.
  * @param env Additional data from parsed input (references, for example).
  */
  renderInline(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type2 = tokens[i].type;
      if (typeof rules[type2] !== "undefined") result += rules[type2](tokens, i, options, env, this);
      else result += this.renderToken(tokens, i, options);
    }
    return result;
  }
  /**
  * Special kludge for image `alt` attributes to conform CommonMark spec.
  * Don't try to use it! Spec requires to show `alt` content with stripped markup,
  * instead of simple escaping.
  *
  * @param tokens List on block tokens to render.
  * @param options Params of parser instance.
  * @param env Additional data from parsed input (references, for example).
  */
  renderInlineAsText(tokens, options, env) {
    let result = "";
    for (let i = 0, len = tokens.length; i < len; i++) switch (tokens[i].type) {
      case "text":
      case "code_inline":
        result += tokens[i].content;
        break;
      case "image":
        result += this.renderInlineAsText(tokens[i].children, options, env);
        break;
      case "html_inline":
      case "html_block":
        result += tokens[i].content;
        break;
      case "softbreak":
      case "hardbreak":
        result += "\n";
    }
    return result;
  }
  /**
  * Takes token stream and generates HTML. Probably, you will never need to call
  * this method directly.
  *
  * @param tokens List on block tokens to render.
  * @param options Params of parser instance.
  * @param env Additional data from parsed input (references, for example).
  */
  render(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type2 = tokens[i].type;
      if (type2 === "inline") result += this.renderInline(tokens[i].children, options, env);
      else if (typeof rules[type2] !== "undefined") result += rules[type2](tokens, i, options, env, this);
      else result += this.renderToken(tokens, i, options);
    }
    return result;
  }
};
var StateCore = class {
  constructor(src, md, env) {
    _defineProperty(this, "tokens", []);
    _defineProperty(this, "inlineMode", false);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.env = env;
    this.md = md;
  }
};
var NEWLINES_RE = /\r\n?|\n/g;
var NULL_RE = /\0/g;
function normalize(state) {
  let str;
  str = state.src.replace(NEWLINES_RE, "\n");
  str = str.replace(NULL_RE, "\uFFFD");
  state.src = str;
}
function block(state) {
  let token;
  if (state.inlineMode) {
    token = new state.Token("inline", "", 0);
    token.content = state.src;
    token.map = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else state.md.block.parse(state.src, state.md, state.env, state.tokens);
}
function strip_references(state) {
  const tokens = state.tokens;
  let last = 0;
  for (let curr = 0; curr < tokens.length; curr++) {
    if (tokens[curr].type === "reference_definition") continue;
    if (curr !== last) tokens[last] = tokens[curr];
    last++;
  }
  if (tokens.length !== last) tokens.length = last;
}
function inline(state) {
  const tokens = state.tokens;
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i];
    if (tok.type === "inline") state.md.inline.parse(tok.content, state.md, state.env, tok.children);
  }
}
function isLinkOpen$1(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose$1(str) {
  return /^<\/a\s*>/i.test(str);
}
function linkify$1(state) {
  const blockTokens = state.tokens;
  if (!state.md.options.linkify) return;
  for (let j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== "inline" || !state.md.linkify.test(blockTokens[j].content)) continue;
    let tokens = blockTokens[j].children;
    let htmlLinkLevel = 0;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i];
      if (currentToken.type === "link_close") {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") i--;
        continue;
      }
      if (currentToken.type === "html_inline") {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) htmlLinkLevel--;
        if (isLinkClose$1(currentToken.content)) htmlLinkLevel++;
      }
      if (htmlLinkLevel > 0) continue;
      if (currentToken.type === "text" && state.md.linkify.test(currentToken.content)) {
        const text2 = currentToken.content;
        let links = state.md.linkify.match(text2);
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;
        if (links.length > 0 && links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special") links = links.slice(1);
        for (let ln = 0; ln < links.length; ln++) {
          const url = links[ln].url;
          const fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) continue;
          let urlText = links[ln].text;
          if (!links[ln].schema) urlText = state.md.normalizeLinkText(`http://${urlText}`).replace(/^http:\/\//, "");
          else if (links[ln].schema === "mailto:" && !/^mailto:/i.test(urlText)) urlText = state.md.normalizeLinkText(`mailto:${urlText}`).replace(/^mailto:/, "");
          else urlText = state.md.normalizeLinkText(urlText);
          const pos = links[ln].index;
          if (pos > lastPos) {
            const token = new state.Token("text", "", 0);
            token.content = text2.slice(lastPos, pos);
            token.level = level;
            nodes.push(token);
          }
          const token_o = new state.Token("link_open", "a", 1);
          token_o.attrs = [["href", fullUrl]];
          token_o.level = level++;
          token_o.markup = "linkify";
          token_o.info = "auto";
          nodes.push(token_o);
          const token_t = new state.Token("text", "", 0);
          token_t.content = urlText;
          token_t.level = level;
          nodes.push(token_t);
          const token_c = new state.Token("link_close", "a", -1);
          token_c.level = --level;
          token_c.markup = "linkify";
          token_c.info = "auto";
          nodes.push(token_c);
          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text2.length) {
          const token = new state.Token("text", "", 0);
          token.content = text2.slice(lastPos);
          token.level = level;
          nodes.push(token);
        }
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
      }
    }
  }
}
var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
var SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;
var SCOPED_ABBR_RE = /\((c|tm|r)\)/gi;
var SCOPED_ABBR = {
  c: "\xA9",
  r: "\xAE",
  tm: "\u2122"
};
function replaceFn(match, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}
function replace_scoped(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace_rare(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) {
      if (RARE_RE.test(token.content)) token.content = token.content.replace(/\+-/g, "\xB1").replace(/\.{2,}/g, "\u2026").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/gm, "$1\u2014").replace(/(^|\s)--(?=\s|$)/gm, "$1\u2013").replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1\u2013");
    }
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace(state) {
  let blkIdx;
  if (!state.md.options.typographer) return;
  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline") continue;
    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) replace_scoped(state.tokens[blkIdx].children);
    if (RARE_RE.test(state.tokens[blkIdx].content)) replace_rare(state.tokens[blkIdx].children);
  }
}
var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = "\u2019";
function addReplacement(replacements, tokenIdx, pos, ch) {
  if (!replacements[tokenIdx]) replacements[tokenIdx] = [];
  replacements[tokenIdx].push({
    pos,
    ch
  });
}
function applyReplacements(str, replacements) {
  let result = "";
  let lastPos = 0;
  replacements.sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < replacements.length; i++) {
    const replacement = replacements[i];
    result += str.slice(lastPos, replacement.pos) + replacement.ch;
    lastPos = replacement.pos + 1;
  }
  return result + str.slice(lastPos);
}
function process_inlines(tokens, state) {
  let j;
  const stack = [];
  const replacements = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const thisLevel = tokens[i].level;
    for (j = stack.length - 1; j >= 0; j--) if (stack[j].level <= thisLevel) break;
    stack.length = j + 1;
    if (token.type !== "text") continue;
    const text2 = token.content;
    let pos = 0;
    const max = text2.length;
    OUTER: while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      const t = QUOTE_RE.exec(text2);
      if (!t) break;
      let canOpen = true;
      let canClose = true;
      pos = t.index + 1;
      const isSingle = t[0] === "'";
      let lastChar = 32;
      if (t.index - 1 >= 0) lastChar = text2.charCodeAt(t.index - 1);
      else for (j = i - 1; j >= 0; j--) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
        break;
      }
      let nextChar = 32;
      if (pos < max) nextChar = text2.charCodeAt(pos);
      else for (j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        nextChar = tokens[j].content.charCodeAt(0);
        break;
      }
      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
      const isLastWhiteSpace = isWhiteSpace(lastChar);
      const isNextWhiteSpace = isWhiteSpace(nextChar);
      if (isNextWhiteSpace) canOpen = false;
      else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) canOpen = false;
      }
      if (isLastWhiteSpace) canClose = false;
      else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) canClose = false;
      }
      if (nextChar === 34 && t[0] === '"') {
        if (lastChar >= 48 && lastChar <= 57) canClose = canOpen = false;
      }
      if (canOpen && canClose) {
        canOpen = isLastPunctChar;
        canClose = isNextPunctChar;
      }
      if (!canOpen && !canClose) {
        if (isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
        continue;
      }
      if (canClose) for (j = stack.length - 1; j >= 0; j--) {
        let item = stack[j];
        if (stack[j].level < thisLevel) break;
        if (item.single === isSingle && stack[j].level === thisLevel) {
          item = stack[j];
          let openQuote;
          let closeQuote;
          if (isSingle) {
            openQuote = state.md.options.quotes[2];
            closeQuote = state.md.options.quotes[3];
          } else {
            openQuote = state.md.options.quotes[0];
            closeQuote = state.md.options.quotes[1];
          }
          addReplacement(replacements, i, t.index, closeQuote);
          addReplacement(replacements, item.token, item.pos, openQuote);
          stack.length = j;
          continue OUTER;
        }
      }
      if (canOpen) stack.push({
        token: i,
        pos: t.index,
        single: isSingle,
        level: thisLevel
      });
      else if (canClose && isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
    }
  }
  Object.keys(replacements).forEach(function(tokenIdx) {
    const idx = Number(tokenIdx);
    tokens[idx].content = applyReplacements(tokens[idx].content, replacements[tokenIdx]);
  });
}
function smartquotes(state) {
  if (!state.md.options.typographer) return;
  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) continue;
    process_inlines(state.tokens[blkIdx].children, state);
  }
}
function join_alt(tokens) {
  let curr, last;
  const max = tokens.length;
  for (curr = 0; curr < max; curr++) if (tokens[curr].type === "text_special") tokens[curr].type = "text";
  for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
  else {
    if (curr !== last) tokens[last] = tokens[curr];
    last++;
  }
  if (curr !== last) tokens.length = last;
}
function text_join(state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;
  for (let j = 0; j < l; j++) {
    if (blockTokens[j].type !== "inline") continue;
    const tokens = blockTokens[j].children;
    const max = tokens.length;
    for (curr = 0; curr < max; curr++) {
      if (tokens[curr].type === "text_special") tokens[curr].type = "text";
      if (tokens[curr].children) join_alt(tokens[curr].children);
    }
    for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
    if (curr !== last) tokens.length = last;
  }
}
var _rules$2 = [
  ["normalize", normalize],
  ["block", block],
  ["strip_references", strip_references],
  ["inline", inline],
  ["linkify", linkify$1],
  ["replacements", replace],
  ["smartquotes", smartquotes],
  ["text_join", text_join]
];
var ParserCore = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of core rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(this, "State", StateCore);
    for (let i = 0; i < _rules$2.length; i++) this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
  }
  /**
  * Executes core chain rules.
  */
  process(state) {
    const rules = this.ruler.getRules("");
    for (let i = 0, l = rules.length; i < l; i++) rules[i](state);
  }
};
var StateBlock = class {
  constructor(src, md, env, tokens) {
    _defineProperty(this, "bMarks", []);
    _defineProperty(this, "eMarks", []);
    _defineProperty(this, "tShift", []);
    _defineProperty(this, "sCount", []);
    _defineProperty(this, "bsCount", []);
    _defineProperty(this, "blkIndent", 0);
    _defineProperty(this, "line", 0);
    _defineProperty(this, "lineMax", 0);
    _defineProperty(this, "tight", false);
    _defineProperty(this, "listIndent", -1);
    _defineProperty(this, "parentType", "root");
    _defineProperty(this, "level", 0);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.md = md;
    this.env = env;
    this.tokens = tokens;
    const s = this.src;
    for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
      const ch = s.charCodeAt(pos);
      if (!indent_found) if (isSpace(ch)) {
        indent++;
        if (ch === 9) offset += 4 - offset % 4;
        else offset++;
        continue;
      } else indent_found = true;
      if (ch === 10 || pos === len - 1) {
        if (ch !== 10) pos++;
        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        this.sCount.push(offset);
        this.bsCount.push(0);
        indent_found = false;
        indent = 0;
        offset = 0;
        start = pos + 1;
      }
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  push(type2, tag, nesting) {
    const token = new Token(type2, tag, nesting);
    token.block = true;
    if (nesting < 0) this.level--;
    token.level = this.level;
    if (nesting > 0) this.level++;
    this.tokens.push(token);
    return token;
  }
  isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  }
  skipEmptyLines(from) {
    for (let max = this.lineMax; from < max; from++) if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) break;
    return from;
  }
  skipSpaces(pos) {
    for (let max = this.src.length; pos < max; pos++) if (!isSpace(this.src.charCodeAt(pos))) break;
    return pos;
  }
  skipSpacesBack(pos, min) {
    if (pos <= min) return pos;
    while (pos > min) if (!isSpace(this.src.charCodeAt(--pos))) return pos + 1;
    return pos;
  }
  skipChars(pos, code2) {
    for (let max = this.src.length; pos < max; pos++) if (this.src.charCodeAt(pos) !== code2) break;
    return pos;
  }
  skipCharsBack(pos, code2, min) {
    if (pos <= min) return pos;
    while (pos > min) if (code2 !== this.src.charCodeAt(--pos)) return pos + 1;
    return pos;
  }
  getLines(begin, end, indent, keepLastLF) {
    if (begin >= end) return "";
    const queue = new Array(end - begin);
    for (let i = 0, line = begin; line < end; line++, i++) {
      let lineIndent = 0;
      const lineStart = this.bMarks[line];
      let first = lineStart;
      let last;
      if (line + 1 < end || keepLastLF) last = this.eMarks[line] + 1;
      else last = this.eMarks[line];
      while (first < last && lineIndent < indent) {
        const ch = this.src.charCodeAt(first);
        if (isSpace(ch)) if (ch === 9) lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
        else lineIndent++;
        else if (first - lineStart < this.tShift[line]) lineIndent++;
        else break;
        first++;
      }
      if (lineIndent > indent) queue[i] = new Array(lineIndent - indent + 1).join(" ") + this.src.slice(first, last);
      else queue[i] = this.src.slice(first, last);
    }
    return queue.join("");
  }
};
var MAX_AUTOCOMPLETED_CELLS = 65536;
function getLine(state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];
  return state.src.slice(pos, max);
}
function escapedSplit(str) {
  const result = [];
  const max = str.length;
  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = "";
  while (pos < max) {
    if (ch === 124) if (!isEscaped) {
      result.push(current + str.substring(lastPos, pos));
      current = "";
      lastPos = pos + 1;
    } else {
      current += str.substring(lastPos, pos - 1);
      lastPos = pos;
    }
    isEscaped = ch === 92;
    pos++;
    ch = str.charCodeAt(pos);
  }
  result.push(current + str.substring(lastPos));
  return result;
}
function table(state, startLine, endLine, silent) {
  if (startLine + 2 > endLine) return false;
  let nextLine = startLine + 1;
  if (state.sCount[nextLine] < state.blkIndent) return false;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) return false;
  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) return false;
  if (pos >= state.eMarks[nextLine]) return false;
  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) return false;
  if (firstCh === 45 && isSpace(secondCh)) return false;
  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) return false;
    pos++;
  }
  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split("|");
  const aligns = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t) if (i === 0 || i === columns.length - 1) continue;
    else return false;
    if (!/^:?-+:?$/.test(t)) return false;
    if (t.charCodeAt(t.length - 1) === 58) aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
    else if (t.charCodeAt(0) === 58) aligns.push("left");
    else aligns.push("");
  }
  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf("|") === -1) return false;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === "") columns.shift();
  if (columns.length && columns[columns.length - 1] === "") columns.pop();
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) return false;
  if (silent) return true;
  const oldParentType = state.parentType;
  state.parentType = "table";
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const token_to = state.push("table_open", "table", 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;
  const token_tho = state.push("thead_open", "thead", 1);
  token_tho.map = [startLine, startLine + 1];
  const token_htro = state.push("tr_open", "tr", 1);
  token_htro.map = [startLine, startLine + 1];
  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push("th_open", "th", 1);
    if (aligns[i]) token_ho.attrs = [["style", `text-align:${aligns[i]}`]];
    const token_il = state.push("inline", "", 0);
    token_il.content = columns[i].trim();
    token_il.children = [];
    state.push("th_close", "th", -1);
  }
  state.push("tr_close", "tr", -1);
  state.push("thead_close", "thead", -1);
  let tbodyLines;
  let autocompletedCells = 0;
  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    lineText = getLine(state, nextLine).trim();
    if (!lineText) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === "") columns.shift();
    if (columns.length && columns[columns.length - 1] === "") columns.pop();
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
    if (nextLine === startLine + 2) {
      const token_tbo = state.push("tbody_open", "tbody", 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }
    const token_tro = state.push("tr_open", "tr", 1);
    token_tro.map = [nextLine, nextLine + 1];
    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push("td_open", "td", 1);
      if (aligns[i]) token_tdo.attrs = [["style", `text-align:${aligns[i]}`]];
      const token_il = state.push("inline", "", 0);
      token_il.content = columns[i] ? columns[i].trim() : "";
      token_il.children = [];
      state.push("td_close", "td", -1);
    }
    state.push("tr_close", "tr", -1);
  }
  if (tbodyLines) {
    state.push("tbody_close", "tbody", -1);
    tbodyLines[1] = nextLine;
  }
  state.push("table_close", "table", -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
function code(state, startLine, endLine) {
  if (state.sCount[startLine] - state.blkIndent < 4) return false;
  let nextLine = startLine + 1;
  let last = nextLine;
  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }
  state.line = last;
  const token = state.push("code_block", "code", 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + "\n";
  token.map = [startLine, state.line];
  return true;
}
function fence(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (pos + 3 > max) return false;
  const marker = state.src.charCodeAt(pos);
  if (marker !== 126 && marker !== 96) return false;
  let mem = pos;
  pos = state.skipChars(pos, marker);
  let len = pos - mem;
  if (len < 3) return false;
  const markup = state.src.slice(mem, pos);
  const params = state.src.slice(pos, max);
  if (marker === 96) {
    if (params.indexOf(String.fromCharCode(marker)) >= 0) return false;
  }
  if (silent) return true;
  let nextLine = startLine;
  let haveEndMarker = false;
  for (; ; ) {
    nextLine++;
    if (nextLine >= endLine) break;
    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
    if (state.src.charCodeAt(pos) !== marker) continue;
    if (state.sCount[nextLine] - state.blkIndent >= 4) continue;
    pos = state.skipChars(pos, marker);
    if (pos - mem < len) continue;
    pos = state.skipSpaces(pos);
    if (pos < max) continue;
    haveEndMarker = true;
    break;
  }
  len = state.sCount[startLine];
  state.line = nextLine + (haveEndMarker ? 1 : 0);
  const token = state.push("fence", "code", 0);
  token.info = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup = markup;
  token.map = [startLine, state.line];
  return true;
}
function blockquote(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  const oldLineMax = state.lineMax;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 62) return false;
  if (silent) return true;
  const oldBMarks = [];
  const oldBSCount = [];
  const oldSCount = [];
  const oldTShift = [];
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const oldParentType = state.parentType;
  state.parentType = "blockquote";
  let lastLineEmpty = false;
  let nextLine;
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    const isOutdented = state.sCount[nextLine] < state.blkIndent;
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos >= max) break;
    if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;
      if (state.src.charCodeAt(pos) === 32) {
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 9) {
        spaceAfterMarker = true;
        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          pos++;
          initial++;
          adjustTab = false;
        } else adjustTab = true;
      } else spaceAfterMarker = false;
      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;
      while (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (isSpace(ch)) if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
        else offset++;
        else break;
        pos++;
      }
      lastLineEmpty = pos >= max;
      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;
      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }
    if (lastLineEmpty) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) {
      state.lineMax = nextLine;
      if (state.blkIndent !== 0) {
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }
      break;
    }
    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);
    state.sCount[nextLine] = -1;
  }
  const oldIndent = state.blkIndent;
  state.blkIndent = 0;
  const token_o = state.push("blockquote_open", "blockquote", 1);
  token_o.markup = ">";
  const lines = [startLine, 0];
  token_o.map = lines;
  state.md.block.tokenize(state, startLine, nextLine);
  const token_c = state.push("blockquote_close", "blockquote", -1);
  token_c.markup = ">";
  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;
  return true;
}
function hr(state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 95) return false;
  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) return false;
    if (ch === marker) cnt++;
  }
  if (cnt < 3) return false;
  if (silent) return true;
  state.line = startLine + 1;
  const token = state.push("hr", "hr", 0);
  token.map = [startLine, state.line];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
  return true;
}
function skipBulletListMarker(state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 43) return -1;
  if (pos < max) {
    if (!isSpace(state.src.charCodeAt(pos))) return -1;
  }
  return pos;
}
function skipOrderedListMarker(state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;
  if (pos + 1 >= max) return -1;
  let ch = state.src.charCodeAt(pos++);
  if (ch < 48 || ch > 57) return -1;
  for (; ; ) {
    if (pos >= max) return -1;
    ch = state.src.charCodeAt(pos++);
    if (ch >= 48 && ch <= 57) {
      if (pos - start >= 10) return -1;
      continue;
    }
    if (ch === 41 || ch === 46) break;
    return -1;
  }
  if (pos < max) {
    ch = state.src.charCodeAt(pos);
    if (!isSpace(ch)) return -1;
  }
  return pos;
}
function markTightParagraphs(state, idx) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
    state.tokens[i + 2].hidden = true;
    state.tokens[i].hidden = true;
    i += 2;
  }
}
function list(state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) return false;
  let isTerminatingParagraph = false;
  if (silent && state.parentType === "paragraph") {
    if (state.sCount[nextLine] >= state.blkIndent) isTerminatingParagraph = true;
  }
  let isOrdered;
  let markerValue;
  let posAfterMarker;
  if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));
    if (isTerminatingParagraph && markerValue !== 1) return false;
  } else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) isOrdered = false;
  else return false;
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false;
  }
  if (silent) return true;
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
  const listTokIdx = state.tokens.length;
  if (isOrdered) {
    token = state.push("ordered_list_open", "ol", 1);
    if (markerValue !== 1) token.attrs = [["start", markerValue]];
  } else token = state.push("bullet_list_open", "ul", 1);
  const listLines = [nextLine, 0];
  token.map = listLines;
  token.markup = String.fromCharCode(markerCharCode);
  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules("list");
  const oldParentType = state.parentType;
  state.parentType = "list";
  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];
    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      else if (ch === 32) offset++;
      else break;
      pos++;
    }
    const contentStart = pos;
    let indentAfterMarker;
    if (contentStart >= max) indentAfterMarker = 1;
    else indentAfterMarker = offset - initial;
    if (indentAfterMarker > 4) indentAfterMarker = 1;
    const indent = initial + indentAfterMarker;
    token = state.push("list_item_open", "li", 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines = [nextLine, 0];
    token.map = itemLines;
    if (isOrdered) token.info = state.src.slice(start, posAfterMarker - 1);
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;
    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;
    if (contentStart >= max && state.isEmpty(nextLine + 1)) state.line = Math.min(state.line + 2, endLine);
    else state.md.block.tokenize(state, nextLine, endLine);
    if (!state.tight || prevEmptyEnd) tight = false;
    prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;
    token = state.push("list_item_close", "li", -1);
    token.markup = String.fromCharCode(markerCharCode);
    nextLine = state.line;
    itemLines[1] = nextLine;
    if (nextLine >= endLine) break;
    if (state.sCount[nextLine] < state.blkIndent) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
    }
    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) break;
  }
  if (isOrdered) token = state.push("ordered_list_close", "ol", -1);
  else token = state.push("bullet_list_close", "ul", -1);
  token.markup = String.fromCharCode(markerCharCode);
  listLines[1] = nextLine;
  state.line = nextLine;
  state.parentType = oldParentType;
  if (tight) markTightParagraphs(state, listTokIdx);
  return true;
}
function reference(state, startLine, _endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  let nextLine = startLine + 1;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 91) return false;
  function getNextLine(nextLine2) {
    const endLine = state.lineMax;
    if (nextLine2 >= endLine || state.isEmpty(nextLine2)) return null;
    let isContinuation = false;
    if (state.sCount[nextLine2] - state.blkIndent > 3) isContinuation = true;
    if (state.sCount[nextLine2] < 0) isContinuation = true;
    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules("reference");
      const oldParentType = state.parentType;
      state.parentType = "reference";
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine2, endLine, true)) {
        terminate = true;
        break;
      }
      state.parentType = oldParentType;
      if (terminate) return null;
    }
    const pos2 = state.bMarks[nextLine2] + state.tShift[nextLine2];
    const max2 = state.eMarks[nextLine2];
    return state.src.slice(pos2, max2 + 1);
  }
  let str = state.src.slice(pos, max + 1);
  max = str.length;
  let labelEnd = -1;
  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 91) return false;
    else if (ch === 93) {
      labelEnd = pos;
      break;
    } else if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (ch === 92) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      }
    }
  }
  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 58) return false;
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) {
    } else break;
  }
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
  if (!destRes.ok) return false;
  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href)) return false;
  pos = destRes.pos;
  const destEndPos = pos;
  const destEndLineNo = nextLine;
  const start = pos;
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) {
    } else break;
  }
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine);
    if (lineContent === null) break;
    str += lineContent;
    pos = max;
    max = str.length;
    nextLine++;
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
  }
  let title;
  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = "";
    pos = destEndPos;
    nextLine = destEndLineNo;
  }
  while (pos < max) {
    if (!isSpace(str.charCodeAt(pos))) break;
    pos++;
  }
  if (pos < max && str.charCodeAt(pos) !== 10) {
    if (title) {
      title = "";
      pos = destEndPos;
      nextLine = destEndLineNo;
      while (pos < max) {
        if (!isSpace(str.charCodeAt(pos))) break;
        pos++;
      }
    }
  }
  if (pos < max && str.charCodeAt(pos) !== 10) return false;
  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label) return false;
  if (silent) return true;
  if (typeof state.env.references === "undefined") state.env.references = {};
  if (typeof state.env.references[label] === "undefined") state.env.references[label] = {
    title,
    href
  };
  const token = state.push("reference_definition", "", 0);
  token.map = [startLine, nextLine];
  token.hidden = true;
  const meta = /* @__PURE__ */ Object.create(null);
  meta.label = label;
  token.meta = meta;
  state.line = nextLine;
  return true;
}
var html_blocks_default = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var open_tag = `<[A-Za-z][A-Za-z0-9\\-]*(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?)*\\s*\\/?>`;
var close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
var HTML_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag}|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<[?][\\s\\S]*?[?]>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`);
var HTML_OPEN_CLOSE_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag})`);
var HTML_SEQUENCES = [
  [
    /^<(script|pre|style|textarea)(?=(\s|>|$))/i,
    /<\/(script|pre|style|textarea)>/i,
    true
  ],
  [
    /^<!--/,
    /-->/,
    true
  ],
  [
    /^<\?/,
    /\?>/,
    true
  ],
  [
    /^<![A-Za-z]/,
    />/,
    true
  ],
  [
    /^<!\[CDATA\[/,
    /\]\]>/,
    true
  ],
  [
    new RegExp(`^</?(${html_blocks_default.join("|")})(?=(\\s|/?>|$))`, "i"),
    /^$/,
    true
  ],
  [
    new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`),
    /^$/,
    false
  ]
];
function html_block(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (!state.md.options.html) return false;
  if (state.src.charCodeAt(pos) !== 60) return false;
  let lineText = state.src.slice(pos, max);
  let i = 0;
  for (; i < HTML_SEQUENCES.length; i++) if (HTML_SEQUENCES[i][0].test(lineText)) break;
  if (i === HTML_SEQUENCES.length) return false;
  if (silent) return HTML_SEQUENCES[i][2];
  let nextLine = startLine + 1;
  const endsOnBlankLine = HTML_SEQUENCES[i][1].test("");
  if (!HTML_SEQUENCES[i][1].test(lineText)) for (; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) {
      if (endsOnBlankLine || !state.isEmpty(nextLine)) break;
    }
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    lineText = state.src.slice(pos, max);
    if (HTML_SEQUENCES[i][1].test(lineText)) {
      if (lineText.length !== 0) nextLine++;
      break;
    }
  }
  state.line = nextLine;
  const token = state.push("html_block", "", 0);
  token.map = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
  return true;
}
function heading(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let ch = state.src.charCodeAt(pos);
  if (ch !== 35 || pos >= max) return false;
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 35 && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }
  if (level > 6 || pos < max && !isSpace(ch)) return false;
  if (silent) return true;
  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 35, pos);
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) max = tmp;
  state.line = startLine + 1;
  const token_o = state.push("heading_open", `h${level}`, 1);
  token_o.markup = "########".slice(0, level);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = asciiTrim(state.src.slice(pos, max));
  token_i.map = [startLine, state.line];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${level}`, -1);
  token_c.markup = "########".slice(0, level);
  return true;
}
function lheading(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const oldParentType = state.parentType;
  state.parentType = "paragraph";
  let level = 0;
  let marker;
  let nextLine = startLine + 1;
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (pos < max) {
        marker = state.src.charCodeAt(pos);
        if (marker === 45 || marker === 61) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);
          if (pos >= max) {
            level = marker === 61 ? 1 : 2;
            break;
          }
        }
      }
    }
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  if (!level) {
    state.parentType = oldParentType;
    return false;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine + 1;
  const token_o = state.push("heading_open", `h${level}`, 1);
  token_o.markup = String.fromCharCode(marker);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line - 1];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${level}`, -1);
  token_c.markup = String.fromCharCode(marker);
  state.parentType = oldParentType;
  return true;
}
function paragraph(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = "paragraph";
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine;
  const token_o = state.push("paragraph_open", "p", 1);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line];
  token_i.children = [];
  state.push("paragraph_close", "p", -1);
  state.parentType = oldParentType;
  return true;
}
var _rules$1 = [
  [
    "table",
    table,
    ["paragraph", "reference"]
  ],
  ["code", code],
  [
    "fence",
    fence,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "blockquote",
    blockquote,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "hr",
    hr,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "list",
    list,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["reference", reference],
  [
    "html_block",
    html_block,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  [
    "heading",
    heading,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["lheading", lheading],
  ["paragraph", paragraph]
];
var ParserBlock = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of block rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(this, "State", StateBlock);
    for (let i = 0; i < _rules$1.length; i++) this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
  }
  tokenize(state, startLine, endLine) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    let line = startLine;
    let hasEmptyLines = false;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) break;
      if (state.sCount[line] < state.blkIndent) break;
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }
      const prevLine = state.line;
      let ok = false;
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) {
          if (prevLine >= state.line) throw new Error("block rule didn't increment state.line");
          break;
        }
      }
      if (!ok) throw new Error("none of the block rules matched");
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1)) hasEmptyLines = true;
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  }
  /**
  * Process input string and push block tokens into `outTokens`
  */
  parse(src, md, env, outTokens) {
    if (!src) return;
    const state = new this.State(src, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  }
};
var StateInline = class {
  constructor(src, md, env, outTokens) {
    _defineProperty(this, "pos", 0);
    _defineProperty(this, "level", 0);
    _defineProperty(this, "pending", "");
    _defineProperty(this, "pendingLevel", 0);
    _defineProperty(this, "cache", {});
    _defineProperty(this, "backticks", {});
    _defineProperty(this, "backticksScanned", false);
    _defineProperty(this, "linkLevel", 0);
    _defineProperty(this, "delimiters", []);
    _defineProperty(this, "_prev_delimiters", []);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = Array(outTokens.length);
    this.posMax = this.src.length;
  }
  pushPending() {
    const token = new Token("text", "", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }
  push(type2, tag, nesting) {
    if (this.pending) this.pushPending();
    const token = new Token(type2, tag, nesting);
    let token_meta = void 0;
    if (nesting < 0) {
      this.level--;
      this.delimiters = this._prev_delimiters.pop();
    }
    token.level = this.level;
    if (nesting > 0) {
      this.level++;
      this._prev_delimiters.push(this.delimiters);
      this.delimiters = [];
      token_meta = { delimiters: this.delimiters };
    }
    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokens_meta.push(token_meta);
    return token;
  }
  scanDelims(start, canSplitWord) {
    const max = this.posMax;
    const marker = this.src.charCodeAt(start);
    let lastChar;
    if (start === 0) lastChar = 32;
    else if (start === 1) {
      lastChar = this.src.charCodeAt(0);
      if ((lastChar & 63488) === 55296) lastChar = 65533;
    } else {
      lastChar = this.src.charCodeAt(start - 1);
      if ((lastChar & 64512) === 56320) {
        const highSurr = this.src.charCodeAt(start - 2);
        lastChar = (highSurr & 64512) === 55296 ? 65536 + (highSurr - 55296 << 10) + (lastChar - 56320) : 65533;
      } else if ((lastChar & 64512) === 55296) lastChar = 65533;
    }
    let pos = start;
    while (pos < max && this.src.charCodeAt(pos) === marker) pos++;
    const count = pos - start;
    let nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
    if ((nextChar & 64512) === 55296) {
      const lowSurr = this.src.charCodeAt(pos + 1);
      nextChar = (lowSurr & 64512) === 56320 ? 65536 + (nextChar - 55296 << 10) + (lowSurr - 56320) : 65533;
    } else if ((nextChar & 64512) === 56320) nextChar = 65533;
    const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
    const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
    const isLastWhiteSpace = isWhiteSpace(lastChar);
    const isNextWhiteSpace = isWhiteSpace(nextChar);
    const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
    const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
    return {
      can_open: left_flanking && (canSplitWord || !right_flanking || isLastPunctChar),
      can_close: right_flanking && (canSplitWord || !left_flanking || isNextPunctChar),
      length: count
    };
  }
};
function isTerminatorChar(ch) {
  switch (ch) {
    case 10:
    case 33:
    case 35:
    case 36:
    case 37:
    case 38:
    case 42:
    case 43:
    case 45:
    case 58:
    case 60:
    case 61:
    case 62:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function text(state, silent) {
  let pos = state.pos;
  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) pos++;
  if (pos === state.pos) return false;
  if (!silent) state.pending += state.src.slice(state.pos, pos);
  state.pos = pos;
  return true;
}
var SCHEME_RE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;
function linkify(state, silent) {
  if (!state.md.options.linkify) return false;
  if (state.linkLevel > 0) return false;
  const pos = state.pos;
  const max = state.posMax;
  if (pos + 3 > max) return false;
  if (state.src.charCodeAt(pos) !== 58) return false;
  if (state.src.charCodeAt(pos + 1) !== 47) return false;
  if (state.src.charCodeAt(pos + 2) !== 47) return false;
  const match = state.pending.match(SCHEME_RE);
  if (!match) return false;
  const proto = match[1];
  const link2 = state.md.linkify.matchAtStart(state.src.slice(pos - proto.length));
  if (!link2) return false;
  let url = link2.url;
  if (url.length <= proto.length) return false;
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 42) urlEnd--;
  if (urlEnd !== url.length) url = url.slice(0, urlEnd);
  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl)) return false;
  if (!silent) {
    state.pending = state.pending.slice(0, -proto.length);
    const token_o = state.push("link_open", "a", 1);
    token_o.attrs = [["href", fullUrl]];
    token_o.markup = "linkify";
    token_o.info = "auto";
    const token_t = state.push("text", "", 0);
    token_t.content = state.md.normalizeLinkText(url);
    const token_c = state.push("link_close", "a", -1);
    token_c.markup = "linkify";
    token_c.info = "auto";
  }
  state.pos += url.length - proto.length;
  return true;
}
function newline(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 10) return false;
  const pmax = state.pending.length - 1;
  const max = state.posMax;
  if (!silent) if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
    let ws = pmax - 1;
    while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32) ws--;
    state.pending = state.pending.slice(0, ws);
    state.push("hardbreak", "br", 0);
  } else {
    state.pending = state.pending.slice(0, -1);
    state.push("softbreak", "br", 0);
  }
  else state.push("softbreak", "br", 0);
  pos++;
  while (pos < max && isSpace(state.src.charCodeAt(pos))) pos++;
  state.pos = pos;
  return true;
}
var ESCAPED = [];
for (let i = 0; i < 256; i++) ESCAPED.push(0);
"\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
  ESCAPED[ch.charCodeAt(0)] = 1;
});
function escape(state, silent) {
  let pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 92) return false;
  pos++;
  if (pos >= max) return false;
  let ch1 = state.src.charCodeAt(pos);
  if (ch1 === 10) {
    if (!silent) state.push("hardbreak", "br", 0);
    pos++;
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1)) break;
      pos++;
    }
    state.pos = pos;
    return true;
  }
  if (ch1 === 32) {
    if (!silent) {
      const token = state.push("text_special", "", 0);
      token.content = "\\";
      token.markup = "\\";
      token.info = "escape";
    }
    state.pos = pos;
    return true;
  }
  let escapedStr = state.src[pos];
  if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);
    if (ch2 >= 56320 && ch2 <= 57343) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }
  const origStr = "\\" + escapedStr;
  if (!silent) {
    const token = state.push("text_special", "", 0);
    if (ch1 < 256 && ESCAPED[ch1] !== 0) token.content = escapedStr;
    else token.content = origStr;
    token.markup = origStr;
    token.info = "escape";
  }
  state.pos = pos + 1;
  return true;
}
function backtick(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 96) return false;
  const start = pos;
  pos++;
  const max = state.posMax;
  while (pos < max && state.src.charCodeAt(pos) === 96) pos++;
  const marker = state.src.slice(start, pos);
  const openerLength = marker.length;
  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent) state.pending += marker;
    state.pos += openerLength;
    return true;
  }
  let matchEnd = pos;
  let matchStart;
  while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1) {
    matchEnd = matchStart + 1;
    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 96) matchEnd++;
    const closerLength = matchEnd - matchStart;
    if (closerLength === openerLength) {
      if (!silent) {
        const token = state.push("code_inline", "code", 0);
        token.markup = marker;
        token.content = state.src.slice(pos, matchStart).replace(/\n/g, " ").replace(/^ (.+) $/, "$1");
      }
      state.pos = matchEnd;
      return true;
    }
    state.backticks[closerLength] = matchStart;
  }
  state.backticksScanned = true;
  if (!silent) state.pending += marker;
  state.pos += openerLength;
  return true;
}
function strikethrough_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 126) return false;
  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);
  if (len < 2) return false;
  let token;
  if (len % 2) {
    token = state.push("text", "", 0);
    token.content = ch;
    len--;
  }
  for (let i = 0; i < len; i += 2) {
    token = state.push("text", "", 0);
    token.content = ch + ch;
    state.delimiters.push({
      marker,
      length: 0,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess$1(state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;
  for (let i = 0; i < max; i++) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 126) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    token = state.tokens[startDelim.token];
    token.type = "s_open";
    token.tag = "s";
    token.nesting = 1;
    token.markup = "~~";
    token.content = "";
    token = state.tokens[endDelim.token];
    token.type = "s_close";
    token.tag = "s";
    token.nesting = -1;
    token.markup = "~~";
    token.content = "";
    if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") loneMarkers.push(endDelim.token - 1);
  }
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;
    while (j < state.tokens.length && state.tokens[j].type === "s_close") j++;
    j--;
    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}
function strikethrough_postProcess(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess$1(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) postProcess$1(state, delimiters);
  }
}
var strikethrough_default = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};
function emphasis_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 95 && marker !== 42) return false;
  const scanned = state.scanDelims(state.pos, marker === 42);
  for (let i = 0; i < scanned.length; i++) {
    const token = state.push("text", "", 0);
    token.content = String.fromCharCode(marker);
    state.delimiters.push({
      marker,
      length: scanned.length,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess(state, delimiters) {
  const max = delimiters.length;
  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 95 && startDelim.marker !== 42) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
    const ch = String.fromCharCode(startDelim.marker);
    const token_o = state.tokens[startDelim.token];
    token_o.type = isStrong ? "strong_open" : "em_open";
    token_o.tag = isStrong ? "strong" : "em";
    token_o.nesting = 1;
    token_o.markup = isStrong ? ch + ch : ch;
    token_o.content = "";
    const token_c = state.tokens[endDelim.token];
    token_c.type = isStrong ? "strong_close" : "em_close";
    token_c.tag = isStrong ? "strong" : "em";
    token_c.nesting = -1;
    token_c.markup = isStrong ? ch + ch : ch;
    token_c.content = "";
    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = "";
      state.tokens[delimiters[startDelim.end + 1].token].content = "";
      i--;
    }
  }
}
function emphasis_post_process(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) postProcess(state, delimiters);
  }
}
var emphasis_default = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};
function link(state, silent) {
  let code2, label, res, ref;
  let href = "";
  let title = "";
  let start = state.pos;
  let parseReference = true;
  if (state.src.charCodeAt(state.pos) !== 91) return false;
  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
  if (labelEnd < 0) return false;
  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    parseReference = false;
    pos++;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
      start = pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) break;
      }
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;
        for (; pos < max; pos++) {
          code2 = state.src.charCodeAt(pos);
          if (!isSpace(code2) && code2 !== 10) break;
        }
      }
    }
    if (pos >= max || state.src.charCodeAt(pos) !== 41) parseReference = true;
    pos++;
  }
  if (parseReference) {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    label = normalizeReference(label);
    ref = state.env.references[label];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;
    const token_o = state.push("link_open", "a", 1);
    const attrs = [["href", href]];
    token_o.attrs = attrs;
    if (title) attrs.push(["title", title]);
    if (label) {
      const meta = /* @__PURE__ */ Object.create(null);
      meta.label = label;
      token_o.meta = meta;
    }
    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;
    state.push("link_close", "a", -1);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
function image(state, silent) {
  let code2, content, label, pos, ref, res, title, start;
  let href = "";
  const oldPos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(state.pos) !== 33) return false;
  if (state.src.charCodeAt(state.pos + 1) !== 91) return false;
  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
  if (labelEnd < 0) return false;
  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    pos++;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
    }
    start = pos;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) break;
      }
    } else title = "";
    if (pos >= max || state.src.charCodeAt(pos) !== 41) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    label = normalizeReference(label);
    ref = state.env.references[label];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);
    const tokens = [];
    state.md.inline.parse(content, state.md, state.env, tokens);
    const token = state.push("image", "img", 0);
    const attrs = [["src", href], ["alt", ""]];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;
    if (title) attrs.push(["title", title]);
    if (label) {
      const meta = /* @__PURE__ */ Object.create(null);
      meta.label = label;
      token.meta = meta;
    }
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
var EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
var AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
function autolink(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60) return false;
  const start = state.pos;
  const max = state.posMax;
  for (; ; ) {
    if (++pos >= max) return false;
    const ch = state.src.charCodeAt(pos);
    if (ch === 60) return false;
    if (ch === 62) break;
  }
  const url = state.src.slice(start + 1, pos);
  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(`mailto:${url}`);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  return false;
}
function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}
function isLetter(ch) {
  const lc = ch | 32;
  return lc >= 97 && lc <= 122;
}
function html_inline(state, silent) {
  if (!state.md.options.html) return false;
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) return false;
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter(ch)) return false;
  const match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) return false;
  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = match[0];
    if (isLinkOpen(token.content)) state.linkLevel++;
    if (isLinkClose(token.content)) state.linkLevel--;
  }
  state.pos += match[0].length;
  return true;
}
var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
function entity(state, silent) {
  const pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 38) return false;
  if (pos + 1 >= max) return false;
  if (state.src.charCodeAt(pos + 1) === 35) {
    const match = state.src.slice(pos).match(DIGITAL_RE);
    if (match) {
      if (!silent) {
        const code2 = match[1][0].toLowerCase() === "x" ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
        const token = state.push("text_special", "", 0);
        token.content = isValidEntityCode(code2) ? fromCodePoint(code2) : fromCodePoint(65533);
        token.markup = match[0];
        token.info = "entity";
      }
      state.pos += match[0].length;
      return true;
    }
  } else {
    const match = state.src.slice(pos).match(NAMED_RE);
    if (match) {
      const decoded = decodeHTMLStrict(match[0]);
      if (decoded !== match[0]) {
        if (!silent) {
          const token = state.push("text_special", "", 0);
          token.content = decoded;
          token.markup = match[0];
          token.info = "entity";
        }
        state.pos += match[0].length;
        return true;
      }
    }
  }
  return false;
}
function processDelimiters(delimiters) {
  const openersBottom = {};
  const max = delimiters.length;
  if (!max) return;
  let headerIdx = 0;
  let lastTokenIdx = -2;
  const jumps = [];
  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];
    jumps.push(0);
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) headerIdx = closerIdx;
    lastTokenIdx = closer.token;
    closer.length = closer.length || 0;
    if (!closer.close) continue;
    if (!openersBottom.hasOwnProperty(closer.marker)) openersBottom[closer.marker] = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
    let openerIdx = headerIdx - jumps[headerIdx] - 1;
    let newMinOpenerIdx = openerIdx;
    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];
      if (opener.marker !== closer.marker) continue;
      if (opener.open && opener.end < 0) {
        let isOddMatch = false;
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) isOddMatch = true;
          }
        }
        if (!isOddMatch) {
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;
          closer.open = false;
          opener.end = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          lastTokenIdx = -2;
          break;
        }
      }
    }
    if (newMinOpenerIdx !== -1) openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
  }
}
function link_pairs(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  processDelimiters(state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) processDelimiters(delimiters);
  }
}
function fragments_join(state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;
  for (curr = last = 0; curr < max; curr++) {
    if (tokens[curr].nesting < 0) level--;
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++;
    if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
  }
  if (curr !== last) tokens.length = last;
}
var _rules = [
  ["text", text],
  ["linkify", linkify],
  ["newline", newline],
  ["escape", escape],
  ["backticks", backtick],
  ["strikethrough", strikethrough_default.tokenize],
  ["emphasis", emphasis_default.tokenize],
  ["link", link],
  ["image", image],
  ["autolink", autolink],
  ["html_inline", html_inline],
  ["entity", entity]
];
var _rules2 = [
  ["balance_pairs", link_pairs],
  ["strikethrough", strikethrough_default.postProcess],
  ["emphasis", emphasis_default.postProcess],
  ["fragments_join", fragments_join]
];
var ParserInline = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of inline rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Second ruler used for post-processing
      * (e.g. in emphasis-like rules).
      */
      "ruler2",
      new Ruler()
    );
    _defineProperty(this, "State", StateInline);
    for (let i = 0; i < _rules.length; i++) this.ruler.push(_rules[i][0], _rules[i][1]);
    for (let i = 0; i < _rules2.length; i++) this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
  skipToken(state) {
    const pos = state.pos;
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    const cache = state.cache;
    if (typeof cache[pos] !== "undefined") {
      state.pos = cache[pos];
      return;
    }
    let ok = false;
    if (state.level < maxNesting) for (let i = 0; i < len; i++) {
      state.level++;
      ok = rules[i](state, true);
      state.level--;
      if (ok) {
        if (pos >= state.pos) throw new Error("inline rule didn't increment state.pos");
        break;
      }
    }
    else state.pos = state.posMax;
    if (!ok) state.pos++;
    cache[pos] = state.pos;
  }
  tokenize(state) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const end = state.posMax;
    const maxNesting = state.md.options.maxNesting;
    while (state.pos < end) {
      const prevPos = state.pos;
      let ok = false;
      if (state.level < maxNesting) for (let i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) {
          if (prevPos >= state.pos) throw new Error("inline rule didn't increment state.pos");
          break;
        }
      }
      if (ok) {
        if (state.pos >= end) break;
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending) state.pushPending();
  }
  /**
  * Process input string and push inline tokens into `outTokens`
  */
  parse(str, md, env, outTokens) {
    const state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    const rules = this.ruler2.getRules("");
    const len = rules.length;
    for (let i = 0; i < len; i++) rules[i](state);
  }
};
var config = {
  default: {
    options: {
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 100
    },
    components: {
      core: {},
      block: {},
      inline: {}
    }
  },
  zero: {
    options: {
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 20
    },
    components: {
      core: { rules: [
        "normalize",
        "block",
        "strip_references",
        "inline",
        "text_join"
      ] },
      block: { rules: ["paragraph"] },
      inline: {
        rules: ["text"],
        rules2: ["balance_pairs", "fragments_join"]
      }
    }
  },
  commonmark: {
    options: {
      html: true,
      xhtmlOut: true,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 20
    },
    components: {
      core: { rules: [
        "normalize",
        "block",
        "strip_references",
        "inline",
        "text_join"
      ] },
      block: { rules: [
        "blockquote",
        "code",
        "fence",
        "heading",
        "hr",
        "html_block",
        "lheading",
        "list",
        "reference",
        "paragraph"
      ] },
      inline: {
        rules: [
          "autolink",
          "backticks",
          "emphasis",
          "entity",
          "escape",
          "html_inline",
          "image",
          "link",
          "newline",
          "text"
        ],
        rules2: [
          "balance_pairs",
          "emphasis",
          "fragments_join"
        ]
      }
    }
  }
};
var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
var RECODE_HOSTNAME_FOR = [
  "http:",
  "https:",
  "mailto:"
];
var MarkdownIt = class {
  /**
  * Link validation function. CommonMark allows too much in links. By default
  * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
  * except some embedded image types.
  *
  * You can change this behaviour:
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * // enable everything
  * md.validateLink = function () { return true; }
  * ```
  */
  validateLink(url) {
    const str = url.trim().toLowerCase();
    return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
  }
  /**
  * Function used to encode link url to a machine-readable format,
  * which includes url-encoding, punycode, etc.
  */
  normalizeLink(url) {
    const parsed = parse_default(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
        parsed.hostname = punycode_es6_default.toASCII(parsed.hostname);
      } catch (er) {
      }
    }
    return encode_default(format(parsed));
  }
  /**
  * Function used to decode link url to a human-readable format`
  */
  normalizeLinkText(url) {
    const parsed = parse_default(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
        parsed.hostname = punycode_es6_default.toUnicode(parsed.hostname);
      } catch (er) {
      }
    }
    return decode_default(format(parsed), decode_default.defaultChars + "%");
  }
  constructor(...args) {
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserInline}. You may need it to add new rules when
      * writing plugins. For simple rules control use {@link MarkdownIt.disable}
      * and {@link MarkdownIt.enable}.
      */
      "inline",
      new ParserInline()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserBlock}. You may need it to add new rules when
      * writing plugins. For simple rules control use {@link MarkdownIt.disable}
      * and {@link MarkdownIt.enable}.
      */
      "block",
      new ParserBlock()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserCore} chain executor. You may need it to add new
      * rules when writing plugins. For simple rules control use
      * {@link MarkdownIt.disable} and {@link MarkdownIt.enable}.
      */
      "core",
      new ParserCore()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link Renderer}. Use it to modify output look. Or to add rendering
      * rules for new token types, generated by plugins.
      *
      * See {@link Renderer} docs and
      * [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts).
      *
      * @example
      * ```javascript
      * import MarkdownIt from 'markdown-it'
      * const md = new MarkdownIt()
      *
      * function myToken(tokens, idx, options, env, self) {
      *   //...
      *   return result;
      * };
      *
      * md.renderer.rules['my_token'] = myToken
      * ```
      */
      "renderer",
      new Renderer()
    );
    _defineProperty(
      this,
      /**
      * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
      * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/src/rules_core/linkify.ts)
      * rule.
      */
      "linkify",
      new LinkifyIt()
    );
    _defineProperty(
      this,
      /**
      * Assorted utility functions, useful to write plugins. See details
      * [here](https://github.com/markdown-it/markdown-it/blob/master/src/common/utils.ts).
      */
      "utils",
      utils_exports
    );
    _defineProperty(
      this,
      /**
      * Link components parser functions, useful to write plugins. See details
      * [here](https://github.com/markdown-it/markdown-it/blob/master/src/helpers).
      */
      "helpers",
      Object.assign({}, helpers_exports)
    );
    const [presetNameOrOptions, options] = args;
    if (typeof presetNameOrOptions === "string") {
      this.configure(presetNameOrOptions);
      if (options) this.set(options);
    } else {
      this.configure("default");
      this.set(presetNameOrOptions || {});
    }
  }
  /**
  * Set parser options (in the same format as in constructor). Probably, you
  * will never need it, but you can change options after constructor call.
  *
  * __Note:__ To achieve the best possible performance, don't modify a
  * `markdown-it` instance options on the fly. If you need multiple configurations
  * it's best to create multiple instances and initialize each with separate
  * config.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  *
  * const md = new MarkdownIt()
  *   .set({ html: true, breaks: true })
  *   .set({ typographer: true })
  * ```
  */
  set(options) {
    Object.assign(this.options, options);
    return this;
  }
  /**
  * Batch load of all options and compenent settings. This is internal method,
  * and you probably will not need it. But if you will - see available presets
  * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/src/presets)
  *
  * We strongly recommend to use presets instead of direct config loads. That
  * will give better compatibility with next versions.
  */
  configure(presets) {
    let p;
    if (typeof presets === "string") {
      const presetName = presets;
      p = config[presetName];
      if (!p) throw new Error(`Wrong 'markdown-it' preset "${presetName}", check name`);
    } else p = presets;
    if (!p) throw new Error("Wrong `markdown-it` preset, can't be empty");
    if (p.options) this.options = { ...p.options };
    const components = p.components;
    if (components) {
      var _components$inline;
      [
        "core",
        "block",
        "inline"
      ].forEach((name) => {
        var _components$name;
        const rules = (_components$name = components[name]) === null || _components$name === void 0 ? void 0 : _components$name.rules;
        if (rules) this[name].ruler.enableOnly(rules);
      });
      const rules2 = (_components$inline = components.inline) === null || _components$inline === void 0 ? void 0 : _components$inline.rules2;
      if (rules2) this.inline.ruler2.enableOnly(rules2);
    }
    return this;
  }
  /**
  * Enable list or rules. It will automatically find appropriate components,
  * containing rules with given names. If rule not found, and `ignoreInvalid`
  * not set - throws exception.
  *
  * @param list Rule name or list of rule names to enable.
  * @param ignoreInvalid Set `true` to ignore errors when rule not found.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  *
  * const md = new MarkdownIt()
  *   .enable(['sub', 'sup'])
  *   .disable('smartquotes')
  * ```
  */
  enable(list2, ignoreInvalid = false) {
    let result = [];
    if (!Array.isArray(list2)) list2 = [list2];
    [
      "core",
      "block",
      "inline"
    ].forEach((chain) => {
      result = result.concat(this[chain].ruler.enable(list2, true));
    });
    result = result.concat(this.inline.ruler2.enable(list2, true));
    const missed = list2.filter((name) => result.indexOf(name) < 0);
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to enable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * The same as {@link MarkdownIt.enable}, but turn specified rules off.
  *
  * @param list Rule name or list of rule names to disable.
  * @param ignoreInvalid Set `true` to ignore errors when rule not found.
  */
  disable(list2, ignoreInvalid = false) {
    let result = [];
    if (!Array.isArray(list2)) list2 = [list2];
    [
      "core",
      "block",
      "inline"
    ].forEach((chain) => {
      result = result.concat(this[chain].ruler.disable(list2, true));
    });
    result = result.concat(this.inline.ruler2.disable(list2, true));
    const missed = list2.filter((name) => result.indexOf(name) < 0);
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to disable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * Load specified plugin with given params into current parser instance.
  * It's just a sugar to call `plugin(md, params)` with curring.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * import iterator from 'markdown-it-for-inline'
  *
  * const md = new MarkdownIt()
  *   .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
  *     tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar')
  *   })
  * ```
  */
  use(plugin, ...params) {
    plugin.apply(plugin, [this, ...params]);
    return this;
  }
  /**
  * Parse input string and return list of block tokens (special token type
  * "inline" will contain list of inline tokens). You should not call this
  * method directly, until you write custom renderer (for example, to produce
  * AST).
  *
  * `env` is used to pass data between "distributed" rules and return additional
  * metadata like reference info, needed for the renderer. It also can be used to
  * inject data in specific cases. Usually, you will be ok to pass `{}`,
  * and then pass updated object to renderer.
  *
  * @param src Source string.
  * @param env Environment sandbox.
  */
  parse(src, env) {
    if (typeof src !== "string") throw new Error("Input data should be a String");
    const state = new this.core.State(src, this, env);
    this.core.process(state);
    return state.tokens;
  }
  /**
  * Render markdown string into html. It does all magic for you :).
  *
  * `env` can be used to inject additional metadata (`{}` by default).
  * But you will not need it with high probability. See also comment
  * in {@link MarkdownIt.parse}.
  *
  * @param src Source string.
  * @param env Environment sandbox.
  */
  render(src, env = {}) {
    return this.renderer.render(this.parse(src, env), this.options, env);
  }
  /**
  * The same as {@link MarkdownIt.parse} but skip all block rules. It returns
  * the block tokens list with the single `inline` element, containing parsed
  * inline tokens in `children` property. Also updates `env` object.
  *
  * @param src Source string.
  * @param env Environment sandbox.
  */
  parseInline(src, env) {
    const state = new this.core.State(src, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  }
  /**
  * Similar to {@link MarkdownIt.render} but for single paragraph content.
  * Result will NOT be wrapped into `<p>` tags.
  *
  * @param src Source string.
  * @param env Environment sandbox.
  */
  renderInline(src, env = {}) {
    return this.renderer.render(this.parseInline(src, env), this.options, env);
  }
};
_defineProperty(MarkdownIt, "Token", Token);
_defineProperty(MarkdownIt, "Ruler", Ruler);
_defineProperty(MarkdownIt, "Renderer", Renderer);
_defineProperty(MarkdownIt, "ParserCore", ParserCore);
_defineProperty(MarkdownIt, "StateCore", StateCore);
_defineProperty(MarkdownIt, "ParserBlock", ParserBlock);
_defineProperty(MarkdownIt, "StateBlock", StateBlock);
_defineProperty(MarkdownIt, "ParserInline", ParserInline);
_defineProperty(MarkdownIt, "StateInline", StateInline);
var MarkdownItCallable = callable(MarkdownIt);

// src/config/keyboard-layouts.js
var DEFAULT_KEYBOARD_LAYOUT_ID = (
  /** @type {const} */
  "browsing-right"
);
var DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID = (
  /** @type {const} */
  "browsing"
);
var DEFAULT_KEYBOARD_HANDEDNESS = (
  /** @type {const} */
  "right"
);
var SOURCE_BUILD_ENABLE_MACRO_BUILDER = false;
var BUILD_ENABLE_MACRO_BUILDER = typeof __KP_BUILD_ENABLE_MACRO_BUILDER__ !== "undefined" ? !!__KP_BUILD_ENABLE_MACRO_BUILDER__ : SOURCE_BUILD_ENABLE_MACRO_BUILDER;
var BUILD_EXCLUDED_KEY_ACTIONS = Object.freeze([
  "COLS_TOGGLE"
]);
var BUILD_EXCLUDED_KEY_ACTION_SET = new Set(BUILD_EXCLUDED_KEY_ACTIONS);
function isBuildExcludedKeyAction(actionId) {
  const id = String(actionId || "");
  return !!id && BUILD_EXCLUDED_KEY_ACTION_SET.has(id);
}
var BUILTIN_KEYBOARD_LAYOUT_META = Object.freeze([
  Object.freeze({
    id: (
      /** @type {const} */
      "browsing-right"
    ),
    label: "Browsing: right-handed",
    description: "Full browsing layout. Mouse: right hand. Shortcuts primarily on the left."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "browsing-left"
    ),
    label: "Browsing: left-handed",
    description: "Full browsing layout. Mouse: left hand. Shortcuts primarily on the right."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "basic-navigation-right"
    ),
    label: "Basic Navigation: right-handed",
    description: "Page scroll, click, tab switch, back/forward only."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "basic-navigation-left"
    ),
    label: "Basic Navigation: left-handed",
    description: "Page scroll, click, tab switch, back/forward only."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "click-history-right"
    ),
    label: "Navigation: right-handed",
    description: "Click element, go back, and go forward only."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "click-history-left"
    ),
    label: "Navigation: left-handed",
    description: "Click element, go back, and go forward only."
  })
]);
var BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META = Object.freeze([
  Object.freeze({
    id: (
      /** @type {const} */
      "browsing"
    ),
    label: "Browsing",
    builtIn: true,
    description: "Full browsing controls (scroll, tabs, click, history, tools).",
    variants: Object.freeze({
      right: (
        /** @type {const} */
        "browsing-right"
      ),
      left: (
        /** @type {const} */
        "browsing-left"
      )
    })
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "click-history"
    ),
    label: "Navigation",
    builtIn: true,
    description: "Click element, go back, and go forward.",
    variants: Object.freeze({
      right: (
        /** @type {const} */
        "click-history-right"
      ),
      left: (
        /** @type {const} */
        "click-history-left"
      )
    })
  })
]);
var LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS = Object.freeze({
  "basic-navigation": Object.freeze({
    right: (
      /** @type {const} */
      "basic-navigation-right"
    ),
    left: (
      /** @type {const} */
      "basic-navigation-left"
    )
  })
});
var KNOWN_BUILTIN_LAYOUT_IDS = new Set(
  BUILTIN_KEYBOARD_LAYOUT_META.map((m) => m && m.id).filter(Boolean)
);
function normalizeKeyboardLayoutId(raw) {
  const v = String(raw || "").trim();
  if (KNOWN_BUILTIN_LAYOUT_IDS.has(v)) return (
    /** @type {BuiltinKeyboardLayoutId} */
    v
  );
  return DEFAULT_KEYBOARD_LAYOUT_ID;
}
function normalizeKeyboardLayoutFamilyId(raw) {
  const v = String(raw || "").trim();
  if (v === "navigation") return "browsing";
  if (!v) return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
  const known = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.some((m) => m && m.id === v);
  if (known) return v;
  if (Object.prototype.hasOwnProperty.call(LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS, v)) {
    return (
      /** @type {KeyboardLayoutFamilyId} */
      v
    );
  }
  return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
}
function normalizeKeyboardHandedness(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "left" || v === "right") return (
    /** @type {KeyboardHandedness} */
    v
  );
  return DEFAULT_KEYBOARD_HANDEDNESS;
}
function resolveKeyboardLayoutId({ familyId, handedness } = {}) {
  const fam = normalizeKeyboardLayoutFamilyId(familyId);
  const hand = normalizeKeyboardHandedness(handedness);
  const meta = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.find((m) => m && m.id === fam);
  const legacy = LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS[fam];
  const resolved = meta?.variants?.[hand] || legacy?.[hand];
  return normalizeKeyboardLayoutId(resolved);
}
function inferFamilyAndHandednessFromLayoutId(rawLayoutId) {
  const id = normalizeKeyboardLayoutId(rawLayoutId);
  if (id.endsWith("-left")) {
    const familyId = id.slice(0, -"-left".length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: "left"
    };
  }
  if (id.endsWith("-right")) {
    const familyId = id.slice(0, -"-right".length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: "right"
    };
  }
  return { familyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID, handedness: DEFAULT_KEYBOARD_HANDEDNESS };
}
var KEYBINDING_ACTION_DEFS = Object.freeze({
  ACTIVATE: Object.freeze({
    handler: "handleActivateKey",
    label: "Click Element",
    description: "Click the hovered element",
    details: "Activates the clickable under the cursor \u2014 the same as a left mouse click on that element. Works with links, buttons, and other interactive targets KeyPilot highlights.",
    keyboardClass: "key-activate",
    row: 2
  }),
  // Foreground new tab (switch to the new tab).
  ACTIVATE_NEW_TAB: Object.freeze({
    handler: "handleActivateNewTabKey",
    label: "Click New Tab",
    description: "Open link in a new foreground tab",
    details: "Opens the hovered link in a new tab and switches to it immediately. Use when you want to follow a link without leaving your place permanently, but still jump to the new page right away.",
    keyboardClass: "key-activate-new",
    row: 2
  }),
  // Background new tab (middle-click style; do not switch focus).
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({
    handler: "handleActivateNewTabBackgroundKey",
    label: "Click New Tab Background",
    description: "Open link in a new background tab",
    details: "Opens the hovered link in a new tab without switching focus \u2014 like a middle-click. Useful for queueing several links while you keep reading the current page.",
    keyboardClass: "key-activate-new-over",
    row: 2
  }),
  BACK: Object.freeze({
    handler: "handleBackKey",
    label: "Go Back",
    description: "Browser history back",
    details: "Navigates one step back in the current tab\u2019s history, equivalent to the browser Back button.",
    keyboardClass: "key-back",
    row: 2
  }),
  BACK2: Object.freeze({
    handler: "handleBackKey",
    label: "Go Back",
    description: "Browser history back",
    details: "Navigates one step back in the current tab\u2019s history, equivalent to the browser Back button. Duplicate id for layouts that expose a second Back binding.",
    keyboardClass: "key-back",
    row: 2
  }),
  FORWARD: Object.freeze({
    handler: "handleForwardKey",
    label: "Go Forward",
    description: "Browser history forward",
    details: "Navigates one step forward in the current tab\u2019s history, equivalent to the browser Forward button.",
    keyboardClass: "key-forward",
    row: 1
  }),
  DELETE: Object.freeze({
    handler: "handleDeleteKey",
    label: "Delete Mode",
    description: "Hide elements under the cursor",
    details: "Toggles Delete Mode: hover elements and remove (hide) them from the page so you can declutter layouts. Exit with Exit Focus or by toggling again.",
    keyboardClass: "key-delete",
    row: 2
  }),
  COLS_TOGGLE: Object.freeze({
    handler: "handleColsToggleKey",
    label: "Cols Toggle",
    description: "Multi-column layout under cursor",
    details: "Columnizes the element under the cursor into a multi-column layout so dense text or lists are easier to scan. Toggle again to restore the original layout.",
    keyboardClass: "key-cols",
    row: 3
  }),
  TAB_LEFT: Object.freeze({
    handler: "handleTabLeftKey",
    label: "Tab Left",
    description: "Switch to the previous tab",
    details: "Activates the tab to the left of the current one in the window\u2019s tab strip.",
    keyboardClass: "key-gray",
    row: 1
  }),
  TAB_RIGHT: Object.freeze({
    handler: "handleTabRightKey",
    label: "Tab Right",
    description: "Switch to the next tab",
    details: "Activates the tab to the right of the current one in the window\u2019s tab strip.",
    keyboardClass: "key-gray",
    row: 1
  }),
  ROOT: Object.freeze({
    handler: "handleRootKey",
    label: "Go to Site Root",
    description: "Navigate to the site origin",
    details: "Jumps to the site root (scheme + host) of the current page \u2014 useful for escaping deep paths without typing a URL.",
    keyboardClass: null,
    row: 2
  }),
  LAUNCHER: Object.freeze({
    handler: "handleLauncherKey",
    label: "Launcher",
    description: "Quick-access site launcher",
    details: "Opens the Launcher popover for jumping to favorite or configured sites without using the omnibox.",
    keyboardClass: "key-launcher-orange",
    row: 2
  }),
  TOP_SITES: Object.freeze({
    handler: "handleTopSitesKey",
    label: "Top Sites",
    description: "Toolbar, visits, and bookmarks",
    details: "Opens Top Sites: a quick list drawn from the toolbar, most-visited pages, and recent bookmarks so you can open a frequent destination in one step.",
    keyboardClass: "key-launcher-orange",
    row: 2
  }),
  CLOSE_TAB: Object.freeze({
    handler: "handleCloseTabKey",
    label: "Close Tab",
    description: "Close the current tab",
    details: "Closes the active tab. Behavior matches the browser\u2019s close-tab action for the current window.",
    keyboardClass: "key-close-tab",
    row: 3
  }),
  CANCEL: Object.freeze({
    handler: "cancelModes",
    label: "Exit Focus",
    description: "Leave modes and overlays",
    details: "Cancels the current KeyPilot mode or overlay (Delete Mode, Scroll Line, text focus helpers, and similar) and returns to normal browsing.",
    keyboardClass: null,
    row: null
  }),
  PAGE_UP_INSTANT: Object.freeze({
    handler: "handleInstantPageUp",
    label: "Page Up Fast",
    description: "Jump one page up instantly",
    details: "Scrolls the current scroll target up by roughly one viewport without animation \u2014 faster than a smooth page-up when you need to move quickly.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  PAGE_DOWN_INSTANT: Object.freeze({
    handler: "handleInstantPageDown",
    label: "Page Down Fast",
    description: "Jump one page down instantly",
    details: "Scrolls the current scroll target down by roughly one viewport without animation \u2014 faster than a smooth page-down when you need to move quickly.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  PAGE_TOP: Object.freeze({
    handler: "handlePageTop",
    label: "Scroll To Top",
    description: "Jump to top of scroll target",
    details: "Moves to the top of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  PAGE_BOTTOM: Object.freeze({
    handler: "handlePageBottom",
    label: "Scroll To Bottom",
    description: "Jump to bottom of scroll target",
    details: "Moves to the bottom of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  SCROLL_LINE: Object.freeze({
    handler: "handleScrollLineKey",
    label: "Scroll Line",
    description: "Origin-based continuous scroll",
    details: "Scrolls from a fixed origin: move the mouse away from the on-screen dot to scroll faster in that direction. Optionally enable middle-click on empty page area under Settings \u2192 Scrolling.",
    keyboardClass: "key-scroll",
    row: 3,
    mode: "scroll_line",
    cancelOnPointerDown: true,
    pointerBinding: Object.freeze({
      button: "middle",
      yieldToClickables: true,
      yieldToTextEntry: true,
      yieldToModes: Object.freeze(["text_focus", "popover", "omnibox"]),
      enabledSetting: "scroll.middleClickScrollLine"
    })
  }),
  NEW_TAB: Object.freeze({
    handler: "handleNewTabKey",
    label: "New Tab",
    description: "Open a blank new tab",
    details: "Opens a new empty tab in the current window, same as the browser\u2019s New Tab command.",
    keyboardClass: "key-gray",
    row: 1
  }),
  OPEN_POPOVER: Object.freeze({
    handler: "handleOpenPopover",
    label: "Open Popover",
    description: "Open link in a popup window",
    details: "Opens the hovered link in a KeyPilot popup window so you can peek or work in a separate chrome without a full new tab.",
    keyboardClass: "key-open-popover",
    row: 2
  }),
  PREVIEW_LINK_POPOVER: Object.freeze({
    handler: "handlePreviewLinkPopover",
    label: "Preview Link",
    description: "Preview link in a popup",
    details: "Opens Link Preview for the hovered URL in a popup window \u2014 skim the destination without committing a full navigation in the main tab.",
    keyboardClass: "key-preview-popover",
    row: 2
  }),
  POI_WEBSITE: Object.freeze({
    handler: "handlePoiWebsiteKey",
    label: "POI Website",
    description: "Open map place website",
    details: "When a map place (POI) is under the cursor, opens that place\u2019s website in Link Preview so you can visit the business or location page without leaving the map.",
    keyboardClass: "key-preview-popover",
    row: null
  }),
  POI_ADDRESS: Object.freeze({
    handler: "handlePoiAddressKey",
    label: "POI Address",
    description: "Copy map place address",
    details: "When a map place (POI) is under the cursor, copies its street address to the clipboard for pasting into directions, notes, or forms.",
    keyboardClass: null,
    row: null
  }),
  OPEN_SETTINGS_POPOVER: Object.freeze({
    handler: "handleToggleSettingsPopover",
    label: "Settings",
    description: "Open KeyPilot Settings",
    details: "Opens or closes the KeyPilot Settings popover for themes, scrolling, click mode, layouts, and other preferences.",
    keyboardClass: "key-settings-dark",
    row: null
  }),
  OMNIBOX: Object.freeze({
    handler: "handleOpenOmnibox",
    label: "Omnibox",
    description: "Address bar overlay",
    details: "Opens KeyPilot\u2019s omnibox overlay so you can type a URL or search without clicking the browser address bar.",
    keyboardClass: "key-orange",
    row: 2
  }),
  TAB_HISTORY: Object.freeze({
    handler: "handleToggleTabHistoryPopover",
    label: "Tab History",
    description: "Browse this tab\u2019s history",
    details: "Opens Tab History for the current tab so you can jump to a previously visited page in this tab\u2019s session without using the browser\u2019s native history UI.",
    keyboardClass: "key-gray",
    row: 2
  }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({
    handler: "handleToggleKeyboardHelp",
    label: "KB Reference",
    description: "Show or hide the keyboard map",
    details: "Toggles the floating Keyboard Reference window that shows your current layout\u2019s keycaps and bindings.",
    keyboardClass: "key-purple",
    row: 2
  }),
  // Text select: default character-level (H on right-handed layout).
  HIGHLIGHT: Object.freeze({
    handler: "handleHighlightKey",
    label: "Text Select",
    description: "Select text and copy rich text",
    details: "Enters character-level text selection under the cursor. By default, the selection is copied as rich text so formatting is preserved when you paste.",
    keyboardClass: "key-highlight",
    row: 2
  }),
  // Rectangle region select (Y on right-handed; R free on left-handed).
  RECTANGLE_HIGHLIGHT: Object.freeze({
    handler: "handleRectangleHighlightKey",
    label: "Element Select",
    description: "Rectangle or cumulative element pick",
    details: "Selects HTML elements that intersect a dragged rectangle, or pick elements cumulatively. Useful for grabbing structure (not just plain text) from a page region.",
    keyboardClass: "key-rect-highlight",
    row: 1
  }),
  // Copy image under cursor (I on right-handed; E on left-handed — I is OPEN_POPOVER there).
  COPY_HOVERED_IMAGE: Object.freeze({
    handler: "handleCopyHoveredImageKey",
    label: "Copy Image",
    description: "Copy hovered image",
    details: "Copies the image under the cursor to the clipboard, Media Library, or both \u2014 configure the destination on the action. Prefer this when you want the image bytes or a saved library entry, not just a URL.",
    // Default key face (no tinted key-gray / family fill).
    keyboardClass: null,
    row: 1
  }),
  // Copy hyperlink under cursor (U on right-handed; no default on left — U is FORWARD there).
  COPY_HOVERED_URL: Object.freeze({
    handler: "handleCopyHoveredUrlKey",
    label: "Copy URL",
    description: "Copy hovered link URL",
    details: "Copies the URL under the cursor to the clipboard, Media Library, or both. Use this when you need the href itself rather than fetching or opening the resource.",
    keyboardClass: null,
    row: 1
  }),
  // Copy video under cursor — Actions Library only (no built-in layout key).
  COPY_HOVERED_VIDEO: Object.freeze({
    handler: "handleCopyHoveredVideoKey",
    label: "Copy Video",
    description: "Copy hovered video",
    details: "Copies the video under the cursor (file bytes to Media Library when fetchable, or the video URL to the clipboard). No default layout key \u2014 bind it in Layout Config if you need it.",
    keyboardClass: null,
    row: null
  }),
  // Font under cursor — Actions Library only (no built-in layout key).
  FONT_INFO: Object.freeze({
    handler: "handleFontInfoKey",
    label: "Font Info",
    description: "Inspect font under the cursor",
    details: "Shows a popover with the font name, size, family, file type, and resource URL for the styled text under the cursor, and outlines that text run. No default layout key \u2014 bind it in Layout Config if you need it.",
    keyboardClass: null,
    row: null
  }),
  // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
  PAGE_MEDIA: Object.freeze({
    handler: "handlePageMediaKey",
    label: "Page Media",
    description: "Browse media found on this page",
    details: "Opens a gallery of images, videos, documents, fonts, and URLs discovered on the current page so you can review or collect them without hunting through the DOM.",
    keyboardClass: null,
    row: 1
  }),
  // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
  // so this doesn't get a default binding there yet).
  OPEN_MEDIA_LIBRARY: Object.freeze({
    handler: "handleOpenMediaLibraryKey",
    label: "Media Library",
    description: "Open saved Media Library",
    details: "Opens the Media Library where items you previously copied or saved (images, videos, URLs, and related assets) are kept for reuse.",
    keyboardClass: null,
    row: 1
  }),
  // Clipboard commands (Functions palette — Clipboard category).
  CLIPBOARD_COPY: Object.freeze({
    handler: "handleClipboardCopyKey",
    label: "Copy",
    description: "Copy selection to clipboard",
    details: "Copies the current text selection to the system clipboard. Prefer this over OS shortcuts when you want Copy available as a KeyPilot layout binding.",
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_CUT: Object.freeze({
    handler: "handleClipboardCutKey",
    label: "Cut",
    description: "Cut selection to clipboard",
    details: "Cuts the current text selection to the system clipboard from the focused field or editable region.",
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_PASTE: Object.freeze({
    handler: "handleClipboardPasteKey",
    label: "Paste",
    description: "Paste into the focused field",
    details: "Pastes clipboard text into the focused text field or editable element. Bind with a modifier chord if you need it while typing.",
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_SELECT_ALL: Object.freeze({
    handler: "handleClipboardSelectAllKey",
    label: "Select All",
    description: "Select all in field or page",
    details: "Selects all text in the focused field, or the page content when nothing editable is focused \u2014 same idea as the usual Select All shortcut.",
    keyboardClass: null,
    row: null
  }),
  SELECT_WORD: Object.freeze({
    handler: "handleSelectWordKey",
    label: "Select Word",
    description: "Select the word under the cursor",
    details: "Selects the word under the KeyPilot cursor. Press again over the same word to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy reads this selection.",
    keyboardClass: null,
    row: null
  }),
  SELECT_SENTENCE: Object.freeze({
    handler: "handleSelectSentenceKey",
    label: "Select Sentence",
    description: "Select the sentence under the cursor",
    details: "Selects the sentence under the KeyPilot cursor. Press again over the same sentence to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
    keyboardClass: null,
    row: null
  }),
  SELECT_PARAGRAPH: Object.freeze({
    handler: "handleSelectParagraphKey",
    label: "Select Paragraph",
    description: "Select the paragraph under the cursor",
    details: "Selects the paragraph (or nearest block) under the KeyPilot cursor. Press again over the same block to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
    keyboardClass: null,
    row: null
  }),
  SELECT_IMAGE: Object.freeze({
    handler: "handleSelectImageKey",
    label: "Select Image",
    description: "Select the image under the cursor",
    details: "Selects the image under the KeyPilot cursor. Press again over the same image to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy can copy selected images.",
    keyboardClass: null,
    row: null
  }),
  // AI (Functions palette — AI category).
  SEND_TEXT_TO_AI: Object.freeze({
    handler: "handleSendTextToAiKey",
    label: "Send Text To AI",
    description: "Run AI on selected text",
    details: "Sends the selected text to AI with a configurable instruction, then routes the result to the clipboard and/or a popover. Configure the prompt and destination on the action instance.",
    keyboardClass: "key-purple",
    row: null
  })
});
var KEYBINDING_ACTION_CATEGORY_BY_ID = Object.freeze({
  // Navigation — click / link preview / history
  ACTIVATE: "Navigation",
  ACTIVATE_NEW_TAB: "Navigation",
  ACTIVATE_NEW_TAB_BACKGROUND: "Navigation",
  PREVIEW_LINK_POPOVER: "Navigation",
  POI_WEBSITE: "Maps",
  POI_ADDRESS: "Maps",
  OPEN_POPOVER: "Navigation",
  FORWARD: "Navigation",
  BACK: "Navigation",
  BACK2: "Navigation",
  ROOT: "Navigation",
  // Tab Control
  CLOSE_TAB: "Tab Control",
  TAB_LEFT: "Tab Control",
  TAB_RIGHT: "Tab Control",
  NEW_TAB: "Tab Control",
  TAB_HISTORY: "Tab Control",
  PAGE_UP_INSTANT: "Scroll",
  PAGE_DOWN_INSTANT: "Scroll",
  PAGE_TOP: "Scroll",
  PAGE_BOTTOM: "Scroll",
  SCROLL_LINE: "Scroll",
  HIGHLIGHT: "Get Page Data",
  RECTANGLE_HIGHLIGHT: "Get Page Data",
  COPY_HOVERED_IMAGE: "Get Page Data",
  COPY_HOVERED_URL: "Get Page Data",
  COPY_HOVERED_VIDEO: "Get Page Data",
  FONT_INFO: "Get Page Data",
  PAGE_MEDIA: "Get Page Data",
  DELETE: "Select",
  COLS_TOGGLE: "Select",
  OPEN_MEDIA_LIBRARY: "Media Library",
  CLIPBOARD_COPY: "Clipboard",
  CLIPBOARD_CUT: "Clipboard",
  CLIPBOARD_PASTE: "Clipboard",
  CLIPBOARD_SELECT_ALL: "Clipboard",
  SELECT_WORD: "Clipboard",
  SELECT_SENTENCE: "Clipboard",
  SELECT_PARAGRAPH: "Clipboard",
  SELECT_IMAGE: "Clipboard",
  SEND_TEXT_TO_AI: "AI",
  LAUNCHER: "Begin URL",
  TOP_SITES: "Begin URL",
  OMNIBOX: "Begin URL",
  TOGGLE_KEYBOARD_HELP: "KeyPilot",
  OPEN_SETTINGS_POPOVER: "KeyPilot",
  CANCEL: "System"
});
var KEYBINDING_ACTION_CATEGORY_ORDER = Object.freeze([
  "Navigation",
  "Tab Control",
  "Begin URL",
  "Get Page Data",
  "Maps",
  "Scroll",
  "Select",
  "Media Library",
  "Clipboard",
  "AI",
  "KeyPilot",
  "Tools",
  "System",
  "Other"
]);
function upperLetter(s) {
  const ch = String(s || "");
  if (!ch) return "";
  return ch.length === 1 ? ch.toUpperCase() : ch;
}
function normalizeAssignmentLabels(a) {
  const keys = Array.isArray(a?.keys) ? a.keys : [];
  const first = keys[0] || "";
  const explicitDisplay = typeof a?.displayKey === "string" ? a.displayKey : "";
  const explicitKeyLabel = typeof a?.keyLabel === "string" ? a.keyLabel : "";
  if (explicitDisplay || explicitKeyLabel) {
    const dk = explicitDisplay || explicitKeyLabel;
    const kl = explicitKeyLabel || explicitDisplay;
    return { keyLabel: kl || dk || "", displayKey: dk || kl || "" };
  }
  if (typeof first === "string" && first.length === 1 && /[a-zA-Z]/.test(first)) {
    const up = upperLetter(first);
    return { keyLabel: up, displayKey: up };
  }
  return { keyLabel: String(first || ""), displayKey: String(first || "") };
}
function buildKeybindingsForLayout(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const layout = BUILTIN_KEYBOARD_LAYOUTS[id];
  const out = {};
  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(actionId)) continue;
    const assign = layout?.assignments?.[actionId];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
      handler: def.handler,
      label: def.label,
      description: def.description,
      keyLabel: labels.keyLabel,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: labels.displayKey
    };
  }
  return out;
}
var CATALOG_KEYBINDINGS = (() => {
  const out = {};
  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(actionId)) continue;
    out[actionId] = Object.freeze({
      keys: Object.freeze([]),
      handler: def.handler,
      label: def.label,
      description: def.description,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: "",
      keyLabel: ""
    });
  }
  return Object.freeze(out);
})();
var ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
  TAB_LEFT: Object.freeze({ keys: ["q", "Q"] }),
  TAB_RIGHT: Object.freeze({ keys: ["w", "W"] }),
  OPEN_POPOVER: Object.freeze({ keys: ["p", "P"] }),
  PREVIEW_LINK_POPOVER: Object.freeze({ keys: ["e", "E"] }),
  FORWARD: Object.freeze({ keys: ["r", "R"] }),
  NEW_TAB: Object.freeze({ keys: ["t", "T"] }),
  CLOSE_TAB: Object.freeze({ keys: ["a", "A"] }),
  ROOT: Object.freeze({ keys: ["s", "S", "1", "!"], displayKey: "S", keyLabel: "S" }),
  BACK: Object.freeze({ keys: ["d", "D"] }),
  ACTIVATE: Object.freeze({ keys: ["f", "F"] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ["g", "G"] }),
  HIGHLIGHT: Object.freeze({ keys: ["h", "H"] }),
  TAB_HISTORY: Object.freeze({ keys: ["j", "J"] }),
  OMNIBOX: Object.freeze({ keys: ["l", "L"] }),
  TOP_SITES: Object.freeze({ keys: [";", ":", "Semicolon", "`", "~", "Backquote"], matchOn: ["key", "code"], displayKey: ";", keyLabel: ";" }),
  PAGE_TOP: Object.freeze({ keys: ["z", "Z"] }),
  PAGE_BOTTOM: Object.freeze({ keys: ["x", "X"] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: ["c", "C"] }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ["v", "V"] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ["b", "B"] }),
  SCROLL_LINE: Object.freeze({ keys: ["n", "N"] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ["y", "Y"] }),
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ["i", "I"] }),
  COPY_HOVERED_URL: Object.freeze({ keys: ["u", "U"] }),
  PAGE_MEDIA: Object.freeze({ keys: ["o", "O"] }),
  // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
  OPEN_MEDIA_LIBRARY: Object.freeze({ keys: ["m", "M"] }),
  DELETE: Object.freeze({ keys: ["Backspace"], displayKey: "Backspace", keyLabel: "Backspace" })
  // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
});
var ASSIGNMENTS_BROWSING_LEFT = Object.freeze({
  // Top row cluster: Q W E R T  ->  P O I U Y (mirrored)
  TAB_LEFT: Object.freeze({ keys: ["p", "P"] }),
  TAB_RIGHT: Object.freeze({ keys: ["o", "O"] }),
  OPEN_POPOVER: Object.freeze({ keys: ["i", "I"] }),
  PREVIEW_LINK_POPOVER: Object.freeze({ keys: ["w", "W"] }),
  FORWARD: Object.freeze({ keys: ["u", "U"] }),
  NEW_TAB: Object.freeze({ keys: ["y", "Y"] }),
  SCROLL_LINE: Object.freeze({ keys: ["t", "T"] }),
  // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
  CLOSE_TAB: Object.freeze({ keys: [";", ":"], displayKey: ";", keyLabel: ";" }),
  ROOT: Object.freeze({ keys: ["l", "L", "1", "!"], displayKey: "L", keyLabel: "L" }),
  BACK: Object.freeze({ keys: ["k", "K"] }),
  ACTIVATE: Object.freeze({ keys: ["j", "J"] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ["h", "H"] }),
  // H is background-tab open on left; G/R free for selection.
  HIGHLIGHT: Object.freeze({ keys: ["g", "G"] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ["r", "R"] }),
  // Utility actions on the left avoid colliding with J/K/L cluster.
  // (KB Reference / Settings / Esc live in the system layer, not layout assignments.)
  TAB_HISTORY: Object.freeze({ keys: ["f", "F"] }),
  OMNIBOX: Object.freeze({ keys: ["s", "S"] }),
  TOP_SITES: Object.freeze({ keys: ["a", "A", "`", "~", "Backquote"], matchOn: ["key", "code"], displayKey: "A", keyLabel: "A" }),
  // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
  PAGE_TOP: Object.freeze({ keys: ["/", "?"], displayKey: "/", keyLabel: "/" }),
  PAGE_BOTTOM: Object.freeze({ keys: ["b", "B"] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: [",", "<"], displayKey: ",", keyLabel: "," }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ["m", "M"] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ["n", "N"] }),
  // I is OPEN_POPOVER on left-handed; E is free.
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ["e", "E"] }),
  // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
  DELETE: Object.freeze({ keys: ["Backspace"], displayKey: "Backspace", keyLabel: "Backspace" })
});
var SYSTEM_LAYER_ACTION_IDS = Object.freeze([
  "CANCEL",
  "TOGGLE_KEYBOARD_HELP",
  "OPEN_SETTINGS_POPOVER"
]);
var SYSTEM_LAYER_ASSIGNMENTS_RIGHT = Object.freeze({
  CANCEL: Object.freeze({ keys: ["Escape"], displayKey: "Esc", keyLabel: "Esc" }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ["k", "K"] }),
  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", "Quote"], matchOn: ["key", "code"], displayKey: "'" })
});
var SYSTEM_LAYER_ASSIGNMENTS_LEFT = Object.freeze({
  CANCEL: Object.freeze({ keys: ["Escape"], displayKey: "Esc", keyLabel: "Esc" }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ["d", "D"] }),
  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", "Quote"], matchOn: ["key", "code"], displayKey: "'" })
});
function buildSystemKeybindings(handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  const hand = normalizeKeyboardHandedness(handedness);
  const assignments = hand === "left" ? SYSTEM_LAYER_ASSIGNMENTS_LEFT : SYSTEM_LAYER_ASSIGNMENTS_RIGHT;
  const out = {};
  for (const actionId of SYSTEM_LAYER_ACTION_IDS) {
    const def = KEYBINDING_ACTION_DEFS[actionId];
    const assign = assignments[actionId];
    if (!def || !assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
      handler: def.handler,
      label: def.label,
      description: def.description,
      keyLabel: labels.keyLabel,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: labels.displayKey,
      systemLayer: true
    };
  }
  return out;
}
function buildEffectiveKeybindings(layoutId, handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  return {
    ...buildKeybindingsForLayout(layoutId),
    ...buildSystemKeybindings(handedness)
  };
}
var BASIC_NAVIGATION_ACTION_IDS = Object.freeze([
  "ACTIVATE",
  "TAB_LEFT",
  "TAB_RIGHT",
  "FORWARD",
  "BACK",
  "ROOT",
  "PAGE_TOP",
  "PAGE_BOTTOM",
  "PAGE_UP_INSTANT",
  "PAGE_DOWN_INSTANT"
]);
var CLICK_HISTORY_ACTION_IDS = Object.freeze([
  "ACTIVATE",
  "BACK",
  "ROOT",
  "FORWARD"
]);
var BASIC_NAVIGATION_UI_ACTION_IDS = Object.freeze([
  ...BASIC_NAVIGATION_ACTION_IDS,
  ...SYSTEM_LAYER_ACTION_IDS
]);
var CLICK_HISTORY_UI_ACTION_IDS = Object.freeze([
  ...CLICK_HISTORY_ACTION_IDS,
  ...SYSTEM_LAYER_ACTION_IDS
]);
function pickAssignments(source, allowedIds) {
  const allowed = new Set(allowedIds);
  const out = {};
  for (const id of allowedIds) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (source[id]) out[id] = source[id];
  }
  for (const [id, assignment] of Object.entries(source || {})) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (allowed.has(id) && !out[id]) out[id] = assignment;
  }
  return Object.freeze(out);
}
function physicalSlotLabelFromBinding(binding) {
  const s = String(binding?.displayKey || binding?.keyLabel || "").trim();
  if (!s) return "";
  if (s.length === 1) return /[a-z]/i.test(s) ? s.toUpperCase() : s;
  if (s.includes("/")) {
    const first = s.split("/")[0];
    if (first && first.trim().length === 1) {
      const ch = first.trim();
      return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
    }
  }
  return "";
}
function letterFromAssignment(assignment) {
  if (!assignment) return "";
  const slot = physicalSlotLabelFromBinding(assignment);
  if (slot) return slot;
  if (typeof assignment.displayKey === "string" && assignment.displayKey) return assignment.displayKey;
  if (typeof assignment.keyLabel === "string" && assignment.keyLabel) return assignment.keyLabel;
  const keys = Array.isArray(assignment.keys) ? assignment.keys : [];
  for (const k of keys) {
    const s = String(k || "");
    if (!s || s === "Semicolon" || s === "Quote" || s === "Backquote") continue;
    if (s.length === 1) return s.toUpperCase();
    if (s === "Backspace" || s === "Escape") return s;
  }
  return "";
}
function projectKeyboardUiLayout(baseLayout, fullAssignments, allowedIds) {
  const allowed = new Set(allowedIds);
  return Object.freeze(
    (Array.isArray(baseLayout) ? baseLayout : []).map(
      (row) => Object.freeze(
        (Array.isArray(row) ? row : []).map((cell) => {
          if (!cell || cell.type !== "action" || !cell.id) return cell;
          if (isBuildExcludedKeyAction(cell.id) || !allowed.has(cell.id)) {
            if (cell.id === "DELETE" || cell.className && String(cell.className).includes("key-backspace")) {
              return Object.freeze({ type: "special", text: "Backspace", className: "key key-backspace" });
            }
            const text2 = letterFromAssignment(fullAssignments[cell.id]);
            if (!text2) return Object.freeze({ type: "key", text: "" });
            if (text2 === "Backspace") {
              return Object.freeze({ type: "special", text: "Backspace", className: "key key-backspace" });
            }
            const glyph = text2.length <= 3 ? text2 : text2.slice(0, 1).toUpperCase();
            return Object.freeze({ type: "key", text: glyph.length === 1 ? glyph.toUpperCase() : glyph });
          }
          return cell;
        })
      )
    )
  );
}
var ASSIGNMENTS_BASIC_NAVIGATION_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, BASIC_NAVIGATION_ACTION_IDS);
var ASSIGNMENTS_BASIC_NAVIGATION_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, BASIC_NAVIGATION_ACTION_IDS);
var ASSIGNMENTS_CLICK_HISTORY_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, CLICK_HISTORY_ACTION_IDS);
var ASSIGNMENTS_CLICK_HISTORY_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, CLICK_HISTORY_ACTION_IDS);
var KEYBOARD_UI_LAYOUT_RIGHT = Object.freeze([
  [
    { type: "special", text: "Tab", className: "key key-tab" },
    { type: "action", id: "TAB_LEFT", fallbackText: "Tab Left" },
    { type: "action", id: "TAB_RIGHT", fallbackText: "Tab Right" },
    { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
    { type: "action", id: "FORWARD", fallbackText: "Go Forward" },
    { type: "action", id: "NEW_TAB", fallbackText: "New Tab" },
    { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
    { type: "action", id: "COPY_HOVERED_URL", fallbackText: "Copy URL" },
    { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
    { type: "action", id: "PAGE_MEDIA", fallbackText: "Page Media" },
    { type: "action", id: "OPEN_POPOVER", fallbackText: "Open Popover" },
    { type: "key", text: "[" },
    { type: "key", text: "]" },
    { type: "action", id: "DELETE", fallbackText: "Delete Mode", className: "key key-backspace" }
  ],
  [
    { type: "special", text: "Caps", className: "key key-caps" },
    { type: "action", id: "CLOSE_TAB", fallbackText: "Close Tab" },
    { type: "action", id: "ROOT", fallbackText: "Go to Site Root" },
    { type: "action", id: "BACK", fallbackText: "Go Back" },
    { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
    { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
    { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
    { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
    { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
    { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
    { type: "action", id: "TOP_SITES", fallbackText: "Top Sites" },
    { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
    { type: "special", text: "Enter", className: "key key-enter" }
  ],
  [
    { type: "special", text: "Shift", className: "key key-shift" },
    { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
    { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
    { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up Fast" },
    { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down Fast" },
    { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
    { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
    { type: "action", id: "OPEN_MEDIA_LIBRARY", fallbackText: "Media Library" },
    { type: "key", text: "," },
    { type: "key", text: "." },
    { type: "key", text: "/" },
    { type: "special", text: "Shift", className: "key key-shift" }
  ]
]);
var KEYBOARD_UI_LAYOUT_LEFT = Object.freeze([
  [
    { type: "special", text: "Tab", className: "key key-tab" },
    { type: "key", text: "Q" },
    { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
    // W
    { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
    // E
    { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
    // R
    { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
    // T
    { type: "action", id: "NEW_TAB", fallbackText: "New Tab" },
    // Y
    { type: "action", id: "FORWARD", fallbackText: "Go Forward" },
    // U
    { type: "action", id: "OPEN_POPOVER", fallbackText: "Open Popover" },
    // I
    { type: "action", id: "TAB_RIGHT", fallbackText: "Tab Right" },
    // O
    { type: "action", id: "TAB_LEFT", fallbackText: "Tab Left" },
    // P
    { type: "key", text: "[" },
    { type: "key", text: "]" },
    { type: "action", id: "DELETE", fallbackText: "Delete Mode", className: "key key-backspace" }
  ],
  [
    { type: "special", text: "Caps", className: "key key-caps" },
    { type: "action", id: "TOP_SITES", fallbackText: "Top Sites" },
    // Utility keys on the left (to avoid colliding with right-hand cluster)
    { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
    // S
    { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
    // D
    { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
    // F
    { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
    // G
    { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
    // H
    { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
    // J
    { type: "action", id: "BACK", fallbackText: "Go Back" },
    // K
    { type: "action", id: "ROOT", fallbackText: "Go to Site Root" },
    // L
    { type: "action", id: "CLOSE_TAB", fallbackText: "Close Tab" },
    // ;
    { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
    // '
    { type: "special", text: "Enter", className: "key key-enter" }
  ],
  [
    { type: "special", text: "Shift", className: "key key-shift" },
    { type: "key", text: "Z" },
    { type: "key", text: "X" },
    { type: "key", text: "C" },
    { type: "key", text: "V" },
    { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
    // B
    { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
    // N
    { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down Fast" },
    // M
    { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up Fast" },
    // ,
    { type: "key", text: "." },
    { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
    // /
    { type: "special", text: "Shift", className: "key key-shift" }
  ]
]);
var BUILTIN_KEYBOARD_LAYOUTS = Object.freeze({
  "browsing-right": Object.freeze({
    id: "browsing-right",
    label: "Browsing: right-handed",
    description: "Full browsing layout. Mouse: right hand. Shortcuts primarily on the left.",
    assignments: ASSIGNMENTS_BROWSING_RIGHT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_RIGHT
  }),
  "browsing-left": Object.freeze({
    id: "browsing-left",
    label: "Browsing: left-handed",
    description: "Full browsing layout. Mouse: left hand. Shortcuts primarily on the right.",
    assignments: ASSIGNMENTS_BROWSING_LEFT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_LEFT
  }),
  "basic-navigation-right": Object.freeze({
    id: "basic-navigation-right",
    label: "Basic Navigation: right-handed",
    description: "Page scroll, click, tab switch, back/forward only.",
    assignments: ASSIGNMENTS_BASIC_NAVIGATION_RIGHT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_RIGHT,
      { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
      BASIC_NAVIGATION_UI_ACTION_IDS
    )
  }),
  "basic-navigation-left": Object.freeze({
    id: "basic-navigation-left",
    label: "Basic Navigation: left-handed",
    description: "Page scroll, click, tab switch, back/forward only.",
    assignments: ASSIGNMENTS_BASIC_NAVIGATION_LEFT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_LEFT,
      { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
      BASIC_NAVIGATION_UI_ACTION_IDS
    )
  }),
  "click-history-right": Object.freeze({
    id: "click-history-right",
    label: "Navigation: right-handed",
    description: "Click element, go back, and go forward only.",
    assignments: ASSIGNMENTS_CLICK_HISTORY_RIGHT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_RIGHT,
      { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
      CLICK_HISTORY_UI_ACTION_IDS
    )
  }),
  "click-history-left": Object.freeze({
    id: "click-history-left",
    label: "Navigation: left-handed",
    description: "Click element, go back, and go forward only.",
    assignments: ASSIGNMENTS_CLICK_HISTORY_LEFT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_LEFT,
      { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
      CLICK_HISTORY_UI_ACTION_IDS
    )
  })
});

// src/config/constants.js
var KEYBINDINGS = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_HANDEDNESS);
var SCROLL = Object.freeze({
  /** Legacy large page step (popover parent→iframe PAGE_UP/DOWN path) */
  PAGE_PX: 800,
  /** C / V: smaller step (default = prior 400px × 1.25) */
  HALF_PAGE_PX: 500,
  /**
   * Hold C / V: continuous rAF scroll speed (px/s). Instant per-frame deltas —
   * not CSS smooth — so overlapping animations cannot jitter.
   */
  HOLD_PX_PER_SEC: 1400,
  /**
   * Delay before continuous rAF starts after the first keydown. Keeps a quick
   * tap as a single configured step; holding past this (or first OS repeat)
   * engages continuous motion.
   */
  HOLD_RAF_START_MS: 120,
  /** Default CSS scroll-behavior for keyboard scrolling */
  BEHAVIOR: "smooth",
  /** Fade-in / fade-out duration for Scroll To Top / Bottom "Fade" jump style */
  EDGE_JUMP_FADE_MS: 180,
  /**
   * After the instant jump, keep the veil opaque until scroll position is
   * stable (or this timeout). Covers CSS `scroll-behavior: smooth` and
   * Lenis-style hijacks that keep interpolating after scrollTo returns.
   */
  EDGE_JUMP_SETTLE_MS: 480,
  /** Scroll Line: no scroll inside this radius from the origin dot */
  LINE_DEADZONE_PX: 12,
  /**
   * Scroll Line: ease-in power. 1 = linear, 2 = quadratic (gentle near the
   * dot, ramps harder toward the edge of the range).
   */
  LINE_CURVE_EXPONENT: 1.75,
  /** Scroll Line: offset beyond the dead zone that maps to max speed */
  LINE_CURVE_RANGE_PX: 360,
  /** Scroll Line: cap on each axis */
  LINE_MAX_PX_PER_SEC: 2400
});
var INSPECTOR_KIND = Object.freeze({
  DELETE: "delete",
  COLS: "cols",
  /** Cumulative element pick for Rectangle Select (Y) alternate mode */
  RECTANGLE_PICK: "rectangle_pick"
});
var ELEMENT_SELECT_TAGS = Object.freeze([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "pre",
  "code",
  "article",
  "section",
  "aside",
  "header",
  "footer",
  "main",
  "nav",
  "a",
  "img",
  "figure",
  "figcaption",
  "picture",
  "video",
  "audio",
  "svg",
  "td",
  "th",
  "dt",
  "dd",
  "caption",
  "summary",
  "label"
]);
var CURSOR_MODE = Object.freeze({
  NO_CUSTOM_CURSORS: "NO-CUSTOM-CURSORS",
  CUSTOM_CURSORS: "CUSTOM-CURSORS"
});

// themes/schema.js
var DEFAULT_THEME_ID = "dark-pro";
var THEME_IDS = Object.freeze([
  "dark-pro",
  "gray-metal-pro",
  "gx-er"
]);
var THEME_META = Object.freeze({
  "dark-pro": { name: "Dark Pro" },
  "gray-metal-pro": { name: "Gray Metal Pro" },
  "gx-er": { name: "GX-er" }
});
var PRO_SANS = "Helvetica, Arial, sans-serif";
var PRO_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
var TYPE_ROLES = Object.freeze([
  "display",
  "heading",
  "subhead",
  "body",
  "ui",
  "kbd",
  "mono",
  "caption"
]);
function createProTypeTokens(stacks = {}) {
  return {
    stacks: {
      display: stacks.display || PRO_SANS,
      heading: stacks.heading || PRO_SANS,
      subhead: stacks.subhead || PRO_SANS,
      body: stacks.body || PRO_SANS,
      ui: stacks.ui || PRO_SANS,
      kbd: stacks.kbd || PRO_MONO,
      mono: stacks.mono || PRO_MONO,
      caption: stacks.caption || PRO_SANS
    },
    size: {
      display: "22px",
      h1: "22px",
      h2: "16px",
      h3: "14px",
      body: "13px",
      ui: "12px",
      kbd: "10px",
      caption: "11px",
      code: "12px"
    },
    scale: "1.25",
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700"
    },
    letterSpacing: {
      display: "0.02em",
      titlebar: "0.02em",
      ui: "normal"
    },
    textTransform: {
      display: "none",
      titlebar: "none"
    },
    lineHeight: {
      tight: "1.2",
      body: "1.35",
      prose: "1.55"
    }
  };
}
function createTitlebarChromeTokens(overrides = {}) {
  return {
    titleWeight: "600",
    iconDisplay: "none",
    iconSize: "12px",
    kbdTransform: "none",
    kbdTracking: "0.02em",
    ...overrides
  };
}
function createProRadiusTokens(overrides = {}) {
  return {
    none: "0px",
    xs: "2px",
    sm: "3px",
    md: "6px",
    lg: "10px",
    pill: "999px",
    panel: "3px",
    btn: "2px",
    field: "2px",
    key: "7px",
    plate: "14px",
    ...overrides
  };
}
var KEY_CLIP_NONE = "none";
var KEY_SHADE_BEVEL = "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 18%, transparent 42%)";
function createKeyChromeTokens(overrides = {}) {
  return {
    shading: "bevel",
    border: "1px solid rgba(0, 0, 0, 0.4)",
    cornerMode: "radius",
    cutSize: "4px",
    ...overrides
  };
}
function keyClipPath(cutSize) {
  const s = cutSize || "4px";
  return `polygon(${s} 0, calc(100% - ${s}) 0, 100% ${s}, 100% calc(100% - ${s}), calc(100% - ${s}) 100%, ${s} 100%, 0 calc(100% - ${s}), 0 ${s})`;
}
function themeToCssVars(theme) {
  const t = theme && typeof theme === "object" ? theme : {};
  const type2 = t.type || createProTypeTokens();
  const stacks = type2.stacks || {};
  const size = type2.size || {};
  const weight = type2.weight || {};
  const ls = type2.letterSpacing || {};
  const tf = type2.textTransform || {};
  const lh = type2.lineHeight || {};
  const radius = t.radius || createProRadiusTokens();
  const color4 = t.color || {};
  const effect = t.effect || {};
  const shape = t.shape || { cornerMode: "radius", cutSize: "0px" };
  const keys = t.keys || createKeyChromeTokens();
  const keyCornerCut = (keys.cornerMode || "radius") === "cut";
  const icons = t.icons || {};
  const iconColor = icons.color || {};
  const vars = {
    "--kp-theme-id": String(t.id || DEFAULT_THEME_ID),
    "--kp-font-display": stacks.display || PRO_SANS,
    "--kp-font-heading": stacks.heading || PRO_SANS,
    "--kp-font-subhead": stacks.subhead || PRO_SANS,
    "--kp-font-body": stacks.body || PRO_SANS,
    "--kp-font-ui": stacks.ui || PRO_SANS,
    "--kp-font-kbd": stacks.kbd || PRO_MONO,
    "--kp-font-mono": stacks.mono || PRO_MONO,
    "--kp-font-caption": stacks.caption || PRO_SANS,
    "--kp-type-scale": String(type2.scale || "1"),
    "--kp-type-display-size": size.display || "22px",
    "--kp-type-h1-size": size.h1 || "22px",
    "--kp-type-h2-size": size.h2 || "16px",
    "--kp-type-h3-size": size.h3 || "14px",
    "--kp-type-body-size": size.body || "13px",
    "--kp-type-ui-size": size.ui || "12px",
    "--kp-type-kbd-size": size.kbd || "10px",
    "--kp-type-caption-size": size.caption || "11px",
    "--kp-type-code-size": size.code || "12px",
    "--kp-type-weight-regular": weight.regular || "400",
    "--kp-type-weight-medium": weight.medium || "500",
    "--kp-type-weight-semibold": weight.semibold || "600",
    "--kp-type-weight-bold": weight.bold || "700",
    "--kp-type-tracking-display": ls.display || "0.02em",
    "--kp-type-tracking-titlebar": ls.titlebar || "0.02em",
    "--kp-type-tracking-ui": ls.ui || "normal",
    "--kp-type-transform-display": tf.display || "none",
    "--kp-type-transform-titlebar": tf.titlebar || "none",
    "--kp-titlebar-title-weight": t.titlebar && t.titlebar.titleWeight || "600",
    "--kp-titlebar-icon-display": t.titlebar && t.titlebar.iconDisplay || "none",
    "--kp-titlebar-icon-size": t.titlebar && t.titlebar.iconSize || "12px",
    "--kp-kbd-transform": t.titlebar && t.titlebar.kbdTransform || "none",
    "--kp-kbd-tracking": t.titlebar && t.titlebar.kbdTracking || "0.02em",
    "--kp-type-leading-tight": lh.tight || "1.2",
    "--kp-type-leading-body": lh.body || "1.35",
    "--kp-type-leading-prose": lh.prose || "1.55",
    "--kp-radius-none": radius.none || "0px",
    "--kp-radius-xs": radius.xs || "2px",
    "--kp-radius-sm": radius.sm || "3px",
    "--kp-radius-md": radius.md || "6px",
    "--kp-radius-lg": radius.lg || "10px",
    "--kp-radius-pill": radius.pill || "999px",
    "--kp-radius-panel": radius.panel || "3px",
    "--kp-radius-btn": radius.btn || "2px",
    "--kp-radius-field": radius.field || "2px",
    "--kp-radius-key": radius.key || "7px",
    "--kp-radius-plate": radius.plate || "14px",
    "--kp-color-bg": color4.bg || "#0f0f10",
    "--kp-color-panel": color4.panel || "#232323",
    "--kp-color-panel-edge": color4.panelEdge || "#3a3a3a",
    "--kp-color-panel-edge-dark": color4.panelEdgeDark || "#111",
    "--kp-color-title-top": color4.titleTop || "#4c4c4c",
    "--kp-color-title-mid": color4.titleMid || "#353535",
    "--kp-color-title-bot": color4.titleBot || "#252525",
    "--kp-color-btn-top": color4.btnTop || "#4a4a4a",
    "--kp-color-btn-mid": color4.btnMid || "#343434",
    "--kp-color-btn-bot": color4.btnBot || "#2a2a2a",
    "--kp-color-lit-top": color4.litTop || "#5a7a9a",
    "--kp-color-lit-bot": color4.litBot || "#3a5570",
    "--kp-color-lit-edge": color4.litEdge || "#2a4a66",
    "--kp-color-accent": color4.accent || "#4a90c8",
    "--kp-color-accent-2": color4.accent2 || color4.accent || "#4a90c8",
    "--kp-color-fg": color4.fg || "#ddd",
    "--kp-color-fg-dim": color4.fgDim || "#aaa",
    "--kp-color-fg-mute": color4.fgMute || "#777",
    "--kp-color-field-bg": color4.fieldBg || "#141414",
    "--kp-color-field-edge": color4.fieldEdge || "#0a0a0a",
    "--kp-color-field-inset": color4.fieldInsetTop || "#333",
    "--kp-color-hover": color4.hover || "rgba(255,255,255,0.06)",
    "--kp-color-selected": color4.selected || "rgba(74,144,200,0.22)",
    "--kp-color-selected-text": color4.selectedText || "#e8f0f8",
    "--kp-color-focus-ring": color4.focusRing || "inset 0 0 0 1px rgba(74,144,200,0.55)",
    "--kp-color-kbd-fg": color4.kbdColor || color4.fg || "#ddd",
    "--kp-titlebar-bg": (() => {
      const titleGrad = `linear-gradient(180deg, ${color4.titleTop || "#4c4c4c"} 0%, ${color4.titleMid || "#353535"} 45%, ${color4.titleBot || "#252525"} 100%)`;
      const baked = String(effect.titlebarBg || "");
      const idx = baked.lastIndexOf("linear-gradient(180deg");
      return idx > 0 ? `${baked.slice(0, idx)}${titleGrad}` : titleGrad;
    })(),
    "--kp-titlebar-border": effect.titlebarBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-titlebar-shadow": effect.titlebarShadow || `0 1px 0 ${color4.panelEdge || "#3a3a3a"}`,
    "--kp-panel-bg": color4.panel || effect.panelBg || "#232323",
    "--kp-panel-border": effect.panelBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-panel-shadow": effect.panelShadow || `0 0 0 1px ${color4.panelEdge || "#3a3a3a"} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    "--kp-btn-bg": effect.btnBg || `linear-gradient(180deg, ${color4.btnTop || "#4a4a4a"} 0%, ${color4.btnMid || "#343434"} 50%, ${color4.btnBot || "#2a2a2a"} 100%)`,
    "--kp-btn-border": effect.btnBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-btn-lit-bg": effect.btnLitBg || `linear-gradient(180deg, ${color4.litTop || "#5a7a9a"} 0%, ${color4.litBot || "#3a5570"} 100%)`,
    "--kp-btn-lit-border": effect.btnLitBorder || `1px solid ${color4.litEdge || "#2a4a66"}`,
    "--kp-field-bg": effect.fieldBg || (color4.fieldBg || "#141414"),
    "--kp-field-border": effect.fieldBorder || `1px solid ${color4.fieldEdge || "#0a0a0a"}`,
    "--kp-field-shadow": effect.fieldShadow || `inset 0 1px 0 ${color4.fieldInsetTop || "#333"}`,
    "--kp-kbd-bg": effect.kbdBg || (color4.fieldBg || "#141414"),
    "--kp-kbd-border": effect.kbdBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-kbd-shadow": effect.kbdShadow || "none",
    "--kp-backdrop-bg": effect.backdropBg || "rgba(0,0,0,0.35)",
    "--kp-backdrop-blur": effect.backdropBlur || "blur(6px)",
    "--kp-hatch-edit": effect.hatchEdit || "repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)",
    "--kp-hatch-edit-titlebar-bg": effect.hatchEditTitlebarBg || "linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)",
    "--kp-hatch-edit-body-bg": effect.hatchEditBodyBg || "#1a1c20",
    "--kp-scrollbar-thumb": color4.scrollbarThumb || "#4a4a4a",
    "--kp-scrollbar-thumb-hover": color4.scrollbarThumbHover || "#5c5c5c",
    "--kp-scrollbar-track": color4.scrollbarTrack || (color4.fieldBg || "#141414"),
    "--kp-corner-mode": shape.cornerMode || "radius",
    "--kp-cut-size": shape.cutSize || "0px",
    "--kp-key-shading": keys.shading || "bevel",
    "--kp-key-border": keys.border || "1px solid rgba(0, 0, 0, 0.4)",
    "--kp-key-corner-mode": keys.cornerMode || "radius",
    "--kp-key-cut-size": keys.cutSize || "4px",
    "--kp-key-clip": keyCornerCut ? keyClipPath(keys.cutSize || "4px") : KEY_CLIP_NONE,
    "--kp-key-effective-radius": keyCornerCut ? "0px" : radius.key || "7px",
    // Used by @supports (corner-shape: bevel) upgrade (clip-path baseline otherwise).
    "--kp-key-shape-radius": keyCornerCut ? keys.cutSize || "4px" : radius.key || "7px",
    "--kp-key-corner-shape": keyCornerCut ? "bevel" : "round",
    "--kp-key-sheen-opacity": (keys.shading || "bevel") === "flat" ? "0" : "1",
    "--kp-key-shade-layer": (keys.shading || "bevel") === "flat" ? "transparent" : KEY_SHADE_BEVEL,
    "--kp-icon-chrome": iconColor.chrome || (color4.fg || "#ddd"),
    "--kp-icon-keycap": iconColor.keycap || (color4.fg || "#0c1018"),
    "--kp-icon-accent": iconColor.accent || (color4.accent || "#4a90c8"),
    "--kp-key-icon": iconColor.keycap || "#0c1018"
  };
  return vars;
}
function cssVarsToBlock(vars, selector = ":host, :root, [data-kp-theme]") {
  const lines = Object.entries(vars || {}).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {
${lines.join("\n")}
}`;
}
function getTitlebarChromeCss() {
  return `
.kp-titlebar-icon {
  display: var(--kp-titlebar-icon-display, none);
  width: var(--kp-titlebar-icon-size, 12px);
  height: var(--kp-titlebar-icon-size, 12px);
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
[data-kp-titlebar-shortcut],
.kp-titlebar-kbd {
  font-family: var(--kp-font-kbd, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: var(--kp-type-kbd-size, 10px);
  font-weight: var(--kp-type-weight-regular, 400);
  line-height: 1.2;
  text-transform: var(--kp-kbd-transform, none);
  letter-spacing: var(--kp-kbd-tracking, 0.02em);
  padding: 1px 6px;
  border: var(--kp-kbd-border, 1px solid #111);
  border-radius: var(--kp-radius-btn, 2px);
  background: var(--kp-kbd-bg, #141414);
  color: var(--kp-color-kbd-fg, #ddd);
  box-shadow: var(--kp-kbd-shadow, none);
  box-sizing: border-box;
}
.kpv2-popover-titlebar,
[data-kp-popover-titlebar],
[data-kp-floating-keyboard-titlebar],
.kp-cfg-titlebar,
.kp-action-config-panel__titlebar,
.kp-procedure-result__titlebar,
.kp-practice-popover__header {
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.kpv2-popover-titlebar-title,
[data-kp-floating-keyboard-title],
.kp-cfg-title,
.kp-action-config-panel__title,
.kp-procedure-result__title,
.kp-practice-popover__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
  color: var(--kp-color-fg, inherit);
}
`.trim();
}
function getSelectMenuCss() {
  return `
.kp-select {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  box-sizing: border-box;
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
}
.kp-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2px 6px;
  border: var(--kp-field-border, 1px solid #0a0a0a);
  border-radius: var(--kp-radius-field, 2px);
  background: var(--kp-field-bg, #141414);
  color: var(--kp-color-fg, #ddd);
  box-shadow: var(--kp-field-shadow, none);
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}
.kp-select--titlebar .kp-select-trigger {
  width: 190px;
  height: 22px;
  margin-left: 6px;
}
.kp-select-trigger:hover {
  background: color-mix(in srgb, var(--kp-color-hover, rgba(255,255,255,0.08)) 70%, var(--kp-field-bg, #141414));
}
.kp-select-trigger:focus-visible {
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: 1px;
}
.kp-select.is-open .kp-select-trigger,
.kp-select-trigger[aria-expanded="true"] {
  border-color: var(--kp-color-accent, #4a90c8);
}
.kp-select-trigger-icon,
.kp-select-item-icon {
  display: block;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
.kp-select-trigger-label,
.kp-select-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kp-select-chevron {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-left: 3.5px solid transparent;
  border-right: 3.5px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.65;
  flex: 0 0 auto;
}
.kp-select-menu {
  position: fixed;
  /* Kill UA popover centering (inset 0 / margin auto) without locking longhands. */
  margin: 0;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: max-content;
  height: fit-content;
  z-index: 2147483049;
  padding: 4px 0;
  min-width: 190px;
  max-width: min(360px, calc(100vw - 16px));
  max-height: min(320px, calc(100vh - 16px));
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
  border: var(--kp-panel-border, 1px solid #111);
  border-radius: var(--kp-radius-panel, 3px);
  background: var(--kp-panel-bg, #232323);
  box-shadow: var(--kp-panel-shadow, 0 8px 24px rgba(0,0,0,0.45));
  color: var(--kp-color-fg, #ddd);
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
  font-size: 12px;
  line-height: 1.3;
}
.kp-select-menu[data-kp-select-fallback="true"][hidden] {
  display: none !important;
}
.kp-select-group {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--kp-color-fg-mute, #777);
  pointer-events: none;
  user-select: none;
}
.kp-select-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--kp-color-field-edge, #0a0a0a);
  border: 0;
  pointer-events: none;
}
.kp-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 5px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  outline: none;
}
.kp-select-item:hover,
.kp-select-item.is-active {
  background: var(--kp-color-hover, rgba(255,255,255,0.08));
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: -1px;
}
.kp-select-item[aria-selected="true"] {
  background: var(--kp-color-selected, rgba(74, 144, 200, 0.28));
  color: var(--kp-color-selected-text, var(--kp-color-fg, #ddd));
}
.kp-select-item .kp-titlebar-kbd {
  margin-left: auto;
  flex-shrink: 0;
}
`.trim();
}
function getCutCornerCss() {
  return `
.kp-chrome-window {
  overflow: hidden;
}
.kp-chrome-window:not([data-kp-corner="cut"]) {
  border-radius: var(--kp-radius-panel, 3px);
}
/* Baseline (presentation): proven clip-path chamfer */
[data-kp-corner="cut"],
:host([data-kp-corner="cut"]),
.kp-chrome-window[data-kp-corner="cut"] {
  clip-path: polygon(
    var(--kp-cut-size, 8px) 0,
    calc(100% - var(--kp-cut-size, 8px)) 0,
    100% var(--kp-cut-size, 8px),
    100% calc(100% - var(--kp-cut-size, 8px)),
    calc(100% - var(--kp-cut-size, 8px)) 100%,
    var(--kp-cut-size, 8px) 100%,
    0 calc(100% - var(--kp-cut-size, 8px)),
    0 var(--kp-cut-size, 8px)
  );
  border-radius: 0;
}
/* Upgrade: native chamfer keeps stroke + shadow on the cut edge */
@supports (corner-shape: bevel) {
  [data-kp-corner="cut"],
  :host([data-kp-corner="cut"]),
  .kp-chrome-window[data-kp-corner="cut"] {
    clip-path: none !important;
    border-radius: var(--kp-cut-size, 8px) !important;
    corner-shape: bevel;
  }
}
`.trim();
}
function mergeTheme(base2, overrides) {
  if (!overrides || typeof overrides !== "object") return base2;
  const out = { ...base2 };
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base2[k] && typeof base2[k] === "object" && !Array.isArray(base2[k])) {
      out[k] = mergeTheme(base2[k], v);
    } else if (v !== void 0) {
      out[k] = v;
    }
  }
  return out;
}
function normalizeThemeId(raw) {
  const id = typeof raw === "string" ? raw.trim() : "";
  return THEME_IDS.includes(id) ? id : DEFAULT_THEME_ID;
}

// src/config/search-engines.js
var SEARCH_ENGINE_META = Object.freeze({
  brave: Object.freeze({
    id: "brave",
    label: "Brave",
    homeUrl: "https://search.brave.com/",
    searchUrlPrefix: "https://search.brave.com/search?q="
  }),
  google: Object.freeze({
    id: "google",
    label: "Google",
    homeUrl: "https://www.google.com/",
    searchUrlPrefix: "https://www.google.com/search?q="
  }),
  duckduckgo: Object.freeze({
    id: "duckduckgo",
    label: "DuckDuckGo",
    homeUrl: "https://duckduckgo.com/",
    searchUrlPrefix: "https://duckduckgo.com/?q="
  })
});
var DEFAULT_SEARCH_ENGINE_ID = (
  /** @type {SearchEngineId} */
  "brave"
);
var LAUNCHER_SEARCH_SITES = Object.freeze([
  Object.freeze({ title: "Google", url: "https://google.com", isDefault: true }),
  Object.freeze({ title: "Bing", url: "https://bing.com", isDefault: true }),
  Object.freeze({ title: "DuckDuckGo", url: "https://duckduckgo.com", isDefault: true }),
  Object.freeze({ title: "Yahoo", url: "https://yahoo.com", isDefault: true }),
  Object.freeze({ title: "Brave Search", url: "https://search.brave.com", isDefault: true }),
  Object.freeze({ title: "Ecosia", url: "https://ecosia.org", isDefault: true }),
  Object.freeze({ title: "Startpage", url: "https://startpage.com", isDefault: true }),
  Object.freeze({ title: "Yandex", url: "https://yandex.com", isDefault: true })
]);
function normalizeSearchEngineId(raw) {
  if (raw === "google" || raw === "duckduckgo" || raw === "brave") return raw;
  return DEFAULT_SEARCH_ENGINE_ID;
}

// src/utils/storage.js
function pickNewerStoredValue(syncVal, localVal) {
  const syncAt = syncVal && typeof syncVal === "object" ? Number(syncVal._updatedAt) : 0;
  const localAt = localVal && typeof localVal === "object" ? Number(localVal._updatedAt) : 0;
  const syncTs = Number.isFinite(syncAt) ? syncAt : 0;
  const localTs = Number.isFinite(localAt) ? localAt : 0;
  if (syncTs && localTs) return localTs >= syncTs ? localVal : syncVal;
  if (localTs && !syncTs) return localVal;
  if (syncTs && !localTs) return syncVal;
  return syncVal;
}
async function storageGetValue(key, defaultValue = void 0) {
  if (!key || typeof key !== "string") return defaultValue;
  let syncVal = void 0;
  let syncHas = false;
  try {
    if (chrome?.storage?.sync?.get) {
      const syncResult = await chrome.storage.sync.get([key]);
      if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key) && syncResult[key] !== void 0) {
        syncHas = true;
        syncVal = /** @type {T} */
        syncResult[key];
      }
    }
  } catch {
  }
  let localVal = void 0;
  let localHas = false;
  try {
    if (chrome?.storage?.local?.get) {
      const localResult = await chrome.storage.local.get([key]);
      if (localResult && Object.prototype.hasOwnProperty.call(localResult, key) && localResult[key] !== void 0) {
        localHas = true;
        localVal = /** @type {T} */
        localResult[key];
      }
    }
  } catch {
  }
  if (syncHas && localHas) return pickNewerStoredValue(syncVal, localVal);
  if (syncHas) return syncVal;
  if (localHas) return localVal;
  return defaultValue;
}

// src/utils/platform.js
function isMacPlatform() {
  try {
    const uaPlatform = navigator.userAgentData?.platform;
    if (typeof uaPlatform === "string" && uaPlatform) {
      return uaPlatform === "macOS";
    }
  } catch {
  }
  try {
    const plat = String(navigator.platform || "");
    const ua = String(navigator.userAgent || "");
    return /^Mac/i.test(plat) || /Mac OS X/i.test(ua);
  } catch {
  }
  return false;
}

// src/modules/settings-manager.js
var SETTINGS_STORAGE_KEY = "kp_settings_v1";
var TEXT_FOCUS_STYLE_IDS = Object.freeze(
  /** @type {const} */
  [
    "left_edge",
    "background_tint"
  ]
);
var CLICK_EFFECT_IDS = Object.freeze(
  /** @type {const} */
  [
    "flash",
    "dash",
    "marquee",
    "scale",
    "none"
  ]
);
var DEFAULT_SETTINGS = Object.freeze({
  themeId: DEFAULT_THEME_ID,
  themeOverrides: Object.freeze({}),
  // Last theme whose clickDefaults were written into clickMode/cursorMode.
  // Empty means never synced (adopt the active theme's click defaults once).
  clickModeThemeId: "",
  searchEngine: DEFAULT_SEARCH_ENGINE_ID,
  cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
  // New model:
  // - keyboardLayoutFamilyId + keyboardHandedness are the user-facing selection.
  // - keyboardLayoutId is the resolved concrete implementation (kept for back-compat + early-inject).
  keyboardLayoutFamilyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID,
  keyboardHandedness: DEFAULT_KEYBOARD_HANDEDNESS,
  keyboardLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
  // Active layout selection for runtime + keyboard reference:
  // - 'builtin' uses the current built-in family + handedness selection.
  // - 'user:<layoutId>' uses a stored user layout (created/duplicated in Alt+C).
  currentKeyboardLayoutId: "builtin",
  // When true, the floating keyboard reference panel highlights keys on keydown/keyup.
  keyboardReferenceKeyFeedback: true,
  // When true, the floating keyboard reference panel includes the number row (1–0).
  // Default is off to keep the panel compact.
  keyboardReferenceShowNumberRow: false,
  // When true, the floating keyboard reference panel is titlebar-only (body hidden).
  keyboardReferenceCollapsed: false,
  // When true, Top Sites remounts on each page while left open (Keyboard Reference-style).
  topSitesPersistent: false,
  // Actions Library hierarchical table: expanded group keys (top-level open by default;
  // nested categories / parents start collapsed until the user opens them).
  actionsLibraryTableExpanded: Object.freeze(["functions", "macros", "macroKeys"]),
  // Floating Control Strip (upper-left): visibility + collapsed (On/Off-only) state.
  controlStrip: Object.freeze({
    visible: true,
    collapsed: true
  }),
  // Dock / free positions for movable chrome (keyboard reference, control strip, …).
  // Anchors re-resolve on resize; free left/top reclamps inside the viewport margin.
  panelPositions: Object.freeze({
    keyboardReference: Object.freeze({ anchor: "bottom-left" }),
    controlStrip: Object.freeze({ anchor: "top-left" }),
    keyboardLayoutConfig: Object.freeze({ anchor: "middle-right" }),
    // Empty: first open stays viewport-centered until the user moves/resizes.
    topSites: Object.freeze({})
  }),
  // Per-key action settings (Keyboard Reference mode switches / config params).
  actionSettings: Object.freeze({
    RECTANGLE_HIGHLIGHT: Object.freeze({
      mode: "element",
      parameters: Object.freeze({})
    })
  }),
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      // Cursor SVG stroke width. Slider range: 1–12.
      lineWidth: 4,
      // Cursor size in pixels. Default is half of previous (was ~30px, now 15px).
      sizePixels: 10,
      // Gap between center and crosshair bars in pixels. 0 = intersecting lines, >0 = separate bars.
      gap: 6
    }),
    // Hover focus ring color (DOM-hover mode default is blue).
    focusColor: "blue",
    // When true, the focus rectangle can include a translucent fill (where applicable).
    overlayFillEnabled: false,
    // When true, draw a soft outer glow/shadow on the focus rectangle.
    overlayShadowEnabled: false,
    // Focus rectangle border thickness in px.
    rectangleThickness: 3,
    // F-key activation feedback on link-style targets (flash is the default).
    clickEffect: "flash",
    // When true, hovering a link glows matching green keys on the Keyboard Reference.
    // Off by default (opt-in via Settings → Click Mode).
    keyboardLinkHoverHints: false,
    // Default skip DOM outline (A); use in-target (B) then body-fixed (C).
    // Matches Shadow Root Debug “Auto B→C”.
    paintStrategy: "BC",
    // When true, dash A/B/C hover rings differently for paint-backend recognition.
    // Off by default (opt-in via Settings → Click Mode → Advanced).
    paintBackendDebugDashes: false,
    // Outward ring padding (px). Strategy A uses this as preferred outline-offset;
    // B/C expand their boxes by the same amount (A historically ~2px; B→C was 0).
    focusPadding: 2
  }),
  textMode: Object.freeze({
    cursorType: "t_square",
    // When true, show both labels: "Active text field" + "Press ESC to close".
    labelsEnabled: false,
    // Stroke thickness in px for orange text-mode rectangles.
    strokeThickness: 3,
    // How the focused text field is styled while in text mode.
    // left_edge: pulsating orange bar on the left inset edge (default).
    // background_tint: full-field orange wash (legacy).
    focusStyle: "left_edge",
    // Width of the left-edge pulse bar in px (when focusStyle is left_edge).
    leftEdgeWidth: 5
  }),
  scroll: Object.freeze({
    // C / V scroll distance in pixels (default = prior 400 × 1.25).
    halfPagePx: SCROLL.HALF_PAGE_PX,
    // Animation speed for keyboard scrolling: smooth (animated) or instant (jump).
    speed: SCROLL.BEHAVIOR === "smooth" ? "smooth" : "instant",
    // Middle mouse button → Scroll Line Function (empty page only). On by default on Mac.
    middleClickScrollLine: isMacPlatform(),
    // Scroll Line: skip wide in-page overflow (carousels); keep square / taller boxes.
    linePreferPortraitTargets: true
  })
});
function normalizeSearchEngine(raw) {
  return normalizeSearchEngineId(raw);
}
function normalizeCursorMode(raw) {
  if (raw === CURSOR_MODE.NO_CUSTOM_CURSORS || raw === CURSOR_MODE.CUSTOM_CURSORS) return raw;
  return DEFAULT_SETTINGS.cursorMode;
}
function normalizeThemeOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}
function normalizeBoolean(raw, fallback) {
  if (raw === true || raw === false) return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return !!fallback;
}
function normalizeCurrentKeyboardLayoutId(raw) {
  const v = String(raw || "").trim();
  if (!v) return DEFAULT_SETTINGS.currentKeyboardLayoutId;
  if (v === "builtin") return "builtin";
  if (v.startsWith("user:") && v.length > "user:".length) return v;
  return DEFAULT_SETTINGS.currentKeyboardLayoutId;
}
function normalizeNumber(raw, fallback, min, max) {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  const v = Number.isFinite(n) ? n : fallback;
  const clamped = Math.min(Math.max(v, min), max);
  return clamped;
}
function normalizeClickCursorType(raw) {
  if (raw === "crosshair" || raw === "native_arrow" || raw === "native_pointer") return raw;
  return DEFAULT_SETTINGS.clickMode.cursor.type;
}
function normalizeClickEffect(raw) {
  if (raw === "flash" || raw === "dash" || raw === "marquee" || raw === "scale" || raw === "none") {
    return raw;
  }
  return DEFAULT_SETTINGS.clickMode.clickEffect;
}
function normalizeTextCursorType(raw) {
  if (raw === "t_square" || raw === "crosshair") return raw;
  return DEFAULT_SETTINGS.textMode.cursorType;
}
function normalizeTextFocusStyle(raw) {
  if (raw === "left_edge" || raw === "background_tint") return raw;
  return DEFAULT_SETTINGS.textMode.focusStyle;
}
function normalizeFocusColor(raw) {
  if (raw === "blue" || raw === "green") return raw;
  return DEFAULT_SETTINGS.clickMode.focusColor;
}
function normalizePaintStrategy(raw) {
  if (raw === "auto" || raw === "BC") return raw;
  const upper = raw == null ? "" : String(raw).trim().toUpperCase();
  if (upper === "B->C" || upper === "B\u2192C" || upper === "AUTO_BC" || upper === "AUTO-BC" || upper === "AUTO B->C" || upper === "AUTO B\u2192C") {
    return "BC";
  }
  if (upper === "AUTO" || upper === "A->B->C" || upper === "A\u2192B\u2192C") {
    return "auto";
  }
  return DEFAULT_SETTINGS.clickMode.paintStrategy;
}
function normalizeClickMode(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const storedCursor = stored.cursor && typeof stored.cursor === "object" ? stored.cursor : {};
  return {
    cursor: {
      type: normalizeClickCursorType(storedCursor.type),
      lineWidth: normalizeNumber(
        storedCursor.lineWidth,
        DEFAULT_SETTINGS.clickMode.cursor.lineWidth,
        1,
        12
      ),
      sizePixels: normalizeNumber(
        storedCursor.sizePixels,
        DEFAULT_SETTINGS.clickMode.cursor.sizePixels,
        5,
        60
      ),
      gap: normalizeNumber(
        storedCursor.gap,
        DEFAULT_SETTINGS.clickMode.cursor.gap,
        0,
        20
      )
    },
    focusColor: normalizeFocusColor(stored.focusColor),
    overlayFillEnabled: normalizeBoolean(
      stored.overlayFillEnabled,
      DEFAULT_SETTINGS.clickMode.overlayFillEnabled
    ),
    overlayShadowEnabled: normalizeBoolean(
      stored.overlayShadowEnabled,
      DEFAULT_SETTINGS.clickMode.overlayShadowEnabled
    ),
    rectangleThickness: normalizeNumber(
      stored.rectangleThickness,
      DEFAULT_SETTINGS.clickMode.rectangleThickness,
      1,
      16
    ),
    clickEffect: normalizeClickEffect(stored.clickEffect),
    keyboardLinkHoverHints: normalizeBoolean(
      stored.keyboardLinkHoverHints,
      DEFAULT_SETTINGS.clickMode.keyboardLinkHoverHints
    ),
    paintStrategy: normalizePaintStrategy(stored.paintStrategy),
    paintBackendDebugDashes: normalizeBoolean(
      stored.paintBackendDebugDashes,
      DEFAULT_SETTINGS.clickMode.paintBackendDebugDashes
    ),
    focusPadding: normalizeNumber(
      stored.focusPadding,
      DEFAULT_SETTINGS.clickMode.focusPadding,
      0,
      16
    )
  };
}
function normalizeTextMode(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    cursorType: normalizeTextCursorType(stored.cursorType),
    labelsEnabled: normalizeBoolean(stored.labelsEnabled, DEFAULT_SETTINGS.textMode.labelsEnabled),
    strokeThickness: normalizeNumber(
      stored.strokeThickness,
      DEFAULT_SETTINGS.textMode.strokeThickness,
      1,
      16
    ),
    focusStyle: normalizeTextFocusStyle(stored.focusStyle),
    leftEdgeWidth: normalizeNumber(
      stored.leftEdgeWidth,
      DEFAULT_SETTINGS.textMode.leftEdgeWidth,
      1,
      24
    )
  };
}
function normalizeScrollSpeed(raw) {
  if (raw === "smooth" || raw === "instant") return raw;
  if (raw === "auto") return "instant";
  return DEFAULT_SETTINGS.scroll.speed;
}
function normalizeScroll(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const middleClickDefault = DEFAULT_SETTINGS.scroll.middleClickScrollLine;
  return {
    halfPagePx: normalizeNumber(
      stored.halfPagePx,
      DEFAULT_SETTINGS.scroll.halfPagePx,
      50,
      2e3
    ),
    speed: normalizeScrollSpeed(stored.speed),
    // Missing key → platform default (Mac on, others off). Explicit boolean is honored on any OS.
    middleClickScrollLine: normalizeBoolean(stored.middleClickScrollLine, middleClickDefault),
    linePreferPortraitTargets: normalizeBoolean(
      stored.linePreferPortraitTargets,
      DEFAULT_SETTINGS.scroll.linePreferPortraitTargets
    )
  };
}
function normalizeControlStrip(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    visible: normalizeBoolean(stored.visible, DEFAULT_SETTINGS.controlStrip.visible),
    collapsed: normalizeBoolean(stored.collapsed, DEFAULT_SETTINGS.controlStrip.collapsed)
  };
}
var PANEL_ANCHOR_IDS = /* @__PURE__ */ new Set([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);
function normalizePanelPositionEntry(raw, fallback) {
  const fb = fallback && typeof fallback === "object" ? fallback : {};
  if (!raw || typeof raw !== "object") {
    return {
      left: Number.isFinite(fb.left) ? fb.left : void 0,
      top: Number.isFinite(fb.top) ? fb.top : void 0,
      anchor: typeof fb.anchor === "string" ? fb.anchor : fb.anchor === null ? null : void 0
    };
  }
  const out = {};
  const left = typeof raw.left === "number" ? raw.left : typeof raw.left === "string" ? Number(raw.left) : NaN;
  const top = typeof raw.top === "number" ? raw.top : typeof raw.top === "string" ? Number(raw.top) : NaN;
  const width = typeof raw.width === "number" ? raw.width : typeof raw.width === "string" ? Number(raw.width) : NaN;
  const height = typeof raw.height === "number" ? raw.height : typeof raw.height === "string" ? Number(raw.height) : NaN;
  if (Number.isFinite(left)) out.left = left;
  if (Number.isFinite(top)) out.top = top;
  if (Number.isFinite(width) && width > 0) out.width = width;
  if (Number.isFinite(height) && height > 0) out.height = height;
  if (raw.anchor === null) {
    out.anchor = null;
  } else if (typeof raw.anchor === "string" && PANEL_ANCHOR_IDS.has(raw.anchor.trim())) {
    out.anchor = raw.anchor.trim();
  } else if (typeof fb.anchor === "string" && !Number.isFinite(left) && !Number.isFinite(top)) {
    out.anchor = fb.anchor;
  }
  if (out.left === void 0 && out.top === void 0 && out.anchor === void 0) {
    return {
      left: Number.isFinite(fb.left) ? fb.left : void 0,
      top: Number.isFinite(fb.top) ? fb.top : void 0,
      anchor: typeof fb.anchor === "string" ? fb.anchor : fb.anchor === null ? null : void 0
    };
  }
  return out;
}
function normalizePanelPositions(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    keyboardReference: normalizePanelPositionEntry(
      stored.keyboardReference,
      DEFAULT_SETTINGS.panelPositions.keyboardReference
    ),
    controlStrip: normalizePanelPositionEntry(
      stored.controlStrip,
      DEFAULT_SETTINGS.panelPositions.controlStrip
    ),
    keyboardLayoutConfig: normalizePanelPositionEntry(
      stored.keyboardLayoutConfig,
      DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
    ),
    topSites: normalizePanelPositionEntry(
      stored.topSites,
      DEFAULT_SETTINGS.panelPositions.topSites
    )
  };
}
function normalizeStringIdList(raw, fallback) {
  const fb = Array.isArray(fallback) ? [...fallback] : [];
  if (!Array.isArray(raw)) return fb;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function normalizeActionsLibraryTableExpanded(raw) {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SETTINGS.actionsLibraryTableExpanded];
  }
  return normalizeStringIdList(raw, DEFAULT_SETTINGS.actionsLibraryTableExpanded);
}
function normalizeActionSettings(raw) {
  const defaults = DEFAULT_SETTINGS.actionSettings || {};
  const stored = raw && typeof raw === "object" ? raw : {};
  const out = {};
  const keys = /* @__PURE__ */ new Set([...Object.keys(defaults), ...Object.keys(stored)]);
  for (const actionId of keys) {
    const fb = defaults[actionId] && typeof defaults[actionId] === "object" ? defaults[actionId] : {};
    const entry = stored[actionId] && typeof stored[actionId] === "object" ? stored[actionId] : {};
    const mode = typeof entry.mode === "string" && entry.mode ? entry.mode : typeof fb.mode === "string" ? fb.mode : void 0;
    const parameters = {
      ...fb.parameters && typeof fb.parameters === "object" ? fb.parameters : {},
      ...entry.parameters && typeof entry.parameters === "object" ? entry.parameters : {}
    };
    out[actionId] = { mode, parameters };
  }
  return out;
}
async function getSettings() {
  try {
    let stored = await storageGetValue(SETTINGS_STORAGE_KEY, null);
    if (!stored || typeof stored !== "object") stored = {};
    let familyId = normalizeKeyboardLayoutFamilyId(stored?.keyboardLayoutFamilyId);
    let handedness = normalizeKeyboardHandedness(stored?.keyboardHandedness);
    const hasNewFields = Object.prototype.hasOwnProperty.call(stored || {}, "keyboardLayoutFamilyId") || Object.prototype.hasOwnProperty.call(stored || {}, "keyboardHandedness");
    if (!hasNewFields) {
      const inferred = inferFamilyAndHandednessFromLayoutId(stored?.keyboardLayoutId);
      familyId = normalizeKeyboardLayoutFamilyId(inferred.familyId);
      handedness = normalizeKeyboardHandedness(inferred.handedness);
    }
    const resolvedLayoutId = resolveKeyboardLayoutId({ familyId, handedness });
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      themeId: normalizeThemeId(stored?.themeId),
      themeOverrides: normalizeThemeOverrides(stored?.themeOverrides),
      clickModeThemeId: typeof stored?.clickModeThemeId === "string" && stored.clickModeThemeId.trim() ? normalizeThemeId(stored.clickModeThemeId) : "",
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardLayoutFamilyId: familyId,
      keyboardHandedness: handedness,
      keyboardLayoutId: resolvedLayoutId,
      currentKeyboardLayoutId: normalizeCurrentKeyboardLayoutId(stored?.currentKeyboardLayoutId),
      keyboardReferenceKeyFeedback: normalizeBoolean(
        stored?.keyboardReferenceKeyFeedback,
        DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
      ),
      keyboardReferenceShowNumberRow: normalizeBoolean(
        stored?.keyboardReferenceShowNumberRow,
        DEFAULT_SETTINGS.keyboardReferenceShowNumberRow
      ),
      keyboardReferenceCollapsed: normalizeBoolean(
        stored?.keyboardReferenceCollapsed,
        DEFAULT_SETTINGS.keyboardReferenceCollapsed
      ),
      topSitesPersistent: normalizeBoolean(
        stored?.topSitesPersistent,
        DEFAULT_SETTINGS.topSitesPersistent
      ),
      actionsLibraryTableExpanded: normalizeActionsLibraryTableExpanded(
        stored?.actionsLibraryTableExpanded
      ),
      controlStrip: normalizeControlStrip(stored?.controlStrip),
      panelPositions: normalizePanelPositions(stored?.panelPositions),
      actionSettings: normalizeActionSettings(stored?.actionSettings),
      clickMode: normalizeClickMode(stored?.clickMode),
      textMode: normalizeTextMode(stored?.textMode),
      scroll: normalizeScroll(stored?.scroll)
    };
  } catch (_e) {
    return {
      ...DEFAULT_SETTINGS,
      controlStrip: { ...DEFAULT_SETTINGS.controlStrip },
      panelPositions: {
        keyboardReference: { ...DEFAULT_SETTINGS.panelPositions.keyboardReference },
        controlStrip: { ...DEFAULT_SETTINGS.panelPositions.controlStrip },
        keyboardLayoutConfig: { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig },
        topSites: { ...DEFAULT_SETTINGS.panelPositions.topSites }
      },
      actionSettings: normalizeActionSettings(null),
      clickMode: { ...DEFAULT_SETTINGS.clickMode, cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } },
      textMode: { ...DEFAULT_SETTINGS.textMode },
      scroll: { ...DEFAULT_SETTINGS.scroll },
      actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
      themeId: DEFAULT_THEME_ID,
      themeOverrides: {},
      clickModeThemeId: ""
    };
  }
}

// themes/chrome-recipes.js
var METAL_SPECULAR = "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 28%, transparent 55%)";
function createDarkProColor() {
  return {
    bg: "#0f0f10",
    panel: "#232323",
    panelEdge: "#3a3a3a",
    panelEdgeDark: "#111",
    titleTop: "#4c4c4c",
    titleMid: "#353535",
    titleBot: "#252525",
    btnTop: "#4a4a4a",
    btnMid: "#343434",
    btnBot: "#2a2a2a",
    litTop: "#5a7a9a",
    litBot: "#3a5570",
    litEdge: "#2a4a66",
    accent: "#4a90c8",
    accent2: "#4a90c8",
    fg: "#ddd",
    fgDim: "#aaa",
    fgMute: "#777",
    fieldBg: "#141414",
    fieldEdge: "#0a0a0a",
    fieldInsetTop: "#333",
    hover: "rgba(255,255,255,0.06)",
    selected: "rgba(74,144,200,0.22)",
    selectedText: "#e8f0f8",
    focusRing: "inset 0 0 0 1px rgba(74,144,200,0.55)",
    kbdColor: "#ddd",
    scrollbarThumb: "#4a4a4a",
    scrollbarThumbHover: "#5c5c5c",
    scrollbarTrack: "#141414"
  };
}
function createDarkProEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.panelEdge}`,
    panelBg: c.panel,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow: `0 0 0 1px ${c.panelEdge} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: c.fieldBg,
    kbdBorder: `1px solid ${c.panelEdgeDark}`,
    kbdShadow: "none",
    backdropBg: "rgba(0,0,0,0.35)",
    backdropBlur: "blur(6px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: "linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)",
    hatchEditBodyBg: "#1a1c20"
  };
}
function createMetalColor() {
  return {
    bg: "#6e6e6e",
    panel: "#838383",
    panelEdge: "rgba(190,190,190,0.48)",
    panelEdgeDark: "rgba(42,52,62,0.92)",
    titleTop: "#b0b0b0",
    titleMid: "#929292",
    titleBot: "#787878",
    btnTop: "#c2c2c2",
    btnMid: "#9e9e9e",
    btnBot: "#868686",
    litTop: "#7aa0c0",
    litBot: "#4a7090",
    litEdge: "#3a5a78",
    accent: "#3a6a94",
    accent2: "#3a6a94",
    fg: "#1c1c1c",
    fgDim: "rgba(28,28,28,0.72)",
    fgMute: "rgba(28,28,28,0.55)",
    fieldBg: "#9a9a9a",
    fieldEdge: "#4a4a4a",
    fieldInsetTop: "rgba(255,255,255,0.35)",
    hover: "rgba(255,255,255,0.22)",
    selected: "rgba(58,106,148,0.28)",
    selectedText: "#0e1a24",
    focusRing: "inset 0 0 0 1px rgba(58,106,148,0.55)",
    kbdColor: "#141414",
    scrollbarThumb: "#a8a8a8",
    scrollbarThumbHover: "#b5b5b5",
    scrollbarTrack: "#747474"
  };
}
function createMetalEffect(c) {
  return {
    titlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: "1px solid #4a4a4a",
    titlebarShadow: "0 1px 0 rgba(255,255,255,0.35)",
    panelBg: `${METAL_SPECULAR}, linear-gradient(180deg, #9a9a9a 0%, #838383 48%, #707070 100%)`,
    panelBorder: "1px solid rgba(42,52,62,0.92)",
    panelShadow: "0 0 0 1px rgba(255,255,255,0.28) inset, 0 0 0 1px rgba(190,190,190,0.48), 0 0 10px rgba(255,255,255,0.12), 0 16px 40px rgba(0,0,0,0.45)",
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: "1px solid #4a4a4a",
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: "1px solid #4a4a4a",
    fieldShadow: "inset 0 1px 0 rgba(255,255,255,0.40)",
    kbdBg: "linear-gradient(180deg, #e4e4e4 0%, #c8c8c8 45%, #b0b0b0 55%, #9a9a9a 100%)",
    kbdBorder: "1px solid #3d3d3d",
    kbdShadow: "0 1px 0 rgba(255,255,255,0.72) inset, 0 -1px 0 rgba(0,0,0,0.28) inset, 0 1px 2px rgba(0,0,0,0.32)",
    backdropBg: "rgba(40,40,40,0.35)",
    backdropBlur: "blur(6px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(24, 24, 24, 0.28) 0px, rgba(24, 24, 24, 0.28) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, #b8b8b8 0%, #9a9a9a 45%, #808080 100%)`,
    hatchEditBodyBg: "#8a8a8a"
  };
}
function createGxColor() {
  return {
    bg: "#0a0a0c",
    panel: "#16161a",
    panelEdge: "#2a2a32",
    panelEdgeDark: "#050506",
    titleTop: "#2c2c34",
    titleMid: "#1c1c22",
    titleBot: "#121216",
    btnTop: "#3a3a44",
    btnMid: "#26262e",
    btnBot: "#1a1a20",
    litTop: "#00e5ff",
    litBot: "#0088aa",
    litEdge: "#006688",
    accent: "#00e5ff",
    accent2: "#ff2d95",
    fg: "#e8e8ef",
    fgDim: "#9aa0b0",
    fgMute: "#6a7080",
    fieldBg: "#0c0c10",
    fieldEdge: "#000",
    fieldInsetTop: "#333344",
    hover: "rgba(0,229,255,0.08)",
    selected: "rgba(0,229,255,0.18)",
    selectedText: "#f0ffff",
    focusRing: "inset 0 0 0 1px rgba(0,229,255,0.55)",
    kbdColor: "#00e5ff",
    scrollbarThumb: "#3a3a44",
    scrollbarThumbHover: "#00e5ff",
    scrollbarTrack: "#0c0c10"
  };
}
function createGxEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.accent}33`,
    panelBg: `linear-gradient(180deg, #1c1c22 0%, ${c.panel} 48%, #101014 100%)`,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow: `0 0 0 1px ${c.panelEdge} inset, 0 0 0 1px rgba(0, 229, 255, 0.22), 0 0 14px rgba(0, 229, 255, 0.12), 0 16px 40px rgba(0,0,0,0.65)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: "rgba(0, 229, 255, 0.08)",
    kbdBorder: `1px solid ${c.accent}`,
    kbdShadow: `0 0 0 1px ${c.accent}55, 0 0 8px ${c.accent}44`,
    backdropBg: "rgba(0,0,0,0.5)",
    backdropBlur: "blur(8px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(0, 229, 255, 0.16) 0px, rgba(0, 229, 255, 0.16) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    hatchEditBodyBg: "#101014"
  };
}

// themes/click-defaults.js
var NO_CUSTOM = "NO-CUSTOM-CURSORS";
var DARK_PRO_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 4,
      sizePixels: 10,
      gap: 6
    }),
    focusColor: "blue",
    overlayFillEnabled: false,
    overlayShadowEnabled: false,
    rectangleThickness: 3,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2
  })
});
var GRAY_METAL_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 5,
      sizePixels: 12,
      gap: 6
    }),
    focusColor: "blue",
    overlayFillEnabled: false,
    overlayShadowEnabled: false,
    rectangleThickness: 4,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2
  })
});
var GX_ER_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 3,
      sizePixels: 14,
      gap: 8
    }),
    focusColor: "green",
    overlayFillEnabled: false,
    overlayShadowEnabled: true,
    rectangleThickness: 3,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2
  })
});

// themes/dark-pro/theme.js
var color = createDarkProColor();
var metalColor = createMetalColor();
var DARK_PRO_THEME = Object.freeze({
  id: "dark-pro",
  meta: Object.freeze({ name: "Dark Pro" }),
  type: createProTypeTokens(),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens(),
  color,
  effect: createDarkProEffect(color),
  shape: Object.freeze({ cornerMode: "radius", cutSize: "0px" }),
  icons: Object.freeze({
    pack: "dark-pro",
    fallbackPack: "shared",
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color.fg,
      keycap: "#0c1018",
      accent: color.accent
    })
  }),
  clickDefaults: DARK_PRO_CLICK_DEFAULTS,
  surfaces: Object.freeze({
    onboarding: Object.freeze({
      color: metalColor,
      effect: createMetalEffect(metalColor),
      icons: Object.freeze({
        color: Object.freeze({
          chrome: metalColor.fg,
          keycap: "#1c1c1c",
          accent: metalColor.accent
        })
      })
    })
  })
});

// themes/gray-metal-pro/theme.js
var color2 = createMetalColor();
var GRAY_METAL_PRO_THEME = Object.freeze({
  id: "gray-metal-pro",
  meta: Object.freeze({ name: "Gray Metal Pro" }),
  type: createProTypeTokens({
    ui: "Helvetica, Arial, sans-serif"
  }),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens({ panel: "3px", btn: "2px" }),
  color: color2,
  effect: createMetalEffect(color2),
  shape: Object.freeze({ cornerMode: "radius", cutSize: "0px" }),
  icons: Object.freeze({
    pack: "gray-metal-pro",
    fallbackPack: "shared",
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color2.fg,
      keycap: "#1c1c1c",
      accent: color2.accent
    })
  }),
  clickDefaults: GRAY_METAL_CLICK_DEFAULTS
});

// themes/gx-er/theme.js
var color3 = createGxColor();
var type = createProTypeTokens({
  display: "'ROBOTECHGPRegular', 'TitilliumText', Helvetica, Arial, sans-serif",
  heading: "'Cubellan', 'TitilliumText', Helvetica, Arial, sans-serif",
  subhead: "'TitilliumText', Helvetica, Arial, sans-serif",
  body: "'Ezarion', 'Dosis', Helvetica, Arial, sans-serif",
  ui: "'TitilliumText', Helvetica, Arial, sans-serif",
  kbd: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  mono: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  caption: "'Ezarion', Helvetica, Arial, sans-serif"
});
type.letterSpacing = {
  display: "0.08em",
  titlebar: "0.06em",
  ui: "0.02em"
};
type.textTransform = {
  display: "uppercase",
  titlebar: "uppercase"
};
var GX_ER_THEME = Object.freeze({
  id: "gx-er",
  meta: Object.freeze({ name: "GX-er" }),
  type,
  titlebar: createTitlebarChromeTokens({
    titleWeight: "700",
    iconDisplay: "inline-flex",
    iconSize: "12px",
    kbdTransform: "uppercase",
    kbdTracking: "0.06em"
  }),
  keys: createKeyChromeTokens({
    shading: "bevel",
    border: "1px solid rgba(0, 229, 255, 0.35)",
    cornerMode: "cut",
    cutSize: "4px"
  }),
  radius: createProRadiusTokens({
    panel: "0px",
    btn: "0px",
    field: "0px",
    xs: "0px",
    sm: "0px"
  }),
  color: color3,
  effect: createGxEffect(color3),
  shape: Object.freeze({ cornerMode: "cut", cutSize: "8px" }),
  icons: Object.freeze({
    pack: "gx-er",
    fallbackPack: "shared",
    overrides: Object.freeze({
      close: "chrome/close.svg",
      collapse: "chrome/collapse.svg",
      gear: "chrome/gear.svg"
    }),
    color: Object.freeze({
      chrome: color3.accent,
      keycap: "#001018",
      accent: color3.accent
    })
  }),
  clickDefaults: GX_ER_CLICK_DEFAULTS
});

// themes/icons.js
var THEME_ICON_FILES = Object.freeze({
  close: "chrome/close.svg",
  collapse: "chrome/collapse.svg",
  gear: "chrome/gear.svg",
  keyboard: "chrome/keyboard.svg",
  window: "chrome/window.svg"
});
var THEME_ICON_IDS = Object.freeze(Object.keys(THEME_ICON_FILES));

// themes/index.js
var PACKAGES = Object.freeze({
  "dark-pro": DARK_PRO_THEME,
  "gray-metal-pro": GRAY_METAL_PRO_THEME,
  "gx-er": GX_ER_THEME
});
function getTheme(id, overrides) {
  const key = normalizeThemeId(id);
  const base2 = PACKAGES[key] || PACKAGES[DEFAULT_THEME_ID];
  return mergeTheme(base2, overrides && typeof overrides === "object" ? overrides : {});
}
function getAllThemesCss() {
  const blocks = THEME_IDS.map((id) => {
    const vars = themeToCssVars(getTheme(id));
    return cssVarsToBlock(vars, `[data-kp-theme="${id}"]`);
  });
  const onboarding = themeToCssVars(
    mergeTheme(DARK_PRO_THEME, DARK_PRO_THEME.surfaces?.onboarding || {})
  );
  blocks.push(cssVarsToBlock(
    onboarding,
    `[data-kp-theme="dark-pro"][data-kp-surface="onboarding"], [data-kp-theme="dark-pro"] [data-kp-surface="onboarding"]`
  ));
  return `${blocks.join("\n")}
${getCutCornerCss()}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`;
}
function getThemeCss(theme) {
  const vars = themeToCssVars(theme);
  const id = theme?.id || DEFAULT_THEME_ID;
  return `${cssVarsToBlock(vars, `:host, :root, [data-kp-theme="${id}"]`)}
${getCutCornerCss()}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`;
}

// themes/font-faces.js
function fontUrl(file) {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`fonts/${file}`);
    }
  } catch {
  }
  return `../fonts/${file}`;
}
function getThemeFontFaceCss() {
  const robotech = fontUrl("ROBOTECHGPRegular.ttf");
  const titillium = fontUrl("TitilliumTextRegular.otf");
  const cubellan = fontUrl("CubellanRegular.ttf");
  const ezarion = fontUrl("EzarionRegular.ttf");
  const dosis = fontUrl("DosisBook.ttf");
  return `
@font-face {
  font-family: 'ROBOTECHGPRegular';
  src: url('${robotech}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('${titillium}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Cubellan';
  src: url('${cubellan}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Ezarion';
  src: url('${ezarion}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Dosis';
  src: url('${dosis}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`.trim();
}

// src/modules/theme-manager.js
var STYLE_ATTR = "data-kp-theme-vars";
var FONT_ATTR = "data-kp-theme-fonts";
var ALL_THEMES_ATTR = "data-kp-all-themes";
var _activeTheme = getTheme(DEFAULT_THEME_ID);
var _listeners = /* @__PURE__ */ new Set();
function notify() {
  for (const fn of _listeners) {
    try {
      fn(_activeTheme);
    } catch {
    }
  }
}
function injectStyle(root, css, attr) {
  if (!root) return;
  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  const mount = root.nodeType === 9 ? root.head || root.documentElement : root.host ? root : root;
  if (!doc || !mount?.appendChild) return;
  let style = null;
  try {
    style = mount.querySelector?.(`style[${attr}]`);
  } catch {
  }
  if (!style) {
    try {
      style = doc.createElement("style");
      style.setAttribute(attr, "true");
      style.textContent = css;
      mount.appendChild(style);
    } catch {
    }
    return;
  }
  if (style.textContent !== css) {
    try {
      style.textContent = css;
    } catch {
    }
  }
}
function applyThemeDataset(el, theme) {
  if (!el?.setAttribute) return;
  const id = theme?.id || DEFAULT_THEME_ID;
  try {
    el.setAttribute("data-kp-theme", id);
  } catch {
  }
  const cut = theme?.shape?.cornerMode === "cut";
  try {
    if (cut) el.setAttribute("data-kp-corner", "cut");
    else el.removeAttribute("data-kp-corner");
  } catch {
  }
}
function applyThemeCssVars(el, theme) {
  if (!el?.style?.setProperty) return;
  const vars = themeToCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    try {
      el.style.setProperty(k, v);
    } catch {
    }
  }
}
function injectAllThemeMaps(root = document) {
  injectStyle(root, getThemeFontFaceCss(), FONT_ATTR);
  injectStyle(root, `${getAllThemesCss()}
${getCutCornerCss()}`, ALL_THEMES_ATTR);
}
function collectChromeThemeHosts(root) {
  const out = [];
  if (!root?.querySelectorAll) return out;
  try {
    root.querySelectorAll(".kp-chrome-window, [data-kp-ui-shadow]").forEach((el) => out.push(el));
  } catch {
  }
  return out;
}
function applyThemeToRoots(theme, opts = {}) {
  _activeTheme = theme || getTheme(DEFAULT_THEME_ID);
  const roots = opts.roots && opts.roots.length ? opts.roots : [document];
  const hostSet = /* @__PURE__ */ new Set();
  for (const host of opts.hosts || []) {
    if (host) hostSet.add(host);
  }
  try {
    collectChromeThemeHosts(document).forEach((el) => hostSet.add(el));
  } catch {
  }
  for (const root of roots) {
    collectChromeThemeHosts(root).forEach((el) => hostSet.add(el));
  }
  for (const root of roots) {
    if (!root) continue;
    injectAllThemeMaps(root);
    injectStyle(root, getThemeCss(_activeTheme), STYLE_ATTR);
    const el = root.nodeType === 9 ? root.documentElement : root.host || null;
    applyThemeDataset(el, _activeTheme);
    if (el) applyThemeCssVars(el, _activeTheme);
  }
  for (const host of hostSet) {
    applyThemeDataset(host, _activeTheme);
    applyThemeCssVars(host, _activeTheme);
    if (host?.shadowRoot) {
      injectAllThemeMaps(host.shadowRoot);
      applyThemeDataset(host.shadowRoot.host, _activeTheme);
    }
  }
  try {
    applyThemeDataset(document.documentElement, _activeTheme);
    applyThemeCssVars(document.documentElement, _activeTheme);
    injectAllThemeMaps(document);
  } catch {
  }
  notify();
  try {
    const id = _activeTheme?.id;
    if (id) localStorage.setItem("kp_theme_id_v1", id);
  } catch {
  }
  return _activeTheme;
}
function resolveThemeFromSettings(settings) {
  const id = normalizeThemeId(settings?.themeId);
  const overrides = settings?.themeOverrides && typeof settings.themeOverrides === "object" ? settings.themeOverrides : {};
  return getTheme(id, overrides);
}

// src/utils/kp-deep-link.js
var KP_SETTINGS_PANEL_IDS = Object.freeze([
  "overview",
  "appearance",
  "keyboard",
  "click-mode",
  "text-mode",
  "scrolling",
  "cursor",
  "control-strip",
  "search",
  "about"
]);
function isKpDeepLink(href) {
  return /^kp:\/\//i.test(String(href || "").trim());
}
function parseKpDeepLink(href) {
  const raw = String(href || "").trim();
  if (!raw) return null;
  if (raw.includes("..")) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "kp:") return null;
  let kind = (url.hostname || "").toLowerCase();
  let pathId = (url.pathname || "").replace(/^\/+|\/+$/g, "");
  if (!kind && pathId) {
    const parts = pathId.split("/").filter(Boolean);
    kind = (parts[0] || "").toLowerCase();
    pathId = parts.slice(1).join("/");
  }
  if (kind !== "settings" && kind !== "docs") return null;
  if (pathId.includes("/")) return null;
  const id = String(pathId || "").trim();
  if (!id) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return null;
  const hash = (url.hash || "").replace(/^#/, "").trim() || void 0;
  return { kind, id, ...hash ? { hash } : {} };
}

// src/messaging/types.js
var MSG = Object.freeze({
  // --- Extension enable / status ---
  GET_STATE: "KP_GET_STATE",
  SET_STATE: "KP_SET_STATE",
  TOGGLE_STATE: "KP_TOGGLE_STATE",
  STATE_RESPONSE: "KP_STATE_RESPONSE",
  STATE_CHANGED: "KP_STATE_CHANGED",
  UPDATE_STATE: "KP_UPDATE_STATE",
  GET_STATUS: "KP_GET_STATUS",
  STATUS: "KP_STATUS",
  // --- Transient onboarding actions ---
  TRANSIENT_ACTION: "KP_TRANSIENT_ACTION",
  // --- Tab / history navigation ---
  TAB_LEFT: "KP_TAB_LEFT",
  TAB_RIGHT: "KP_TAB_RIGHT",
  NEW_TAB: "KP_NEW_TAB",
  CLOSE_TAB: "KP_CLOSE_TAB",
  GO_BACK: "KP_GO_BACK",
  GO_FORWARD: "KP_GO_FORWARD",
  OPEN_URL_BACKGROUND: "KP_OPEN_URL_BACKGROUND",
  OPEN_URL_FOREGROUND: "KP_OPEN_URL_FOREGROUND",
  /** Same-tab navigate (chrome.tabs.update). Used when sandboxed iframes cannot top-navigate without a real user gesture. */
  NAVIGATE_SAME_TAB: "KP_NAVIGATE_SAME_TAB",
  // --- UI open (content-script handlers; SW may forward) ---
  OPEN_SETTINGS_POPOVER: "KP_OPEN_SETTINGS_POPOVER",
  OPEN_GUIDE_POPOVER: "KP_OPEN_GUIDE_POPOVER",
  /** Open Docs popover; optional topicId / hash deep-link. */
  OPEN_DOCS_POPOVER: "KP_OPEN_DOCS_POPOVER",
  OPEN_ONBOARDING: "KP_OPEN_ONBOARDING",
  /** Reset walkthrough progress and open it (e.g. Guide "Launch Walkthrough"). */
  LAUNCH_WALKTHROUGH: "KP_LAUNCH_WALKTHROUGH",
  // --- History / bookmarks / favicon (SW APIs for content scripts) ---
  OMNIBOX_SUGGEST: "KP_OMNIBOX_SUGGEST",
  GET_BOOKMARKS: "KP_GET_BOOKMARKS",
  GET_RECENT_BOOKMARKS: "KP_GET_RECENT_BOOKMARKS",
  BROWSER_HISTORY_GET: "KP_BROWSER_HISTORY_GET",
  GET_TOP_SITES: "KP_GET_TOP_SITES",
  GET_MOST_VISITED: "KP_GET_MOST_VISITED",
  GET_HISTORY_FOR_DOMAINS: "KP_GET_HISTORY_FOR_DOMAINS",
  GET_RECENT_HISTORY: "KP_GET_RECENT_HISTORY",
  GET_FAVICON: "KP_GET_FAVICON",
  // --- Page preview screenshots for card backgrounds ---
  GET_PAGE_THUMB: "KP_GET_PAGE_THUMB",
  PAGE_THUMB_RESPONSE: "KP_PAGE_THUMB_RESPONSE",
  PAGE_THUMB_UPDATED: "KP_PAGE_THUMB_UPDATED",
  GET_VIDEO_THUMB: "KP_GET_VIDEO_THUMB",
  VIDEO_THUMB_RESPONSE: "KP_VIDEO_THUMB_RESPONSE",
  // --- Media Library (IndexedDB at extension origin; SW owns Blobs) ---
  MEDIA_LIBRARY_ADD: "KP_MEDIA_LIBRARY_ADD",
  MEDIA_LIBRARY_LIST: "KP_MEDIA_LIBRARY_LIST",
  MEDIA_LIBRARY_GET: "KP_MEDIA_LIBRARY_GET",
  MEDIA_LIBRARY_DELETE: "KP_MEDIA_LIBRARY_DELETE",
  MEDIA_LIBRARY_ZIP: "KP_MEDIA_LIBRARY_ZIP",
  /** SW → tabs: library contents changed (add/delete). Overlay reloads if open. */
  MEDIA_LIBRARY_CHANGED: "KP_MEDIA_LIBRARY_CHANGED",
  // --- Dictionary lookup (Free Dictionary API via SW; LOOKUP_WORD) ---
  DICTIONARY_LOOKUP: "KP_DICTIONARY_LOOKUP",
  // --- Per-tab navigation graph ---
  NAVGRAPH_GET: "KP_NAVGRAPH_GET",
  NAVGRAPH_JUMP: "KP_NAVGRAPH_JUMP",
  NAVGRAPH_CLEAR: "KP_NAVGRAPH_CLEAR",
  // --- Generic ---
  SUCCESS: "KP_SUCCESS",
  ERROR: "KP_ERROR",
  // --- Separate-window Link Preview / Open Popover (chrome.windows popup) ---
  OPEN_POPOVER_WINDOW: "KP_OPEN_POPOVER_WINDOW",
  CLOSE_POPOVER_WINDOW: "KP_CLOSE_POPOVER_WINDOW",
  /** SW → opener: popover window closed (OS ✕ or in-window close). */
  POPOVER_WINDOW_CLOSED: "KP_POPOVER_WINDOW_CLOSED",
  /** Popup tab → SW: am I a KeyPilot popover window? */
  AM_I_POPOVER_WINDOW: "KP_AM_I_POPOVER_WINDOW",
  // --- Parent ↔ popover iframe (window.postMessage) ---
  POPOVER_BRIDGE_INIT: "KP_POPOVER_BRIDGE_INIT",
  POPOVER_BRIDGE_READY: "KP_POPOVER_BRIDGE_READY",
  POPOVER_REQUEST_CLOSE: "KP_POPOVER_REQUEST_CLOSE",
  POPOVER_BRIDGE_KEYDOWN: "KP_POPOVER_BRIDGE_KEYDOWN",
  POPOVER_SCROLL: "KP_POPOVER_SCROLL",
  /** Guide iframe → parent: close guide and open walkthrough from a reset state. */
  POPOVER_LAUNCH_WALKTHROUGH: "KP_POPOVER_LAUNCH_WALKTHROUGH",
  // --- Parent → child frame activate (window.postMessage; third-party iframes) ---
  // Top-frame KeyPilot posts this when F/B/G lands on a cross-origin <iframe>.
  // Child frame-click-agent performs elementFromPoint + click in its own document.
  // Optional topOrigin: parent tab origin for link routing (no hardcoded domains).
  FRAME_ACTIVATE: "KP_FRAME_ACTIVATE",
  // --- Parent → child frame scroll (window.postMessage; layout scroll keys under an iframe) ---
  // Top-frame KeyPilot posts this when scroll keys land on an <iframe> shell. Child
  // frame-click-agent runs scroll-at-point (delta or edge) at local coordinates
  // (nested overflow first, then the frame document).
  FRAME_SCROLL: "KP_FRAME_SCROLL",
  // --- Child → parent pointer sync (window.postMessage) ---
  // Frame agent reports local client coords so top KeyPilot can keep lastMouse fresh
  // while the pointer is over a cross-origin (or any) iframe — parent documents do
  // not receive mousemove inside iframes. Nested agents re-bubble with translated coords.
  // Payload: { type, inside: boolean, clientX?: number, clientY?: number }
  FRAME_POINTER: "KP_FRAME_POINTER",
  // --- Child → parent: return keyboard focus to the top frame ---
  // Sent on Esc / pointer leave when the iframe had document focus (manual click).
  // Top blurs the focused <iframe> so KeyPilot keybinds work on the parent again.
  FRAME_FOCUS_RECLAIM: "KP_FRAME_FOCUS_RECLAIM",
  // --- Child → parent: typing focus inside a page iframe ---
  // Frame agent posts these on focusin/focusout of a text field in its document
  // (Gutenberg editor-canvas, etc.). Top FocusDetector peeks the same-origin
  // activeElement and enters/exits text_focus. No element is sent.
  // Payload: { type }
  FRAME_TYPING_FOCUS: "KP_FRAME_TYPING_FOCUS",
  FRAME_TYPING_BLUR: "KP_FRAME_TYPING_BLUR",
  // --- Parent → child: blur the typing field (Esc from top-frame text mode) ---
  FRAME_BLUR_TYPING: "KP_FRAME_BLUR_TYPING",
  // --- Child frame-agent → SW: inject full content-bundled.js into this frame ---
  // Used when a KeyPilot popover iframe needs full KeyPilot (cursor/overlays).
  // Thin frame-agent-bundled.js does not include the full app.
  INJECT_FULL_KEYPILOT_IN_FRAME: "KP_INJECT_FULL_KEYPILOT_IN_FRAME",
  // --- Content → SW: inject MAIN-world map.panBy bridge into the sender frame ---
  // Scroll Line uses this so isolated content can pan Leaflet/Mapbox/Google via
  // page globals. Idempotent; bridge listens for CustomEvent __kp_map_pan_v1.
  ENSURE_MAP_PAN_BRIDGE: "KP_ENSURE_MAP_PAN_BRIDGE"
});
var TAB_UI_FORWARD_TYPES = Object.freeze([
  MSG.OPEN_SETTINGS_POPOVER,
  MSG.OPEN_GUIDE_POPOVER,
  MSG.OPEN_DOCS_POPOVER,
  MSG.OPEN_ONBOARDING,
  MSG.LAUNCH_WALKTHROUGH
]);

// pages/docs.js
var INDEX_URL = () => chrome.runtime.getURL("userdocs/index.json");
var docUrl = (file) => chrome.runtime.getURL(`userdocs/${file}`);
var allDocs = [];
var topicTree = [];
var activeId = null;
var docsRoot = null;
var topicListEl = null;
var emptyEl = null;
var articleEl = null;
var searchEl = null;
var closeBtn = null;
var docsAppEl = null;
var pendingInitialTopic = null;
var pendingArticleHash = null;
var onNavigateDeepLink = null;
var docsCatalogReady = false;
function bindDocsElements(root) {
  const scope = root && root.querySelector ? root : document;
  topicListEl = scope.querySelector("#docs-topic-list");
  emptyEl = scope.querySelector("#docs-empty");
  articleEl = scope.querySelector("#docs-article");
  searchEl = scope.querySelector("#docs-search");
  closeBtn = scope.querySelector("#close");
  docsAppEl = scope.querySelector(".docs-app");
}
function docsAppMarkup() {
  return `
    <div class="docs-app">
      <header class="header">
        <div class="header-text">
          <h1>KeyPilot Docs</h1>
          <p class="sub">How to use KeyPilot \u2014 search topics or browse the list.</p>
        </div>
        <div class="header-actions">
          <button id="close" class="btn" type="button">Close</button>
        </div>
      </header>
      <div class="docs-shell">
        <aside class="docs-nav" aria-label="Documentation topics">
          <label class="search-label" for="docs-search">Search</label>
          <input
            id="docs-search"
            class="docs-search"
            type="search"
            placeholder="Search docs\u2026"
            autocomplete="off"
            spellcheck="false"
          />
          <nav id="docs-topic-list" class="topic-list" aria-label="Topics"></nav>
          <p id="docs-empty" class="docs-empty" hidden>No matching topics.</p>
        </aside>
        <main class="docs-main">
          <article id="docs-article" class="docs-article" aria-live="polite">
            <p class="muted">Loading documentation\u2026</p>
          </article>
        </main>
      </div>
    </div>
  `.trim();
}
function escapeHtml2(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var markdown = new MarkdownItCallable({
  html: true,
  linkify: true,
  typographer: true
});
function isAllowedDocsHref(url) {
  const s = String(url || "").trim();
  if (/^(https?:|chrome-extension:|mailto:|kp:|#|data:)/i.test(s)) return true;
  if (/^(\.\/)?(userdocs\/)?images\//i.test(s)) return true;
  return false;
}
markdown.validateLink = (url) => isAllowedDocsHref(url);
var defaultLinkOpen = markdown.renderer.rules.link_open || ((tokens, idx, options, _env, renderer) => renderer.renderToken(tokens, idx, options));
markdown.renderer.rules.link_open = (tokens, idx, options, env, renderer) => {
  const href = tokens[idx].attrGet("href") || "";
  if (!href.startsWith("#") && !isKpDeepLink(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, renderer);
};
markdown.renderer.rules.table_open = () => '<div class="table-scroll"><table>\n';
markdown.renderer.rules.table_close = () => "</table></div>\n";
var defaultImage = markdown.renderer.rules.image || ((tokens, idx, options, env, renderer) => renderer.renderToken(tokens, idx, options));
markdown.renderer.rules.image = (tokens, idx, options, env, renderer) => {
  const token = tokens[idx];
  const src = String(token.attrGet("src") || "").trim();
  if (src && !/^(https?:|chrome-extension:|data:)/i.test(src)) {
    const cleaned = src.replace(/^\.\//, "").replace(/^userdocs\//, "");
    const rel = cleaned.startsWith("images/") ? `userdocs/${cleaned}` : `userdocs/images/${cleaned}`;
    try {
      token.attrSet("src", chrome.runtime.getURL(rel));
    } catch {
      token.attrSet("src", rel);
    }
  }
  token.attrSet("class", [token.attrGet("class") || "", "docs-shot"].filter(Boolean).join(" ").trim());
  return defaultImage(tokens, idx, options, env, renderer);
};
function slugifyHeading(text2) {
  return String(text2 || "").toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[`*_~]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var defaultHeadingOpen = markdown.renderer.rules.heading_open || ((tokens, idx, options, _env, renderer) => renderer.renderToken(tokens, idx, options));
markdown.renderer.rules.heading_open = (tokens, idx, options, env, renderer) => {
  const token = tokens[idx];
  if (token && !token.attrGet("id")) {
    let title = "";
    for (let i = idx + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === "heading_close") break;
      if (t.type === "inline") title += t.content || "";
    }
    const id = slugifyHeading(title);
    if (id) token.attrSet("id", id);
  }
  return defaultHeadingOpen(tokens, idx, options, env, renderer);
};
function renderMarkdown(md) {
  return markdown.render(String(md || ""));
}
var NAV_ACCENTS = /* @__PURE__ */ new Set(["green", "blue", "amber", "indigo", "rose", "cyan", "violet"]);
var NAV_ICON_PATHS = Object.freeze({
  book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"],
  pointer: ["m9 9 5 12 2.2-5.2L21 14Z", "M7.2 2.2 9 9l-6.8-1.8Z"],
  tabs: ["M8 6h13v13H8z", "M3 5V3h13v3", "M5 8H3v8h5"],
  scroll: ["M8 2h8a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z", "M12 6v12", "m9 9 3-3 3 3", "m9 15 3 3 3-3"],
  select: ["M3 3h6v2H5v4H3Z", "M15 3h6v6h-2V5h-4Z", "M3 15h2v4h4v2H3Z", "M19 15h2v6h-6v-2h4Z"],
  layers: ["m12 2 9 5-9 5-9-5Z", "m3 12 9 5 9-5", "m3 17 9 5 9-5"],
  keyboard: ["M3 5h18v14H3z", "M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h.01M15 13h.01M19 13h.01M8 17h8"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.55-1H5v-3h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V4h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 9.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09a1.7 1.7 0 0 0-1.51 1.7Z"],
  search: ["m21 21-4.35-4.35", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"],
  rocket: ["M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2", "m9 15-3-3s3.5-7.5 9-9c3 0 6 0 6 0s0 3 0 6c-1.5 5.5-9 9-9 9Z", "M9 15H4s.55-3.03 2-4.5M12 18v5s3.03-.55 4.5-2"],
  grid: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  controls: ["M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3", "M1 14h6M9 8h6M17 16h6"],
  preview: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  image: ["M3 3h18v18H3z", "m3 16 5-5 4 4 2-2 7 7", "M16 8h.01"],
  library: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z", "M8 7h8M8 11h8"],
  copy: ["M8 8h13v13H8z", "M16 8V3H3v13h5"],
  layout: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z", "M14 17h7M17.5 13.5v7"],
  functions: ["M18 16.98h-5.99c-1.1 0-1.93-.94-1.73-2.02l1.44-7.92A2.5 2.5 0 0 1 14.18 5H16", "M7 9h8"],
  macros: ["M8 6h13M8 12h13M8 18h13", "m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"],
  code: ["m8 9-3 3 3 3M16 9l3 3-3 3", "m14 5-4 14"]
});
function filterTopicsForBuild(topics) {
  if (BUILD_ENABLE_MACRO_BUILDER) return topics;
  const hide = /* @__PURE__ */ new Set(["macros-overview", "macro-builder"]);
  const walk = (list2) => (list2 || []).filter((t) => t && !hide.has(t.id)).map((t) => {
    const children = Array.isArray(t.children) ? walk(t.children) : void 0;
    return children && children.length ? { ...t, children } : { ...t, children: void 0 };
  });
  return walk(topics);
}
function flattenTopics(topics, depth = 0, parentId = null) {
  const out = [];
  for (const topic of topics || []) {
    if (!topic || typeof topic.id !== "string" || typeof topic.title !== "string") continue;
    const children = Array.isArray(topic.children) ? topic.children : [];
    const childIds = children.filter((c) => c && typeof c.id === "string").map((c) => c.id);
    const file = typeof topic.file === "string" && topic.file.trim() ? topic.file.trim() : null;
    const icon = typeof topic.icon === "string" && NAV_ICON_PATHS[topic.icon] ? topic.icon : null;
    const shortcut = typeof topic.shortcut === "string" && topic.shortcut.trim() ? topic.shortcut.trim().slice(0, 12) : null;
    const accent = typeof topic.accent === "string" && NAV_ACCENTS.has(topic.accent) ? topic.accent : null;
    out.push({
      id: topic.id,
      title: topic.title,
      file,
      placeholder: !!topic.placeholder,
      depth,
      parentId,
      childIds,
      icon,
      shortcut,
      accent
    });
    if (children.length) {
      out.push(...flattenTopics(children, depth + 1, topic.id));
    }
  }
  return out;
}
async function loadDocs(flat) {
  const entries = await Promise.all(
    flat.map(async (topic) => {
      let bodyText = "";
      let html = "";
      const selectable = !!topic.file;
      if (topic.file) {
        try {
          const res = await fetch(docUrl(topic.file));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          bodyText = await res.text();
        } catch (err) {
          console.warn("[KeyPilot Docs] Failed to load", topic.file, err);
          bodyText = `# ${topic.title}

Failed to load this document.`;
        }
        html = renderMarkdown(bodyText);
      }
      return {
        id: topic.id,
        title: topic.title,
        file: topic.file,
        placeholder: topic.placeholder,
        depth: topic.depth,
        parentId: topic.parentId,
        childIds: topic.childIds,
        bodyText,
        html,
        selectable,
        icon: topic.icon,
        shortcut: topic.shortcut,
        accent: topic.accent
      };
    })
  );
  return entries;
}
function matchesQuery(doc, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return doc.title.toLowerCase().includes(q) || doc.bodyText.toLowerCase().includes(q);
}
function buildNavTree(topics, query, depth = 0) {
  const out = [];
  for (const topic of topics || []) {
    if (!topic || typeof topic.id !== "string") continue;
    const doc = allDocs.find((d) => d.id === topic.id);
    if (!doc) continue;
    const childTopics = Array.isArray(topic.children) ? topic.children : [];
    const children = buildNavTree(childTopics, query, depth + 1);
    const selfMatch = matchesQuery(doc, query);
    if (query && !selfMatch && !children.length) continue;
    out.push({
      id: doc.id,
      title: doc.title,
      placeholder: doc.placeholder,
      depth,
      selectable: doc.selectable,
      icon: doc.icon,
      shortcut: doc.shortcut,
      accent: doc.accent,
      children
    });
  }
  return out;
}
function filteredSelectableDocs() {
  const q = (searchEl?.value || "").trim();
  return allDocs.filter((d) => d.selectable && matchesQuery(d, q));
}
function resolveSelectableId(id) {
  const doc = allDocs.find((d) => d.id === id);
  if (!doc) return null;
  if (doc.selectable) return doc.id;
  for (const childId of doc.childIds || []) {
    const resolved = resolveSelectableId(childId);
    if (resolved) return resolved;
  }
  return null;
}
function createNavIcon(iconName) {
  const paths = NAV_ICON_PATHS[iconName];
  if (!paths) return null;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("topic-icon-svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const pathData of paths) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
  }
  return svg;
}
function appendNavNode(node, parentEl) {
  const row = document.createElement(node.selectable ? "button" : "div");
  if (node.selectable) {
    row.type = "button";
  } else {
    row.setAttribute("role", "button");
    row.tabIndex = 0;
  }
  row.className = node.selectable ? "topic-btn" : "topic-group";
  row.dataset.id = node.id;
  row.style.setProperty("--topic-depth", String(node.depth));
  if (node.accent) row.dataset.accent = node.accent;
  if (node.selectable && node.id === activeId) {
    row.setAttribute("aria-current", "page");
  }
  const labelWrap = document.createElement("span");
  labelWrap.className = "topic-label";
  if (node.shortcut) {
    const shortcut = document.createElement("kbd");
    shortcut.className = "topic-visual topic-shortcut";
    shortcut.textContent = node.shortcut;
    shortcut.setAttribute("aria-hidden", "true");
    labelWrap.appendChild(shortcut);
  } else if (node.icon) {
    const iconWrap = document.createElement("span");
    iconWrap.className = "topic-visual topic-icon";
    iconWrap.setAttribute("aria-hidden", "true");
    const icon = createNavIcon(node.icon);
    if (icon) iconWrap.appendChild(icon);
    labelWrap.appendChild(iconWrap);
  }
  const titleSpan = document.createElement("span");
  titleSpan.className = "topic-title";
  titleSpan.textContent = node.title;
  labelWrap.appendChild(titleSpan);
  row.appendChild(labelWrap);
  if (node.placeholder) {
    const badge = document.createElement("span");
    badge.className = "topic-placeholder";
    badge.textContent = "Soon";
    row.appendChild(badge);
  }
  if (node.selectable) {
    row.addEventListener("click", () => selectDoc(node.id));
  } else {
    row.addEventListener("click", () => {
      const next = resolveSelectableId(node.id);
      if (next) selectDoc(next);
    });
  }
  parentEl.appendChild(row);
  if (node.children.length) {
    const childWrap = document.createElement("div");
    childWrap.className = "topic-children";
    childWrap.setAttribute("role", "group");
    childWrap.setAttribute("aria-label", node.title);
    for (const child of node.children) {
      appendNavNode(child, childWrap);
    }
    parentEl.appendChild(childWrap);
  }
}
function renderNav() {
  if (!topicListEl || !emptyEl) return;
  const q = (searchEl?.value || "").trim();
  const tree = buildNavTree(topicTree, q);
  topicListEl.replaceChildren();
  if (!tree.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  for (const node of tree) {
    appendNavNode(node, topicListEl);
  }
}
function selectDoc(id, articleHash) {
  const resolved = resolveSelectableId(id) || id;
  const doc = allDocs.find((d) => d.id === resolved);
  if (!doc || !articleEl) return;
  if (!doc.selectable) {
    activeId = null;
    articleEl.innerHTML = `<p class="muted">${escapeHtml2(doc.title)}</p>`;
    renderNav();
    return;
  }
  activeId = doc.id;
  articleEl.innerHTML = doc.html || '<p class="muted">Empty document.</p>';
  renderNav();
  bindDocsCopyPrompts(articleEl);
  scrollDocsArticleToHash(articleHash);
}
function bindDocsCopyPrompts(article) {
  if (!article) return;
  article.querySelectorAll("textarea.kp-docs-copy-prompt").forEach((el) => {
    el.addEventListener("focus", () => {
      try {
        el.select();
      } catch {
      }
    });
  });
}
function scrollDocsArticleToHash(hash) {
  const id = String(hash || "").replace(/^#/, "").trim();
  if (!id || !articleEl) return;
  try {
    const el = articleEl.querySelector(`#${CSS.escape(id)}`) || articleEl.querySelector(`[name="${CSS.escape(id)}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
  } catch {
  }
  try {
    articleEl.scrollTop = 0;
  } catch {
  }
}
function navigateDocsApp(topicId, hash) {
  if (!docsCatalogReady || !articleEl) return false;
  const id = String(topicId || "").trim();
  if (!id) return false;
  const resolved = resolveSelectableId(id);
  if (!resolved) {
    const first = allDocs.find((d) => d.selectable);
    if (!first) return false;
    selectDoc(first.id);
    return false;
  }
  selectDoc(resolved, hash);
  return true;
}
function defaultNavigateDeepLink(target) {
  if (!target || target.kind !== "settings" && target.kind !== "docs") return;
  if (target.kind === "docs") {
    if (navigateDocsApp(target.id, target.hash)) return;
  }
  try {
    const kp = typeof window !== "undefined" && (window.__KeyPilotInstance || window.keyPilot) || null;
    if (kp && typeof kp.navigateKpDeepLink === "function") {
      kp.navigateKpDeepLink(target);
      return;
    }
  } catch {
  }
  try {
    const parentKp = typeof window !== "undefined" && window.parent && window.parent !== window && (window.parent.__KeyPilotInstance || window.parent.keyPilot) || null;
    if (parentKp && typeof parentKp.navigateKpDeepLink === "function") {
      try {
        window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key: "Escape" }, "*");
      } catch {
      }
      parentKp.navigateKpDeepLink(target);
      return;
    }
  } catch {
  }
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      if (target.kind === "settings") {
        void chrome.runtime.sendMessage({
          type: MSG.OPEN_SETTINGS_POPOVER,
          panelId: target.id
        });
      } else {
        void chrome.runtime.sendMessage({
          type: MSG.OPEN_DOCS_POPOVER,
          topicId: target.id,
          hash: target.hash
        });
      }
    }
  } catch {
  }
}
function onDocsDeepLinkClick(e) {
  if (!e || e.defaultPrevented) return;
  if (e.button != null && e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const path = typeof e.composedPath === "function" ? e.composedPath() : [];
  let el = null;
  for (const node of path) {
    if (node && node.nodeType === 1 && /** @type {Element} */
    node.tagName === "A") {
      el = /** @type {Element} */
      node;
      break;
    }
  }
  if (!el) {
    const t = e.target;
    el = t && /** @type {Element} */
    t.closest ? (
      /** @type {Element} */
      t.closest("a[href]")
    ) : null;
  }
  if (!el) return;
  const href = el.getAttribute("href") || "";
  const parsed = parseKpDeepLink(href);
  if (!parsed) return;
  e.preventDefault();
  e.stopPropagation();
  if (parsed.kind === "docs") {
    navigateDocsApp(parsed.id, parsed.hash);
    return;
  }
  const nav = onNavigateDeepLink || defaultNavigateDeepLink;
  try {
    nav(parsed);
  } catch {
  }
}
function resolveInitialDocsTarget(fromOptions) {
  const opt = String(fromOptions || "").trim();
  if (opt) return { topicId: opt, hash: pendingArticleHash };
  try {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw) return { topicId: null, hash: null };
    const slash = raw.indexOf("/");
    if (slash > 0) {
      return { topicId: raw.slice(0, slash), hash: raw.slice(slash + 1) || null };
    }
    return { topicId: raw, hash: null };
  } catch {
    return { topicId: null, hash: null };
  }
}
function applyFontScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n) || n < 0.8 || n > 1.75) return;
  const value = String(n);
  if (docsAppEl) docsAppEl.style.setProperty("--docs-font-scale", value);
  if (docsRoot instanceof ShadowRoot && docsRoot.host) {
    docsRoot.host.style.setProperty("--docs-font-scale", value);
  }
  if (docsRoot?.nodeType === 9) {
    try {
      document.documentElement.style.setProperty("--docs-font-scale", value);
    } catch {
    }
  }
}
function mountDocsApp(root, options = {}) {
  const embedded = options.embedded === true;
  const onClose = typeof options.onClose === "function" ? options.onClose : null;
  onNavigateDeepLink = typeof options.onNavigateDeepLink === "function" ? options.onNavigateDeepLink : null;
  pendingInitialTopic = String(options.initialTopic || "").trim() || null;
  pendingArticleHash = String(options.initialHash || "").replace(/^#/, "").trim() || null;
  docsCatalogReady = false;
  docsRoot = root;
  const mountNode = root.nodeType === 9 ? (
    /** @type {Document} */
    root.body
  ) : root;
  if (!mountNode) return () => {
  };
  if (!mountNode.querySelector?.(".docs-app")) {
    const holder = document.createElement("div");
    holder.innerHTML = docsAppMarkup();
    const app = holder.firstElementChild;
    if (app) mountNode.appendChild(app);
  }
  bindDocsElements(mountNode);
  try {
    void getSettings().then((settings) => {
      applyThemeToRoots(resolveThemeFromSettings(settings), {
        roots: [root.nodeType === 9 ? root : document],
        hosts: [
          root.nodeType === 9 ? root.documentElement : root.host || document.documentElement
        ]
      });
    }).catch(() => {
    });
  } catch {
  }
  if (embedded && docsAppEl) {
    docsAppEl.classList.add("kp-popover-embed");
    const header = docsAppEl.querySelector(".header");
    if (header) {
      header.hidden = true;
      header.setAttribute("aria-hidden", "true");
    }
  }
  if (Number.isFinite(Number(options.fontScale))) {
    applyFontScale(options.fontScale);
  }
  const requestClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      window.parent.postMessage({ type: "KP_POPOVER_REQUEST_CLOSE", key: "Escape" }, "*");
    } catch {
    }
  };
  const onSearchInput = () => {
    renderNav();
    const visible = filteredSelectableDocs();
    if (!visible.length) {
      if (articleEl) {
        articleEl.innerHTML = '<p class="muted">No matching topics.</p>';
      }
      activeId = null;
      return;
    }
    if (!visible.some((d) => d.id === activeId)) {
      selectDoc(visible[0].id);
    } else {
      renderNav();
    }
  };
  closeBtn?.addEventListener("click", requestClose);
  searchEl?.addEventListener("input", onSearchInput);
  mountNode.addEventListener?.("click", onDocsDeepLinkClick, true);
  void (async () => {
    try {
      const res = await fetch(INDEX_URL());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const index = await res.json();
      topicTree = filterTopicsForBuild(Array.isArray(index?.topics) ? index.topics : []);
      const flat = flattenTopics(topicTree);
      allDocs = await loadDocs(flat);
      docsCatalogReady = true;
      const firstSelectable = allDocs.find((d) => d.selectable);
      if (!firstSelectable) {
        if (articleEl) {
          articleEl.innerHTML = '<p class="error">No documentation topics found.</p>';
        }
        renderNav();
        return;
      }
      const { topicId, hash } = resolveInitialDocsTarget(pendingInitialTopic);
      pendingInitialTopic = null;
      const articleHash = hash || pendingArticleHash;
      pendingArticleHash = null;
      if (topicId && resolveSelectableId(topicId)) {
        selectDoc(topicId, articleHash);
      } else {
        selectDoc(firstSelectable.id);
      }
      if (!embedded) searchEl?.focus();
    } catch (err) {
      console.warn("[KeyPilot Docs] Failed to load index:", err);
      docsCatalogReady = false;
      if (articleEl) {
        articleEl.innerHTML = '<p class="error">Could not load documentation catalog.</p>';
      }
    }
  })();
  return () => {
    closeBtn?.removeEventListener("click", requestClose);
    searchEl?.removeEventListener("input", onSearchInput);
    try {
      mountNode.removeEventListener?.("click", onDocsDeepLinkClick, true);
    } catch {
    }
    topicListEl = null;
    emptyEl = null;
    articleEl = null;
    searchEl = null;
    closeBtn = null;
    docsAppEl = null;
    docsRoot = null;
    onNavigateDeepLink = null;
    pendingInitialTopic = null;
    pendingArticleHash = null;
    docsCatalogReady = false;
  };
}
if (typeof document !== "undefined" && document.documentElement?.hasAttribute("data-kp-docs-page")) {
  mountDocsApp(document, { embedded: false });
}
export {
  mountDocsApp,
  navigateDocsApp
};
