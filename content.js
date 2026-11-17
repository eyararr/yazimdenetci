// Yazım Denetçi v16 - Soru Eki Ses Uyumu (mıyım -> miyim) & Noktalama Boşluk Düzenlemesi
const ENFORCE_END_PERIOD = true;   
const USE_DEASCIIFIER = true;      
const SKIP_WORDS = new Set([
  "alotech", "whatsapp", "google",
  // Doğru yazıldığı halde otomatik düzeltici tarafından bozulan kelimeler (gerçek chat verisinden tespit edildi)
  "fiş", "acil", "cari", "şöyle", "yoksa", "basalım", "mıdır", "olduğu", "bomgar"
]);

let TYPO_DICT = {
  "tamm": "tamam", "tmm": "tamam", "tsk": "teşekkürler", "tşk": "teşekkürler",
  "tesekkurederim": "teşekkür ederim", "sagol": "sağ ol", 
  "merhba": "merhaba", "mrb": "merhaba", "mrhaba": "merhaba", "mrhb": "merhaba", "mrba": "merhaba",
  "slm": "selam", "sl": "sol", "sag": "sağ",
  "yanlıs": "yanlış", "herkez": "herkes", "sofor": "şoför", "kiprik": "kirpik", 
  "gidiyorm": "gidiyorum", "gelcm": "geleceğim",
  
  // Sık yapılan 2 harfli bitişik soru eki hataları
  "varmı": "var mı", "yokmu": "yok mu", "olurmu": "olur mu", "olmazmı": "olmaz mı",
  "doğrumu": "doğru mu", "dogrumu": "doğru mu", "değilmi": "değil mi", "degilmi": "değil mi",
  "tamammı": "tamam mı", "gelirmi": "gelir mi", "yaparmı": "yapar mı", 
  "anladınmı": "anladın mı", "aldınmı": "aldın mı", "yaptınmı": "yaptın mı", "gördünmü": "gördün mü",
  
  "bey": "Bey", "hanım": "Hanım", "beyefendi": "Beyefendi", "hanımefendi": "Hanımefendi",
  "ayse": "Ayşe", "ayşe": "Ayşe", "ali": "Ali", "ahmet": "Ahmet", "mehmet": "Mehmet",
  "mustafa": "Mustafa", "zeynep": "Zeynep", "elif": "Elif", "can": "Can", "cem": "Cem",
  "murat": "Murat", "kemal": "Kemal", "hasan": "Hasan", "hüseyin": "Hüseyin", "kadir": "Kadir", 
  "fatma": "Fatma", "burak": "Burak", "emre": "Emre", "yusuf": "Yusuf", "gökhan": "Gökhan", 
  "hakan": "Hakan", "fatih": "Fatih", "merve": "Merve", "büşra": "Büşra"
};

try {
  chrome.storage.local.get(['typoDict'], function(result) {
    if (result.typoDict) TYPO_DICT = { ...TYPO_DICT, ...result.typoDict };
  });
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.typoDict) {
      TYPO_DICT = { ...TYPO_DICT, ...changes.typoDict.newValue };
    }
  });
} catch(e) {}

// Bitişik yazılmış yalın soru eki (ör: "uyudunmu", "sıkıldınmı", "geliyormu", "gelmişmi")
// Yalnızca fiil çekimi gibi görünen köklerden sonra devreye girer ("tutumu", "dostumu" gibi kelimeler bozulmasın).
const BARE_Q_RE = /^((?:.{2,}?(?:yor|m[ıiuü][şs]|[dt][ıiuü](?:n|m|k|n[ıiuü]z|l[ae]r)|s[ae](?:m|n|k|n[ıi]z|l[ae]r))|var|yok|değil|degil|doğru|dogru|tamam|olur|olmaz|gelir|yapar|uygun|müsait|musait|mümkün|mumkun|hazır|hazir))(m[ıiuü])$/u;

const INPUT_SELECTOR = 'textarea, input[type="text"], input[type="search"], input:not([type]), [contenteditable=""], [contenteditable="true"], [role="textbox"]';
const isValueEl = (el) => "value" in el;
let deascii = null;

if (USE_DEASCIIFIER) {
  try {
    const D = typeof Deasciifier !== "undefined" ? Deasciifier : module.exports;
    deascii = typeof D === "function" ? new D() : D; 
  } catch (err) { deascii = null; }
}

// Büyük ünlü uyumuna göre soru ekini kök kelimeyle uyumlu hale getirir (bekletebilir + mıyım -> miyim)
function harmonizeQuestionSuffix(root, suffix) {
  const lowerRoot = root.toLocaleLowerCase("tr-TR");
  const lowerSuffix = suffix.toLocaleLowerCase("tr-TR");
  const vowels = lowerRoot.match(/[aeıioöuü]/g);
  if (!vowels || vowels.length === 0) return suffix;

  const lastVowel = vowels[vowels.length - 1];
  let targetVowel = "ı";
  if (lastVowel === "e" || lastVowel === "i") targetVowel = "i";
  else if (lastVowel === "o" || lastVowel === "u") targetVowel = "u";
  else if (lastVowel === "ö" || lastVowel === "ü") targetVowel = "ü";

  let harmonized = lowerSuffix.replace(/^m[ıiuü]/, "m" + targetVowel);
  harmonized = harmonized.replace(/(y|s|d)?[ıiuü](m|n|z|nız|niz|nuz|nüz|r|dı|di|du|dü|dın|din|dun|dün|dınız|diniz|dunuz|dünüz)$/, (m, cons, end) => {
    let fixedEnd = end
      .replace(/^n[ıiuü]z$/, "n" + targetVowel + "z")
      .replace(/^d[ıiuü]$/, "d" + targetVowel)
      .replace(/^d[ıiuü]n$/, "d" + targetVowel + "n")
      .replace(/^d[ıiuü]n[ıiuü]z$/, "d" + targetVowel + "n" + targetVowel + "z");
    return (cons || "") + targetVowel + fixedEnd;
  });

  if (suffix.charAt(0) !== suffix.charAt(0).toLocaleLowerCase("tr-TR")) {
    return harmonized.charAt(0).toLocaleUpperCase("tr-TR") + harmonized.slice(1);
  }
  return harmonized;
}

function textBeforeCaret(el) {
  if (isValueEl(el)) return el.value.slice(0, el.selectionStart);
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString();
}

function fullText(el) { return isValueEl(el) ? el.value : el.innerText; }

function insert(el, str) {
  const ok = document.execCommand("insertText", false, str);
  if (ok) {
    el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  } else if (isValueEl(el)) {
    el.setRangeText(str, el.selectionStart, el.selectionEnd, "end");
    el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  }
}

function selectBack(el, n) {
  if (isValueEl(el)) {
    const end = el.selectionStart;
    el.setSelectionRange(Math.max(0, end - n), end);
    return;
  }
  const sel = window.getSelection();
  for (let i = 0; i < n; i++) sel.modify("extend", "backward", "character");
}

function deasciifyLastWord(before, word) {
  if (!deascii) return null;
  const ctx = before.slice(-80);
  let res;
  try { res = deascii.deasciify(ctx); } catch (err) { return null; }
  if (typeof res !== "string" || res.length !== ctx.length) return null; 
  const out = res.slice(ctx.length - word.length);
  return out !== word && out.length === word.length ? out : null;
}

function checkSentenceBoundaries(el) {
  const before = textBeforeCaret(el);
  if (!before) return false;
  
  const match = before.match(/(sağlıyorum|ediyorum|bekliyorum|istiyorum|yapıyorum|diliyorum|geliyorum)\s+(sizi|size|seni|sana|lütfen|ne|nasıl|yardımcı|hemen|kısa|biraz|şu|bunu|bu)\s?$/ui);
  
  if (match) {
    const fullMatch = match[0];
    const verb = match[1];
    const nextWord = match[2];
    const capitalizedNext = nextWord.charAt(0).toLocaleUpperCase("tr-TR") + nextWord.slice(1);
    
    selectBack(el, fullMatch.length);
    insert(el, verb + ". " + capitalizedNext);
    return true;
  }
  return false;
}

function correctLastWord(el) {
  const before = textBeforeCaret(el);
  if (!before) return false;
  const m = before.match(/(\p{L}+)$/u);
  if (!m) return false;
  const word = m[1];
  const token = (before.match(/\S+$/) || [""])[0].replace(/^[("'«“]+/, "");
  if (token !== word) return false; 
  
  const lower = word.toLocaleLowerCase("tr-TR");
  if (SKIP_WORDS.has(lower)) return false;
  if (word.length >= 2 && word === word.toLocaleUpperCase("tr-TR")) return false; 

  let out = null;
  const fix = TYPO_DICT[lower];
  let wordLengthToSelect = word.length;
  
  if (fix && fix !== word) {
    out = fix;
    const first = word.charAt(0);
    if (first !== first.toLocaleLowerCase("tr-TR")) {
      out = fix.charAt(0).toLocaleUpperCase("tr-TR") + fix.slice(1);
    }
    
    if (["Bey", "Hanım", "Beyefendi", "Hanımefendi"].includes(fix)) {
      const beforeWithoutTitle = before.slice(0, -word.length);
      const prevMatch = beforeWithoutTitle.match(/(\p{L}+)\s+$/u);
      
      if (prevMatch) {
        const prevWord = prevMatch[1];
        const pFirst = prevWord.charAt(0);
        if (pFirst === pFirst.toLocaleLowerCase("tr-TR")) {
          const capitalizedPrev = pFirst.toLocaleUpperCase("tr-TR") + prevWord.slice(1);
          out = capitalizedPrev + prevMatch[0].slice(prevWord.length) + fix;
          wordLengthToSelect = prevMatch[0].length + word.length;
        }
      }
    }
  } else {
    // 1. Durum: Soru eki ayrı yazılmış ama ses uyumu bozuksa (ör: "bekletebilir mıyım")
    const standaloneQ = lower.match(/^(m[ıiuü]s[ıiuü]n(?:[ıiuü]z)?|m[ıiuü]y[ıiuü][mz]|m[ıiuü]yd[ıiuü](?:n(?:[ıiuü]z)?)?)$/);
    if (standaloneQ) {
      const beforeWithoutSuffix = before.slice(0, -word.length);
      const prevMatch = beforeWithoutSuffix.match(/(\p{L}+)\s+$/u);
      if (prevMatch) {
        const harmonized = harmonizeQuestionSuffix(prevMatch[1], word);
        if (harmonized !== word) {
          out = harmonized;
        }
      }
    }

    // 2. Durum: Soru eki bitişik yazılmışsa (ör: "bekletebilirmıyım") -> Hem ayır hem ses uyumunu düzelt
    if (!out) {
      const qMatch = lower.match(/^(.+?)(m[ıiuü]s[ıiuü]n(?:[ıiuü]z)?|m[ıiuü]y[ıiuü][mz]|m[ıiuü]yd[ıiuü](?:n(?:[ıiuü]z)?)?)$/);
      
      if (qMatch && qMatch[1].length >= 2) {
        const rootLower = qMatch[1];
        const NO_SPLIT_ROOTS = new Set(["ace", "sami", "dai", "res", "ge", "mer", "ekono", "hara", "ka"]);
        
        if (!NO_SPLIT_ROOTS.has(rootLower)) {
          const root = word.slice(0, qMatch[1].length);
          const suffix = harmonizeQuestionSuffix(root, word.slice(qMatch[1].length));
          out = root + " " + suffix;
        } else {
          if (word.length >= 3) out = deasciifyLastWord(before, word);
        }
      } else {
        const bare = lower.match(BARE_Q_RE);
        if (bare) {
          const root = word.slice(0, bare[1].length);
          out = root + " " + harmonizeQuestionSuffix(root, word.slice(bare[1].length));
        } else if (word.length >= 3) {
          out = deasciifyLastWord(before, word);
        }
      }
    }
  }
  
  if (!out) return false;

  selectBack(el, wordLengthToSelect); 
  insert(el, out);             
  return true;
}

function isQuestion(text) {
  const last = text.split(/[.!?…]/).pop().toLocaleLowerCase("tr-TR").trim();
  const L = "(?<![\\p{L}])";
  const R = "(?![\\p{L}])";
  const particle = new RegExp(
    L + "(mı|mi|mu|mü)(yım|yim|yum|yüm|yız|yiz|yuz|yüz|sın|sin|sun|sün|sınız|siniz|sunuz|sünüz|dır|dir|dur|dür|ydı|ydi|ydu|ydü|ydın|ydin|ydun|ydün|ymış|ymiş|lar|ler|sınlar|sinler|yım|yim)?(siniz|siniz|lar|ler)?" + R, "u");
  const word = new RegExp(
    L + "(ne|neler|neden|niçin|niye|nasıl|nasılsın|nasılsınız|kim|kime|kimi|kimin|kiminle|kimden|kimler|kimsin|kimsiniz|kimdir|nesin|nesiniz|nedir|nelerdir|nere|nerede|neresi|neresini|neredesin|neredesiniz|nereye|nereden|kaç|kaça|kaçta|kaçıncı|kaçı|kaçınız|hangi|hangisi|hangileri|hangimiz|hanginiz|ne zaman|ne kadar|neyle|neci)" + R, "u");
  const lastWord = (last.match(/(\p{L}+)$/u) || ["", ""])[1];
  return particle.test(last) || word.test(last) || BARE_Q_RE.test(lastWord);
}

function endsOk(t) {
  return (/[.!?…:;)"'»]$/.test(t) || /\p{Extended_Pictographic}\uFE0F?$/u.test(t) || /https?:\/\/\S+$/.test(t) || /\S+@\S+\.\S+$/.test(t));
}

function processPastedText(rawText) {
  let text = rawText.replace(/\p{L}{3,}/gu, function(w) {
    const b = w.toLocaleLowerCase("tr-TR").match(BARE_Q_RE);
    if (!b) return w;
    const root = w.slice(0, b[1].length);
    return root + " " + harmonizeQuestionSuffix(root, w.slice(b[1].length));
  });
  
  if (deascii) {
    try { text = deascii.deasciify(text) || text; } catch (e) {}
  }
  
  let words = text.split(/([\s,.;!?]+)/);
  for (let i = 0; i < words.length; i++) {
    if (/^[\s,.;!?]+$/.test(words[i])) continue;
    let originalWord = words[i];
    let lower = originalWord.toLocaleLowerCase("tr-TR");
    
    if (SKIP_WORDS.has(lower)) continue;
    
    let fix = TYPO_DICT[lower];
    if (fix) {
      let firstChar = originalWord.charAt(0);
      let isOriginalCapitalized = (firstChar !== firstChar.toLocaleLowerCase("tr-TR"));
      
      if (isOriginalCapitalized) {
        fix = fix.charAt(0).toLocaleUpperCase("tr-TR") + fix.slice(1);
      }
      words[i] = fix;
      
      if (["Bey", "Hanım", "Beyefendi", "Hanımefendi"].includes(fix) && i >= 2) {
        let prevWord = words[i-2];
        if (prevWord && !/^[\s,.;!?]+$/.test(prevWord)) {
          let pFirst = prevWord.charAt(0);
          if (pFirst === pFirst.toLocaleLowerCase("tr-TR")) {
            words[i-2] = pFirst.toLocaleUpperCase("tr-TR") + prevWord.slice(1);
          }
        }
      }
    }
  }
  text = words.join('');
  
  // Bitişik soru eklerini ayır ve ses uyumuna göre düzelt
  const qRegex = /(\p{L}{2,})(m[ıiuü]s[ıiuü]n(?:[ıiuü]z)?|m[ıiuü]y[ıiuü][mz]|m[ıiuü]yd[ıiuü](?:n(?:[ıiuü]z)?)?)(?=[\s,.;!?]|$)/ugi;
  text = text.replace(qRegex, function(match, root, suffix) {
    const NO_SPLIT_ROOTS = new Set(["ace", "sami", "dai", "res", "ge", "mer", "ekono", "hara", "ka"]);
    if (NO_SPLIT_ROOTS.has(root.toLocaleLowerCase("tr-TR"))) return match; 
    return root + " " + harmonizeQuestionSuffix(root, suffix);
  });

  // Ayrı yazılmış ama ses uyumu bozuk soru eklerini düzelt (ör: "bekletebilir mıyım")
  const standaloneQRegex = /(\p{L}{2,})(\s+)(m[ıiuü]s[ıiuü]n(?:[ıiuü]z)?|m[ıiuü]y[ıiuü][mz]|m[ıiuü]yd[ıiuü](?:n(?:[ıiuü]z)?)?)(?=[\s,.;!?]|$)/ugi;
  text = text.replace(standaloneQRegex, function(match, root, space, suffix) {
    return root + space + harmonizeQuestionSuffix(root, suffix);
  });
  
  const boundaryRegex = /(sağlıyorum|ediyorum|bekliyorum|istiyorum|yapıyorum|diliyorum|geliyorum)\s+(sizi|size|seni|sana|lütfen|ne|nasıl|yardımcı|hemen|kısa|biraz|şu|bunu|bu)(?=[\s,.;!?]|$)/ugi;
  text = text.replace(boundaryRegex, function(match, verb, nextWord) {
    const capitalizedNext = nextWord.charAt(0).toLocaleUpperCase("tr-TR") + nextWord.slice(1);
    return verb + ". " + capitalizedNext;
  });

  // Noktalama işaretinden önceki gereksiz boşluğu temizle (ör: "miyim ?" -> "miyim?")
  text = text.replace(/\s+([.,!?;:])/g, "$1");
  
  text = text.replace(/(^|[.!?…]\s+)(\p{L})/gu, function(match, separator, letter) {
    return separator + letter.toLocaleUpperCase("tr-TR");
  });
  
  return text;
}

let replaying = false;

function handleEnter(e, el) {
  if (e.shiftKey) return;
  const text = fullText(el);
  if (!text || !text.trim()) return;

  const before = textBeforeCaret(el);
  if (before === null) return;

  let changed = false;

  try { if (correctLastWord(el)) changed = true; } catch (err) {}

  if (ENFORCE_END_PERIOD) {
    const t = textBeforeCaret(el) || "";
    if (/\p{L}/u.test(t) && !endsOk(t)) {
      insert(el, isQuestion(t) ? "?" : ".");
      changed = true;
    }
  }

  if (!changed) return;

  e.preventDefault();
  e.stopPropagation(); 
  e.stopImmediatePropagation();
  
  setTimeout(() => {
    replaying = true;
    const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
    replaying = false;
  }, 250); 
}

document.addEventListener(
  "keydown",
  (e) => {
    if (replaying || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target.closest ? e.target.closest(INPUT_SELECTOR) : null;
    if (!el) return;

    if (e.key === "Enter") {
      handleEnter(e, el);
      return;
    }

    if (e.key === " ") {
      const b = textBeforeCaret(el);
      if (b !== null && (b === "" || /\s$/.test(b))) {
        e.preventDefault();
        return;
      }
      if (checkSentenceBoundaries(el)) {
        e.preventDefault();
        insert(el, " ");
        return;
      }
      correctLastWord(el);
      return;
    }

    if (/^[.,!?;:]$/.test(e.key)) {
      correctLastWord(el);
      const b = textBeforeCaret(el);
      if (b && /\s+$/.test(b)) {
        const trailingSpaces = b.match(/\s+$/)[0].length;
        selectBack(el, trailingSpaces);
        document.execCommand("delete");
      }
      return;
    }

    if (e.key.length === 1 && /\p{L}/u.test(e.key)) {
      const b = textBeforeCaret(el);
      if (b === null) return;
      const prefix = /[,;!]$/.test(b) ? " " : "";
      const needCap = b.trim() === "" || /[.!?…]\s+$/.test(b) || /!$/.test(b);
      const out = needCap ? e.key.toLocaleUpperCase("tr-TR") : e.key;
      if (!prefix && out === e.key) return;
      e.preventDefault();
      insert(el, prefix + out);
    }
  },
  true 
);

document.addEventListener("paste", (e) => {
  const el = e.target.closest ? e.target.closest(INPUT_SELECTOR) : null;
  if (!el) return;

  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedText = clipboardData.getData("text");

  if (!pastedText) return;

  const processedText = processPastedText(pastedText);

  if (processedText !== pastedText) {
    e.preventDefault();
    insert(el, processedText);
  }
}, true);