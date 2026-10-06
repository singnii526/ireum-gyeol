// 인명용 한자 전체 데이터 만들기
// 입력: 대법원 인명용 한자 목록(data-gov.csv), 훈음(data-naver.csv) — github.com/rutopio/Korean-Name-Hanja-Charset (MIT)
//       Unicode Unihan (kRSUnicode, kTotalStrokes, kKoreanName, kKoreanEducationHanja)
// 출력: ireum-gyeol/hanja-db.js, 검증 보고서(콘솔)
const fs = require('fs');
const T = process.env.TEMP;
const OUT = require('path').join(__dirname, '..', 'hanja-db.js');
const APP = require('path').join(__dirname, '..', 'index.html');

// ---- 강희 부수 214개의 본래 획수 (원획법) ----
const RAD_STROKES = [];
[[1,6,1],[7,29,2],[30,60,3],[61,94,4],[95,117,5],[118,146,6],[147,166,7],[167,175,8],[176,186,9],[187,194,10],[195,200,11],[201,204,12],[205,208,13],[209,210,14],[211,211,15],[212,213,16],[214,214,17]]
  .forEach(([a, b, s]) => { for (let i = a; i <= b; i++) RAD_STROKES[i] = s; });

// ---- 부수로 자원오행이 분명한 경우만 (0목 1화 2토 3금 4수) ----
// 작명 책마다 갈리는 부수(心·人·言·女·子·貝 등)는 넣지 않음 — 이 경우 자원오행을 '미정'으로 두고 추천에서 뺌
const RAD_EL = {
  75:0,140:0,118:0,115:0,120:0,                 // 木 艸 竹 禾 糸
  86:1,72:1,                                    // 火 日
  32:2,46:2,102:2,                              // 土 山 田
  167:3,96:3,112:3,                             // 金 玉 石
  85:4,173:4,15:4                               // 水 雨 冫
};

// ---- 뜻(훈)으로 느낌 태그 / 부정적 의미 ----
const TAGS = {
  밝:['밝을','빛','빛날','환할','비칠','햇빛','별','불꽃','볕','밝힐','빛나다'],
  지:['슬기','지혜','총명할','알','글','글월','학문','깨달을','생각','통할','배울','슬기로울','밝게 알'],
  덕:['착할','어질','덕','은혜','공경','공경할','사랑','사랑할','효도','너그러울','온화할','따뜻할','화할','순할','정성','믿을','바를','곧을','의로울','옳을','예도','어진','참','진실로','공손할','충성'],
  큼:['클','넓을','높을','큰','하늘','으뜸','우두머리','멀','펼','이룰','성할','오를','뛰어날','빼어날','영화','나아갈','세울','처음','근본'],
  미:['아름다울','고울','예쁠','옥','구슬','꽃','향기','향풀','비단','무늬','옥돌','옥빛','곱다','아리따울','빛깔','맑을','깨끗할'],
  자:['물','바다','강','시내','못','샘','숲','나무','풀','비','구름','산','봉우리','언덕','들','바람','이슬','물결','물가','버들','소나무','대','난초','연꽃','달','봄','여름','가을','겨울'],
  강:['굳셀','강할','굳을','이길','용감할','날랠','씩씩할','호걸','범','무성할','단단할','군셀','튼튼할','힘쓸','힘'],
  복:['복','기쁠','즐거울','경사','상서','상서로울','넉넉할','풍성할','보배','길할','편안할','평안할','이로울','도울','더할','부유할','많을','편안','기쁨','넉넉','풍년','축하할','윤택할']
};
const NEG = ['무딜','도금할','휑할','문드러질','구차할','칼날','녹슬','녹일','녹을','날카로울','빌','찌를','하물며','가게','해자','두목','죽을','죽일','병','병들','앓을','아플','귀신','근심','슬플','슬퍼할','울','곡할','망할','도둑','독','악할','흉할','가난할','천할','미칠','어리석을','시체','주검','무덤','상복','원망할','해칠','거짓','음란할','간사할','게으를','더러울','똥','오줌','버릴','잃을','패할','깨질','무너질','쇠할','홀아비','과부','외로울','괴로울','고생할','가둘','형벌','죄','죄줄','벌','싸울','끊을','막힐','어두울','두려울','놀랄','미워할','성낼','부끄러울','욕될','빌','배반할','속일','훔칠','짐승','벌레','뱀','쥐','개','돼지','늙을','눈물','피','상할','다칠','칠','때릴','어지러울','흐릴','더럽힐','망령될','요망할','재앙','화','가시','쓸','쓸쓸할','썩을','마를','시들','떨어질','잠길','빠질','기울','넘어질','지칠','곤할','궁할','모자랄','작을','천박할','낮을','흉년','굶주릴','목마를','숨을','감출','어긋날','틀릴','그릇될','잘못','거스를','못할','아닐','없을'];

// 따옴표로 묶인 칸("도,탁")을 지원하는 CSV 파서
function parseCsv(f) {
  const out = [];
  for (const line of fs.readFileSync(T + '/' + f, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const cells = []; let cur = '', q = false;
    for (const ch of line) { if (ch === '"') { q = !q; continue } if (ch === ',' && !q) { cells.push(cur); cur = ''; continue } cur += ch }
    cells.push(cur); out.push(cells);
  }
  return out;
}
// hangul,consonant,unicode,hanja — 음이 "도,탁"처럼 여럿이면 음마다 한 줄로 펼침
const gov = parseCsv('data-gov.csv').flatMap(([r, c, u, h]) => r.split(',').map(x => [x.trim(), c, u, h]));
const nav = parseCsv('data-naver.csv');            // hangul,consonant,unicode,hanja,meaning,id
const meaning = {};
nav.forEach(([r, , , h, m]) => {
  if (!m) return;
  // "아름다울 가" → "아름다울". 여러 뜻이면 첫 뜻. 끝의 음(r) 제거
  let mm = m.split(/[,;]/)[0].trim();
  if (mm.endsWith(' ' + r)) mm = mm.slice(0, -(r.length + 1)).trim();
  mm = mm.replace(/\s+[가-힣]\([가-힣]\)$/, '').trim();   // "아름다운 옥 로(노)" → "아름다운 옥"
  meaning[h + '|' + r] = meaning[h + '|' + r] || mm;
  meaning[h] = meaning[h] || mm;
});

// Unihan
const uni = {};
for (const file of ['Unihan_IRGSources.txt', 'Unihan_OtherMappings.txt', 'Unihan_RadicalStrokeCounts.txt', 'Unihan_DictionaryLikeData.txt', 'Unihan_DictionaryIndices.txt']) {
  const p = T + '/unihan/' + file; if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.startsWith('U+')) continue;
    const [cp, key, val] = line.split('\t');
    if (!['kRSUnicode', 'kTotalStrokes', 'kKoreanName', 'kKoreanEducationHanja', 'kKangXi'].includes(key)) continue;
    const ch = String.fromCodePoint(parseInt(cp.slice(2), 16));
    (uni[ch] = uni[ch] || {})[key] = val;
  }
}
// 강희자전 나머지 획수 추정: 강희자전은 부수 → 나머지 획수 순으로 배열되므로,
// 같은 부수에서 강희자전 위치(kKangXi)가 바로 앞·뒤인 글자의 나머지 획수가 같으면 그 값을 따름
const kxByRad = {};
for (const [ch, u] of Object.entries(uni)) {
  if (!u.kKangXi || !u.kRSUnicode) continue;
  const m = u.kRSUnicode.split(' ')[0].match(/^(\d+)\.(-?\d+)$/); if (!m) continue;
  (kxByRad[m[1]] = kxByRad[m[1]] || []).push({ ch, idx: parseFloat(u.kKangXi.split(' ')[0]), res: +m[2] });
}
Object.values(kxByRad).forEach(a => a.sort((p, q) => p.idx - q.idx));
function kangxiResidual(ch, rad, uniRes) {
  const a = kxByRad[rad], u = uni[ch]; if (!a || !u || !u.kKangXi) return null;
  const i = a.findIndex(x => x.ch === ch); if (i < 0) return null;
  const prev = a[i - 1], next = a[i + 1];
  if (prev && next && prev.res === next.res) return prev.res;
  if ((prev && prev.res === uniRes) || (next && next.res === uniRes)) return uniRes;
  return null;
}
function wonhoek(ch) {
  const u = uni[ch]; if (!u || !u.kRSUnicode) return null;
  const m = u.kRSUnicode.split(' ')[0].match(/^(\d+)['"]*\.(-?\d+)$/); if (!m) return null;
  const rad = +m[1], res = +m[2];
  // 원획 = max(번체·한국 자형 필획, 부수 본래 획수 + 나머지 획수)
  // 氵·扌·艹·阝·辶 처럼 줄어든 부수는 본래 획수로 세고, 자형 차이로 나머지 획수가 적게 잡힌 경우는 필획을 따름
  const tv = u.kTotalStrokes ? u.kTotalStrokes.split(' ').map(Number) : [];
  const pil = tv.length > 1 ? tv[1] : tv[0];   // 값이 둘이면 두 번째가 번체(강희 자형) 기준
  const full = RAD_STROKES[rad] + res;
  const a = pil ? Math.max(pil, full) : full;                 // 방법 1: 번체 필획 + 부수 본래 획수
  const kr = kangxiResidual(ch, rad, res);
  const b = kr == null ? null : RAD_STROKES[rad] + kr;       // 방법 2: 강희자전 나머지 획수 + 부수 본래 획수
  return { s: a, rad, pil, full, kx: b, sure: b != null && a === b };
}
// 뜻 단어 단위로 비교. 한 글자 단어(빛·별·옥·꽃·복…)는 정확히 같을 때만 인정 ('날카로울'이 '날'로, '녹슬'이 '녹'으로 잡히지 않게)
const tok = m => m.replace(/\([^)]*\)/g, ' ').split(/[\s·\/,]+/).filter(Boolean);
const hit = (t, w) => t === w || (w.length >= 2 && t.startsWith(w));
const tagsOf = m => Object.entries(TAGS).filter(([, ws]) => tok(m).some(t => ws.some(w => hit(t, w)))).map(([k]) => k);
const negOf = m => tok(m).some(t => NEG.some(w => hit(t, w)));

// 기존 수작업 사전
const app = fs.readFileSync(APP, 'utf8');
const cur = app.split('const HJ_RAW=`')[1].split('`')[0].trim().split('\n').map(l => { const [r, h, m, s, o, g, t] = l.trim().split('|'); return { r, h, m, s: +s, o, g, t }; });
const ELK = { 목: 0, 화: 1, 토: 2, 금: 3, 수: 4 };

// ---- 표 만들기 ----
const seen = new Set(), rows = [];
let noMean = 0, noStroke = 0, elKnown = 0, neg = 0, edu = 0;
for (const [r, , , h] of gov) {
  const k = r + '|' + h; if (seen.has(k)) continue; seen.add(k);
  const w = wonhoek(h);
  const m = meaning[h + '|' + r] || meaning[h] || '';
  if (!m) noMean++;
  if (!w) noStroke++;
  const el = w && RAD_EL[w.rad] != null ? RAD_EL[w.rad] : null;
  if (el != null) elKnown++;
  const ng = m ? negOf(m) : false; if (ng) neg++;
  const ed = !!(uni[h] && uni[h].kKoreanEducationHanja); if (ed) edu++;
  const tg = m ? tagsOf(m) : [];
  const gender = w && w.rad === 38 ? 'f' : 'n';
  rows.push({ r, h, m, sure: !!(w && w.sure), s: w ? w.s : null, rad: w ? w.rad : null, el, ng, ed, tg, gender, cp: h.codePointAt(0) });
}
console.log('대법원 목록 (음,한자) 쌍:', rows.length, '| 고유 한자:', new Set(rows.map(x => x.h)).size);
console.log('훈 없음:', noMean, '| 획수 계산 불가:', noStroke, '| 부수로 오행 판정:', elKnown, '| 부정적 뜻:', neg, '| 교육용:', edu);

// ---- 수작업 140자 검증 ----
const legal = new Set(rows.map(x => x.r + '|' + x.h));
const report = { notLegal: [], strokeDiff: [], elDiff: [] };
for (const c of cur) {
  if (!legal.has(c.r + '|' + c.h)) report.notLegal.push(`${c.r} ${c.h}`);
  const w = wonhoek(c.h);
  if (w && (w.s !== c.s || w.kx !== c.s)) report.strokeDiff.push(`${c.r} ${c.h}: 기존 ${c.s} | 방법1 ${w.s} | 강희 ${w.kx} ${w.sure?"(일치)":"(불일치)"}`);
  if (w && RAD_EL[w.rad] != null && RAD_EL[w.rad] !== ELK[c.o]) report.elDiff.push(`${c.r} ${c.h}: 기존 ${c.o} / 부수 기준 ${'목화토금수'[RAD_EL[w.rad]]} (부수 ${w.rad})`);
}
console.log('\n[인명용 아님]', report.notLegal.join(', ') || '없음');
console.log('[획수 다름]\n ' + (report.strokeDiff.join('\n ') || '없음'));
console.log('[오행 다름]\n ' + (report.elDiff.join('\n ') || '없음'));
fs.writeFileSync(T + '/hanja-rows.json', JSON.stringify(rows));
fs.writeFileSync(T + '/hanja-report.json', JSON.stringify(report, null, 1));

// ---- 앱에 넣을 확장 사전 만들기 ----
const curKeys = new Set(cur.map(c => c.r + '|' + c.h));
const NUMERAL = new Set([...'一二三四五六七八九十百千萬億兆']);
const isBMP = cp => (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0xF900 && cp <= 0xFAFF);
const legalCount = {};
rows.forEach(x => legalCount[x.r] = (legalCount[x.r] || 0) + 1);
const ext = rows.filter(x => !curKeys.has(x.r + '|' + x.h) && x.m && !x.ng && x.el != null && x.sure && x.s && isBMP(x.cp) && !NUMERAL.has(x.h));
const KN = new Set(JSON.parse(fs.readFileSync(T + '/kn.json', 'utf8')));
ext.forEach(x => x.auto = x.ed && x.tg.some(t => t !== '자')); // 자동 추천은 교육용 기초한자 중 좋은 뜻만
const auto = ext.filter(x => x.auto);
console.log('\n확장 사전(직접 입력 이름용):', ext.length, '| 그중 자동 추천 대상(교육용+좋은 뜻):', auto.length);
const line = x => [x.r, x.h, x.m, x.s, x.el, (x.auto ? 'a' : '') + (x.ed ? 'e' : ''), x.tg.join('')].join('|');
const body = `// 이름결 인명용 한자 확장 사전 — build-hanja.js로 생성 (손으로 고치지 말 것)
// 출처: 대법원 인명용 한자표(전자가족관계등록시스템, 2024.6 시행 9,389자) · 훈음: 네이버 한자사전 대법원 인명한자
//       (수집: github.com/rutopio/Korean-Name-Hanja-Charset, MIT) · 획수·부수: Unicode Unihan ${new Date().toISOString().slice(0,10)}
// 넣는 기준: 인명용 · 훈 있음 · 부정적 뜻 아님 · 원획 두 방법 일치 · 부수로 자원오행이 분명함(木艸竹禾糸/火日/土山田/金玉石/水雨冫)
// 형식: 음|한자|훈|원획|자원오행(0목1화2토3금4수)|플래그(a 자동추천, e 교육용)|느낌태그
window.HANJA_EXT="${ext.map(line).join(';')}";
window.HANJA_LEGAL_COUNT=${JSON.stringify(legalCount)};
window.HANJA_LEGAL_PAIRS="${rows.map(x => x.r + x.h).join(';')}";
`;
fs.writeFileSync(OUT, body);
console.log('hanja-db.js', Buffer.byteLength(body), 'bytes');
const bySyl = {}; auto.forEach(x => bySyl[x.r] = (bySyl[x.r] || 0) + 1);
console.log('자동 추천 음절 수:', Object.keys(bySyl).length, '| 예:', ['서','준','하','윤','민','지','은','로','늘','온'].map(s => s + '=' + (bySyl[s] || 0) + '/' + ext.filter(x => x.r === s).length).join(' '));
console.log('샘플:', auto.filter(x => ['서','준','하'].includes(x.r)).slice(0, 12).map(x => `${x.r}${x.h}(${x.m},${x.s},${'목화토금수'[x.el]},${x.tg.join('')})`).join(' '));
