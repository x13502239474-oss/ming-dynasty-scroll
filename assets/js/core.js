/* ===========================================================
   大明长卷 · 核心脚本
   =========================================================== */
(function () {
  const M = window.MING = window.MING || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------- 存储 ---------------- */
  const S = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  M.store = S;

  /* ---------------- 主题 ---------------- */
  const THEME_KEY = 'ming.theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $$('.js-theme').forEach(b => {
      b.innerHTML = t === 'dark'
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      b.setAttribute('aria-label', t === 'dark' ? '切换到浅色' : '切换到深色');
    });
  }
  M.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    S.set(THEME_KEY, cur); applyTheme(cur);
  };
  M.applyTheme = applyTheme;
  applyTheme(S.get(THEME_KEY, 'light'));

  /* ---------------- 阅读设置 ---------------- */
  const RKEY = 'ming.reader';
  const R_DEF = { size: 17.5, lh: 1.95, width: 37, font: 'serif' };
  M.reader = {
    get() { return Object.assign({}, R_DEF, S.get(RKEY, {})); },
    set(p) { const n = Object.assign(M.reader.get(), p); S.set(RKEY, n); M.reader.apply(n); return n; },
    apply(s) {
      s = s || M.reader.get();
      const r = document.documentElement.style;
      r.setProperty('--r-size', s.size + 'px');
      r.setProperty('--r-lh', s.lh);
      r.setProperty('--r-width', s.width + 'em');
      r.setProperty('--r-font', s.font === 'kai' ? 'var(--kai)' : 'var(--serif)');
    },
  };

  /* ---------------- 工具 ---------------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  M.esc = esc;

  M.vol = (id) => M.volumes.find(v => v.id === id);
  M.chapter = (id) => M.chapters.find(c => c.id === id);
  M.person = (id) => M.people.find(p => p.id === id);
  M.topic = (id) => M.topics.find(t => t.id === id);
  M.qs = function (k) { return new URLSearchParams(location.search).get(k); };
  M.chaptersOf = (volId) => M.chapters.filter(c => c.vol === volId).sort((a, b) => a.no - b.no);
  M.catName = (id) => (M.cats.find(c => c.id === id) || {}).name || '';
  M.sealChar = function (p) {
    const n = p.name || '';
    if (/皇后|贵妃|太后|太子/.test(n)) return n.slice(0, 1);
    if (n.length <= 2) return n;
    if (n.length === 3) return n.slice(1);
    return n.slice(0, 2);
  };

  /* 人物姓名索引（含常用代称） */
  const ALIAS = {
    '洪武': 'zhuyuanzhang', '太祖': 'zhuyuanzhang', '朱重八': 'zhuyuanzhang',
    '建文': 'zhuyunwen', '永乐': 'zhudi', '成祖': 'zhudi',
    '洪熙': 'zhugaochi', '宣德': 'zhuzhanji', '宣宗': 'zhuzhanji',
    '正统': 'zhuqizhen', '英宗': 'zhuqizhen', '景泰': 'zhubianyu',
    '成化': 'zhujianshen', '弘治': 'zhuyoutang', '正德': 'zhuhouzhao',
    '嘉靖': 'zhuhouzhong', '世宗': 'zhuhouzhong', '隆庆': 'zhuzaihou',
    '万历': 'zhuyijun', '神宗': 'zhuyijun', '崇祯': 'zhuyoujian',
    '阳明': 'wangshouren', '王阳明': 'wangshouren', '张太岳': 'zhangjuzheng',
    '张江陵': 'zhangjuzheng', '严分宜': 'yansong', '徐少湖': 'xujie',
  };
  let NAME_LIST = null;
  function nameList() {
    if (NAME_LIST) return NAME_LIST;
    const seen = new Set(), arr = [];
    M.people.forEach(p => {
      if (!seen.has(p.name)) { seen.add(p.name); arr.push({ n: p.name, id: p.id }); }
    });
    Object.keys(ALIAS).forEach(n => {
      if (!seen.has(n) && M.person(ALIAS[n])) { seen.add(n); arr.push({ n, id: ALIAS[n] }); }
    });
    arr.sort((a, b) => b.n.length - a.n.length);
    NAME_LIST = arr;
    return arr;
  }
  const RE_ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* 自动为正文中的人物姓名加链接（每人每章最多 2 次） */
  M.autolink = function (text, state) {
    state = state || { count: {} };
    const list = nameList();
    if (!list.length) return esc(text);
    const re = new RegExp(list.map(o => RE_ESC(o.n)).join('|'), 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(text))) {
      const hit = m[0];
      const item = list.find(o => o.n === hit);
      out += esc(text.slice(last, m.index));
      const c = state.count[item.id] || 0;
      if (c < 2) {
        state.count[item.id] = c + 1;
        out += `<a class="plink" href="person.html?id=${item.id}" title="${esc(item.n)}的人物档案">${esc(hit)}</a>`;
      } else out += esc(hit);
      last = m.index + hit.length;
    }
    out += esc(text.slice(last));
    return out;
  };

  /* ---------------- 页面框架 ---------------- */
  const NAV = [
    { href: 'index.html', t: '长卷', key: 'home' },
    { href: 'timeline.html', t: '时间轴', key: 'timeline' },
    { href: 'people.html', t: '人物', key: 'people' },
    { href: 'topics.html', t: '专题', key: 'topics' },
  ];
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    timeline: '<path d="M12 3v18"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h5M5 17h5"/>',
    people: '<circle cx="12" cy="8" r="3.2"/><path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6"/>',
    topics: '<rect x="3.5" y="4.5" width="7" height="7"/><rect x="13.5" y="4.5" width="7" height="7"/><rect x="3.5" y="14.5" width="7" height="5"/><rect x="13.5" y="14.5" width="7" height="5"/>',
  };

  M.chrome = function (active) {
    const head = document.createElement('header');
    head.className = 'site-head';
    head.innerHTML = `<div class="wrap">
      <a class="brand" href="index.html">
        <span class="brand-mark">明</span>
        <span><span class="brand-txt">明朝那些事儿</span><span class="brand-sub">MING · 1368—1644</span></span>
      </a>
      <nav class="nav">
        ${NAV.map(n => `<a href="${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${n.t}</a>`).join('')}
      </nav>
      <div class="head-tools">
        <button class="icon-btn js-search" aria-label="搜索"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button>
        <button class="icon-btn js-theme" aria-label="切换主题"></button>
      </div>
    </div>`;
    document.body.prepend(head);

    const tab = document.createElement('nav');
    tab.className = 'tabbar';
    tab.innerHTML = NAV.map(n => `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">
      <svg viewBox="0 0 24 24">${ICON[n.key]}</svg><span>${n.t}</span></a>`).join('');
    document.body.appendChild(tab);
    document.body.classList.add('has-tabbar');

    $$('.js-theme').forEach(b => b.addEventListener('click', M.toggleTheme));
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

    const foot = document.createElement('footer');
    foot.className = 'site-foot';
    foot.innerHTML = `<div class="wrap">
      <div class="foot-grid">
        <div>
          <h4 class="foot-title">关于这个阅读空间</h4>
          <p class="foot-txt">以《明朝那些事儿》的历史叙事结构与内容脉络为蓝本，用原创文字重新整理明代二百七十六年的兴衰。以人物为线索，以事件为骨架，重要的制度、战争与争议都单独展开，不做碎片化的知识点堆叠。</p>
        </div>
        <div>
          <h4 class="foot-title">阅读</h4>
          <ul class="foot-list">
            <li><a href="index.html#volumes">八卷总纲</a></li>
            <li><a href="timeline.html">历史时间轴</a></li>
            <li><a href="people.html">人物档案</a></li>
            <li><a href="topics.html">背景专题</a></li>
          </ul>
        </div>
        <div>
          <h4 class="foot-title">关于史料</h4>
          <p class="foot-txt">正文为原创整理，参考《明史》《明实录》《明史纪事本末》及近现代明史研究。凡属作者推断、学界争议或后世演绎之处，均在文中标注说明；不虚构原文，不把文学化叙述当作史实。</p>
        </div>
      </div>
      <div class="foot-bottom">
        <span>大明长卷 · 一个关于阅读的明史空间</span>
        <span>内容持续编纂中 · 洪武 / 建文 / 永乐 已成卷</span>
      </div>
    </div>`;
    document.body.appendChild(foot);
    mountSearch();
  };

  /* ---------------- 搜索 ---------------- */
  function searchIndex() {
    const idx = [];
    M.chapters.forEach(c => idx.push({
      type: '章节', href: 'read.html?ch=' + c.id,
      t: c.title, s: (M.vol(c.vol) || {}).no + ' · ' + (c.subtitle || ''),
      hay: [c.title, c.subtitle, c.lead, (c.tags || []).join('')].join(' '),
    }));
    M.people.forEach(p => idx.push({
      type: '人物', href: 'person.html?id=' + p.id,
      t: p.name, s: p.title,
      hay: [p.name, p.alias, p.title, p.brief].join(' '),
    }));
    M.topics.forEach(t => idx.push({
      type: '专题', href: 'topic.html?id=' + t.id,
      t: t.name, s: t.sub, hay: [t.name, t.sub, t.lead].join(' '),
    }));
    return idx;
  }
  let SIDX = null;

  function mountSearch() {
    const mask = document.createElement('div');
    mask.className = 'mask';
    const dr = document.createElement('div');
    dr.className = 'drawer left';
    dr.innerHTML = `<div class="drawer-head"><h3>检索长卷</h3><button class="icon-btn js-close" aria-label="关闭">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div style="padding:12px 18px 4px">
        <div class="search-box" style="max-width:none">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <input type="search" id="gsearch" placeholder="章节 / 人物 / 专题，如「张居正」" autocomplete="off">
        </div>
      </div>
      <div class="drawer-body" id="gres"><div style="padding:18px;font-size:12.5px;color:var(--ink-4);line-height:1.9">
        输入关键词，检索全部章节标题、人物档案与背景专题。</div></div>`;
    document.body.appendChild(mask);
    document.body.appendChild(dr);

    const open = () => { mask.classList.add('on'); dr.classList.add('open'); setTimeout(() => $('#gsearch').focus(), 120); };
    const close = () => { mask.classList.remove('on'); dr.classList.remove('open'); };
    $$('.js-search').forEach(b => b.addEventListener('click', open));
    mask.addEventListener('click', close);
    $('.js-close', dr).addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    const input = $('#gsearch'), res = $('#gres');
    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (!q) { res.innerHTML = '<div style="padding:18px;font-size:12.5px;color:var(--ink-4)">输入关键词开始检索。</div>'; return; }
      SIDX = SIDX || searchIndex();
      const hits = SIDX.filter(o => o.hay.includes(q) || o.t.includes(q)).slice(0, 24);
      if (!hits.length) { res.innerHTML = '<div style="padding:18px;font-size:12.5px;color:var(--ink-4)">没有找到相关内容。</div>'; return; }
      res.innerHTML = hits.map(h => `<a class="toc-link" style="align-items:flex-start;padding:11px 18px" href="${h.href}">
        <i style="flex:0 0 34px;padding-top:2px">${h.type}</i>
        <span><span style="font-family:var(--serif);font-size:14px;letter-spacing:.04em">${esc(h.t)}</span>
        <span style="display:block;font-size:11px;color:var(--ink-4);margin-top:3px">${esc(h.s || '')}</span></span></a>`).join('');
    });
  }

  /* ---------------- 水墨长卷（首页插画） ---------------- */
  M.inkLandscape = function () {
    return `<svg viewBox="0 0 1440 520" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0"/>
          <stop offset="1" stop-color="currentColor" stop-opacity=".10"/>
        </linearGradient>
      </defs>
      <g fill="currentColor" opacity=".07">
        <path d="M0 380 C90 340 140 300 210 318 C280 336 300 300 360 268 C420 236 470 290 540 306 C610 322 650 280 720 292 C790 304 830 268 900 284 C980 302 1010 330 1090 312 C1170 294 1220 320 1300 300 C1360 285 1400 300 1440 290 L1440 520 L0 520 Z"/>
      </g>
      <g fill="currentColor" opacity=".10">
        <path d="M0 420 C80 400 130 372 200 386 C270 400 320 366 390 350 C460 334 500 372 570 384 C640 396 690 360 760 366 C840 372 880 400 960 388 C1040 376 1090 396 1170 382 C1250 368 1330 392 1440 372 L1440 520 L0 520 Z"/>
      </g>
      <g fill="currentColor" opacity=".14">
        <path d="M0 462 C100 448 160 430 250 440 C340 450 400 424 480 418 C560 412 620 440 700 444 C780 448 840 420 930 424 C1020 428 1080 452 1170 444 C1260 436 1340 450 1440 440 L1440 520 L0 520 Z"/>
      </g>
      <!-- 远塔与孤松 -->
      <g stroke="currentColor" stroke-width="1.4" fill="none" opacity=".18">
        <path d="M300 372v-46M294 340h12M296 330h8M298 320h4"/>
        <path d="M1150 398v-34M1146 372h8"/>
      </g>
      <g fill="none" stroke="currentColor" stroke-width="1" opacity=".12">
        <path d="M120 330c40-8 60-24 96-20M980 318c36-6 54-22 88-18"/>
      </g>
    </svg>`;
  };

  /* ---------------- 明朝示意地图 ---------------- */
  M.mingMap = function () {
    const city = (x, y, n, big, anchor) => `
      <g><circle cx="${x}" cy="${y}" r="${big ? 4.5 : 3}" fill="${big ? 'var(--zhu)' : 'var(--ink-3)'}"/>
      <text x="${x + 7}" y="${y + 4}" font-size="${big ? 13 : 11.5}" fill="var(--ink-2)"
        font-family="Songti SC,serif" ${anchor ? 'text-anchor="end" x="' + (x - 7) + '"' : ''}>${n}</text></g>`;
    const border = (x, y, n) => `
      <g><rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="none" stroke="var(--gold)" stroke-width="1.4"/>
      <text x="${x}" y="${y - 10}" font-size="10.5" fill="var(--ink-4)" text-anchor="middle" font-family="Songti SC,serif">${n}</text></g>`;
    return `<svg viewBox="0 0 760 520" role="img" aria-label="明代两京九边示意图">
      <rect x="0" y="0" width="760" height="520" fill="none"/>
      <g opacity=".5">
        <path d="M40 120 C160 96 300 120 420 104 C520 90 640 108 720 96" fill="none"
          stroke="var(--ink-4)" stroke-width="1" stroke-dasharray="4 5"/>
        <text x="44" y="112" font-size="10" fill="var(--ink-4)" font-family="Songti SC,serif">长城 / 九边</text>
      </g>
      <!-- 黄河 -->
      <path d="M180 150 C230 190 200 230 250 260 C300 290 290 320 340 330 C400 342 430 330 470 350"
        fill="none" stroke="var(--gold)" stroke-width="2.2" opacity=".55" stroke-linecap="round"/>
      <text x="196" y="168" font-size="11" fill="var(--gold)" font-family="Songti SC,serif" opacity=".9">黄河</text>
      <!-- 长江 -->
      <path d="M120 400 C200 386 250 410 320 396 C400 380 450 404 520 392 C590 380 640 396 706 386"
        fill="none" stroke="var(--zhu)" stroke-width="2.2" opacity=".5" stroke-linecap="round"/>
      <text x="140" y="392" font-size="11" fill="var(--zhu)" font-family="Songti SC,serif" opacity=".85">长江</text>
      <!-- 大运河 -->
      <path d="M560 96 C556 160 570 210 566 270 C562 320 560 360 566 404"
        fill="none" stroke="var(--ink-3)" stroke-width="1.6" stroke-dasharray="2 4" opacity=".7"/>
      <text x="572" y="250" font-size="10" fill="var(--ink-4)" font-family="Songti SC,serif">会通河</text>

      ${border(540, 96, '辽东')} ${border(508, 130, '蓟州')} ${border(474, 152, '宣府')}
      ${border(436, 168, '大同')} ${border(392, 196, '太原')} ${border(330, 176, '榆林')}
      ${border(272, 196, '宁夏')} ${border(238, 228, '固原')} ${border(180, 186, '甘肃')}

      ${city(500, 138, '北京', true)} ${city(520, 402, '南京', true)}
      ${city(566, 300, '临清')} ${city(592, 352, '淮安')} ${city(614, 420, '苏州')}
      ${city(636, 446, '松江')} ${city(600, 380, '扬州')} ${city(566, 430, '杭州')}
      ${city(452, 336, '武昌')} ${city(416, 300, '襄阳')} ${city(396, 372, '长沙')}
      ${city(500, 330, '安庆')} ${city(516, 356, '徽州')} ${city(548, 356, '应天')}
      ${city(392, 250, '西安')} ${city(352, 268, '汉中')} ${city(280, 300, '成都')}
      ${city(340, 350, '重庆')} ${city(430, 420, '桂林')} ${city(468, 452, '广州')}
      ${city(560, 470, '福州')} ${city(506, 462, '泉州')} ${city(344, 428, '昆明')}
      ${city(430, 190, '大同')}

      <!-- 战场标记 -->
      <g>
        <path d="M498 150 l6 10 h-12 z" fill="var(--zhu)" opacity=".8"/>
        <text x="512" y="148" font-size="9.5" fill="var(--zhu)" font-family="Songti SC,serif">土木堡</text>
      </g>
      <g>
        <path d="M492 118 l6 10 h-12 z" fill="var(--zhu)" opacity=".6"/>
        <text x="470" y="114" font-size="9.5" fill="var(--zhu)" font-family="Songti SC,serif">萨尔浒</text>
      </g>
      <g>
        <circle cx="520" cy="402" r="9" fill="none" stroke="var(--zhu)" stroke-width="1" opacity=".5"/>
        <text x="540" y="416" font-size="9.5" fill="var(--ink-4)" font-family="Songti SC,serif">弘光朝廷</text>
      </g>
      <text x="700" y="500" font-size="9.5" fill="var(--ink-4)" text-anchor="end" font-family="sans-serif">示意图 · 非精确疆域</text>
    </svg>`;
  };

  /* ---------------- 卡片片段 ---------------- */
  M.volCard = function (v) {
    return `<a class="vol-card" href="volume.html?v=${v.id}">
      <div class="vol-no">${v.no}</div>
      <div class="vol-era">${v.era} · ${v.years}</div>
      <h3 class="vol-title">${esc(v.title)}</h3>
      <p class="vol-intro">${esc(v.brief)}</p>
      <div class="vol-foot"><span>${M.chaptersOf(v.id).length} 篇</span><span class="arrow">→</span></div>
    </a>`;
  };

  M.sealFace = function (p, big) {
    const cls = { mil: 'mil', eunuch: 'eun', thinker: 'thk', rebel: 'reb', qing: 'qing', south: 'off' }[p.cat] || '';
    return `<span class="seal-face ${cls} ${big ? 'big' : ''}">${esc(M.sealChar(p))}</span>`;
  };

  M.personCard = function (p) {
    return `<a class="p-card" href="person.html?id=${p.id}">
      <div class="p-face">${M.sealFace(p)}</div>
      <div>
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-title">${esc(p.title)}</div>
        <div class="p-meta">${esc(p.life || '')}</div>
      </div></a>`;
  };

  M.topicCard = function (t, i) {
    return `<a class="topic-card" href="topic.html?id=${t.id}">
      <span class="topic-num">${t.no}</span>
      <span class="topic-name">${esc(t.name)}</span>
      <p class="topic-desc">${esc(t.sub)}</p>
      <span class="topic-deco">${['制', '兵', '赋', '文', '外', '图'][i % 6]}</span>
    </a>`;
  };

  /* ---------------- 阅读进度 ---------------- */
  M.pos = {
    all() { return S.get('ming.pos', {}); },
    get(id) { return (S.get('ming.pos', {})[id]) || 0; },
    set(id, r) {
      const a = S.get('ming.pos', {});
      a[id] = Math.max(0, Math.min(1, r));
      S.set('ming.pos', a);
    },
    last() { return S.get('ming.last', null); },
    touch(id) {
      const c = M.chapter(id); if (!c) return;
      S.set('ming.last', { id, t: Date.now() });
      let h = S.get('ming.hist', []).filter(x => x.id !== id);
      h.unshift({ id, t: Date.now() });
      S.set('ming.hist', h.slice(0, 12));
    },
    hist() { return S.get('ming.hist', []); },
  };
  M.fav = {
    all() { return S.get('ming.fav', []); },
    has(id) { return M.fav.all().includes(id); },
    toggle(id) {
      let a = M.fav.all();
      a = a.includes(id) ? a.filter(x => x !== id) : [id, ...a];
      S.set('ming.fav', a); return a.includes(id);
    },
  };
  M.mark = {
    all() { return S.get('ming.mark', []); },
    add(id, ratio, text) {
      const a = M.mark.all().filter(x => !(x.id === id && Math.abs(x.ratio - ratio) < .02));
      a.unshift({ id, ratio, text: (text || '').slice(0, 60), t: Date.now() });
      S.set('ming.mark', a.slice(0, 40));
    },
    has(id) { return M.mark.all().some(x => x.id === id); },
    del(id) { S.set('ming.mark', M.mark.all().filter(x => x.id !== id)); },
  };

  /* ---------------- 动效 ---------------- */
  M.reveal = function () {
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
    $$('.reveal').forEach(el => io.observe(el));
  };

  M.fmtDate = function (ts) {
    const d = new Date(ts), n = new Date();
    const same = d.toDateString() === n.toDateString();
    const pad = x => String(x).padStart(2, '0');
    return same ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
      : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  };
})();
