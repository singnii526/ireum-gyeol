// 이름결 AI 중계 서버 (Cloudflare Workers)
// - 제미나이 API 키는 이 서버의 비밀값(GEMINI_API_KEY)에만 두고, 웹페이지에는 절대 넣지 않는다.
// - 허용한 사이트(ALLOWED_ORIGINS)에서 온 요청만 받는다.
// - AI의 답은 "제안"일 뿐이다. 인명용 한자 여부·획수·점수 검증은 웹페이지(index.html)가 규칙으로 다시 한다.
//
// 요청: POST /suggest  { surname, gender, wish, yong, avoid:[...], count }
//       POST /story    { surname, name, hanja:[{h,m,r}], yong, gender }
// 응답: /suggest → { names:[{ name:"서윤", hanja:["瑞","允"], reason:"..." }] }
//       /story   → { story:"...", blessing:"..." }

const DEFAULT_MODEL = 'gemini-2.5-flash';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://singnii526.github.io').split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'POST만 받아요' }, 405, cors);
    if (!allowed.includes(origin)) return json({ error: '허용되지 않은 사이트예요' }, 403, cors);
    if (!env.GEMINI_API_KEY) return json({ error: '서버에 API 키가 설정되지 않았어요' }, 500, cors);

    let body;
    try { body = await req.json(); } catch { return json({ error: '요청 형식이 잘못됐어요' }, 400, cors); }
    const path = new URL(req.url).pathname;
    try {
      if (path === '/suggest') return json(await suggest(body, env), 200, cors);
      if (path === '/story') return json(await story(body, env), 200, cors);
      return json({ error: '없는 주소예요' }, 404, cors);
    } catch (e) {
      return json({ error: 'AI 응답을 받지 못했어요', detail: String(e).slice(0, 200) }, 502, cors);
    }
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}
const clip = (s, n) => String(s || '').slice(0, n);

async function gemini(env, prompt, schema) {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, responseMimeType: 'application/json', responseSchema: schema }
    })
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(text);
}

async function suggest(b, env) {
  const count = Math.min(15, Math.max(5, +b.count || 12));
  const prompt = `당신은 한국 아기 이름 작명가입니다. 아래 조건으로 한국 이름 후보 ${count}개를 제안하세요.
- 성: ${clip(b.surname, 4)}
- 성별: ${b.gender === 'm' ? '남자아이' : b.gender === 'f' ? '여자아이' : '정하지 않음'}
- 부모가 바라는 느낌: ${clip(b.wish, 200)}
- 사주에 필요한 오행(용신): ${clip(b.yong, 4) || '정보 없음'}
- 피할 글자: ${(b.avoid || []).slice(0, 10).map(s => clip(s, 2)).join(', ') || '없음'}
규칙:
1) 이름은 성을 뺀 한글 1~3글자, 실제로 쓰는 자연스러운 이름.
2) hanja 배열은 이름 글자 수와 같고, 각 글자는 그 음으로 읽히는 대법원 인명용 한자 한 글자.
3) reason은 왜 이 이름이 조건에 맞는지 40자 이내 한국어 한 문장.`;
  const schema = {
    type: 'OBJECT', properties: {
      names: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        name: { type: 'STRING' }, hanja: { type: 'ARRAY', items: { type: 'STRING' } }, reason: { type: 'STRING' }
      }, required: ['name', 'hanja', 'reason'] } }
    }, required: ['names']
  };
  const out = await gemini(env, prompt, schema);
  // 형식만 정리해서 돌려준다. 내용 검증은 웹페이지가 규칙으로 한다.
  const names = (out.names || []).filter(x => /^[가-힣]{1,3}$/.test(x.name) && Array.isArray(x.hanja) && x.hanja.length === [...x.name].length)
    .slice(0, count).map(x => ({ name: x.name, hanja: x.hanja.map(h => clip(h, 2)), reason: clip(x.reason, 80) }));
  return { names };
}

async function story(b, env) {
  const chars = (b.hanja || []).slice(0, 3).map(c => `${clip(c.h, 2)}(${clip(c.m, 20)} ${clip(c.r, 2)})`).join(', ');
  const prompt = `한국 아기 이름 "${clip(b.surname, 4)}${clip(b.name, 3)}"의 해설과 부모 축원문을 써 주세요.
- 한자: ${chars}
- 사주에 필요한 오행(용신): ${clip(b.yong, 4) || '정보 없음'}
규칙:
1) story: 한자 뜻을 엮어 "어떤 사람으로 자라길 바라는 이름인지" 120자 이내, 따뜻하고 담백한 한국어.
2) blessing: 부모가 아이에게 건네는 축원문 80자 이내, 아이 이름을 부르며 시작.
3) 운세를 단정하거나 과장하지 말 것.`;
  const schema = { type: 'OBJECT', properties: { story: { type: 'STRING' }, blessing: { type: 'STRING' } }, required: ['story', 'blessing'] };
  const out = await gemini(env, prompt, schema);
  return { story: clip(out.story, 200), blessing: clip(out.blessing, 150) };
}
