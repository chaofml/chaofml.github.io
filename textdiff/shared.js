/* ==========================================================================
   文本工具箱 · 公共脚本
   各工具页在 vs/loader.js 之后引入：<script src="shared.js"></script>
   约定页面必须有的元素：#boot（启动/报错面板）、#app（hidden，主界面）。
   #toast 与 #stat 若不存在会按需创建 / 跳过。
   ========================================================================== */
(function (global) {
  'use strict';

  var TD = {};
  var LOAD_TIMEOUT = 12000;
  TD.started = false;

  // ---------------------------------------------------------------- 基础工具
  TD.esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  TD.toast = function (msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(TD._toastTimer);
    TD._toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  };

  // 启动/加载失败时把原因渲染到 #boot 上（不再静默卡在"正在加载"）
  TD.fail = function (title, detail, raw) {
    if (TD.started) { return; }
    clearTimeout(TD._loadTimer);
    var bootEl = document.getElementById('boot');
    if (!bootEl) { return; }
    var isFile = location.protocol === 'file:';
    var html = '<div class="center err">';
    html += '<h3>' + TD.esc(title) + '</h3>';
    html += '<p>' + detail + '</p>';
    if (isFile) {
      html += '<p><b>当前是以 file:// 直接打开的页面</b>，浏览器会拦截编辑器的工作线程与模块加载。<br>' +
              '请改为双击同目录下的 <code>start.bat</code>（启动本地服务后自动打开浏览器）。</p>';
    } else {
      html += '<ul>' +
              '<li>确认 <code>vs</code> 目录与页面在同一层</li>' +
              '<li>确认 <code>vs/loader.js</code>、<code>vs/editor/editor.main.js</code> 存在且非空</li>' +
              '<li>确认当前地址能直接打开 <a href="vs/editor/editor.main.js" target="_blank">vs/editor/editor.main.js</a></li>' +
              '</ul>';
    }
    if (raw) { html += '<div class="diag">错误详情：<pre>' + TD.esc(raw) + '</pre></div>'; }
    html += '<div class="diag">页面地址：' + TD.esc(location.href) + '</div>';
    html += '</div>';
    bootEl.innerHTML = html;
    bootEl.hidden = false;
  };

  // ------------------------------------------------- 加载 Monaco（各页统一样板）
  // 页面用法：TD.bootMonaco(function (appEl) { ...建界面... });
  TD.bootMonaco = function (onReady) {
    var bootEl = document.getElementById('boot');
    var appEl = document.getElementById('app');

    window.addEventListener('error', function (e) {
      if (!TD.started && e && e.message) { TD.fail('页面脚本出错', '加载过程中出现异常。', e.message); }
    });

    if (typeof require === 'undefined' || typeof require.config !== 'function') {
      TD.fail('编辑器内核未找到',
              '<code>vs/loader.js</code> 未能加载或未提供 AMD loader，<code>vs</code> 资源目录可能缺失。');
      return;
    }

    TD._loadTimer = setTimeout(function () {
      TD.fail('加载超时',
              '超过 ' + (LOAD_TIMEOUT / 1000) + ' 秒仍未完成加载，通常是 <code>vs</code> 资源目录不完整或路径不对。');
    }, LOAD_TIMEOUT);

    // 捕获 AMD 模块加载 / 依赖解析失败，避免静默卡住
    require.onError = function (err) {
      var msg = err && (err.message || err.src || err);
      TD.fail('编辑器内核模块加载失败', 'Monaco 的某个模块或依赖没能加载成功。', msg);
    };

    require.config({ paths: { vs: 'vs' } });

    require(['vs/editor/editor.main'], function () {
      TD.started = true;
      clearTimeout(TD._loadTimer);
      try {
        bootEl.hidden = true;
        appEl.hidden = false;
        onReady(appEl);
      } catch (e) {
        console.error(e);
        TD.started = false;
        TD.fail('初始化失败', '编辑器内核已加载，但创建界面时出错。', (e && e.stack) || String(e));
      }
    });
  };

  // ------------------------------------------------------------------ 文件读取
  // 先用严格 UTF-8 解码；失败即判定为 GBK（账单导出的 csv/txt 很常见）
  TD.decodeBuffer = function (buf) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (e) {
      try { return new TextDecoder('gbk').decode(buf); }
      catch (e2) { return new TextDecoder('utf-8').decode(buf); }
    }
  };

  TD.loadFileInto = function (model, file, onDone) {
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      var text = TD.decodeBuffer(reader.result);
      model.setValue(text);
      if (/\.json$/i.test(file.name) && /^[\[{]/.test(text.trim())) {
        monaco.editor.setModelLanguage(model, 'json');
      }
      if (onDone) { onDone(text, file); }
      TD.toast('已载入 ' + file.name + '（' + text.split('\n').length + ' 行）');
    };
    reader.onerror = function () { TD.toast('读取文件失败'); };
    reader.readAsArrayBuffer(file);
  };

  // ---------------------------------------------------------------- 差异统计
  TD.lineCount = function (model) {
    return model.getValueLength() === 0 ? 0 : model.getLineCount();
  };

  TD.changesStat = function (changes) {
    var add = 0, del = 0;
    if (!changes) { return { add: 0, del: 0, count: 0 }; }
    for (var i = 0; i < changes.length; i++) {
      var c = changes[i];
      // modifiedEndLineNumber === 0 表示纯删除；originalEndLineNumber === 0 表示纯新增
      if (c.modifiedEndLineNumber === 0) {
        del += c.originalEndLineNumber - c.originalStartLineNumber + 1;
      } else if (c.originalEndLineNumber === 0) {
        add += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
      } else {
        del += c.originalEndLineNumber - c.originalStartLineNumber + 1;
        add += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
      }
    }
    return { add: add, del: del, count: changes.length };
  };

  // 把统计渲染到某个元素（无此元素则静默跳过），并返回 {add,del,count}
  TD.renderStat = function (el, mOld, mNew, changes) {
    var s = TD.changesStat(changes);
    if (!el) { return s; }
    var o = TD.lineCount(mOld), n = TD.lineCount(mNew);
    var head = (o === 0 && n === 0) ? '' : ('旧 ' + o + ' · 新 ' + n + ' 行');
    var body;
    if (o === 0 && n === 0) { body = ''; }
    else if (s.add === 0 && s.del === 0) { body = '<span class="same">两侧一致</span>'; }
    else { body = '差异 <span class="del">−' + s.del + '</span> / <span class="add">+' + s.add + '</span> 行'; }
    el.innerHTML = (head && body) ? (head + ' │ ' + body) : (head || body);
    return s;
  };

  // ------------------------------------------------- 工具栏通用绑定（两页共用）
  // cfg: { diff, mOld, mNew, statEl, statDelay }
  // 依赖约定 id：btnSide btnInline optWs labWs optFold labFold
  //              btnPrev btnNext btnJson btnSwap btnClear btnFileA btnFileB fileA fileB
  TD.bindToolbar = function (cfg) {
    var diff = cfg.diff, mOld = cfg.mOld, mNew = cfg.mNew;
    var statEl = cfg.statEl || document.getElementById('stat');

    function refreshStat() { return TD.renderStat(statEl, mOld, mNew, diff.getLineChanges()); }

    diff.onDidUpdateDiff(refreshStat);
    setTimeout(refreshStat, 0);

    function $(id) { return document.getElementById(id); }

    // 并排 / 内联
    var btnSide = $('btnSide'), btnInline = $('btnInline');
    function setView(inline) {
      diff.updateOptions({ renderSideBySide: !inline });
      if (btnSide) { btnSide.classList.toggle('on', !inline); }
      if (btnInline) { btnInline.classList.toggle('on', inline); }
    }
    if (btnSide) { btnSide.onclick = function () { setView(false); }; }
    if (btnInline) { btnInline.onclick = function () { setView(true); }; }

    // 忽略空白
    var optWs = $('optWs'), labWs = $('labWs');
    if (optWs) {
      optWs.onchange = function () {
        diff.updateOptions({ ignoreTrimWhitespace: optWs.checked });
        if (labWs) { labWs.classList.toggle('on', optWs.checked); }
        setTimeout(refreshStat, 0);
      };
    }

    // 折叠未变更行
    var optFold = $('optFold'), labFold = $('labFold');
    if (optFold) {
      optFold.onchange = function () {
        diff.updateOptions({ hideUnchangedRegions: { enabled: optFold.checked } });
        if (labFold) { labFold.classList.toggle('on', optFold.checked); }
        setTimeout(refreshStat, 0);
      };
    }

    // 差异间跳转（Alt+↑ / Alt+↓）
    function goDiff(dir) {
      try {
        if (typeof diff.goToDiff === 'function') { diff.goToDiff(dir); }
        else { TD.toast('当前 Monaco 版本不支持差异跳转'); }
      } catch (e) { console.error(e); }
    }
    var btnPrev = $('btnPrev'), btnNext = $('btnNext');
    if (btnPrev) { btnPrev.onclick = function () { goDiff('previous'); }; }
    if (btnNext) { btnNext.onclick = function () { goDiff('next'); }; }
    document.addEventListener('keydown', function (e) {
      if (!e.altKey) { return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); goDiff('previous'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); goDiff('next'); }
    });

    // JSON 美化
    var btnJson = $('btnJson');
    if (btnJson) {
      btnJson.onclick = function () {
        var bad = null;
        [[mOld, '左侧'], [mNew, '右侧']].forEach(function (pair) {
          var m = pair[0], label = pair[1];
          var raw = m.getValue();
          if (!raw.trim()) { return; }
          try {
            m.setValue(JSON.stringify(JSON.parse(raw), null, 2));
            monaco.editor.setModelLanguage(m, 'json');
          } catch (e) {
            if (!bad) { bad = label + '不是合法 JSON：' + (e && e.message ? e.message : e); }
          }
        });
        TD.toast(bad || '已完成 JSON 美化');
      };
    }

    // 交换左右
    var btnSwap = $('btnSwap');
    if (btnSwap) {
      btnSwap.onclick = function () {
        var a = mOld.getValue();
        mOld.setValue(mNew.getValue());
        mNew.setValue(a);
      };
    }

    // 清空
    var btnClear = $('btnClear');
    if (btnClear) {
      btnClear.onclick = function () {
        mOld.setValue('');
        mNew.setValue('');
        monaco.editor.setModelLanguage(mOld, 'plaintext');
        monaco.editor.setModelLanguage(mNew, 'plaintext');
      };
    }

    // 载入旧 / 新文件
    var fileA = $('fileA'), fileB = $('fileB');
    var btnFileA = $('btnFileA'), btnFileB = $('btnFileB');
    if (fileA) {
      fileA.onchange = function () { TD.loadFileInto(mOld, fileA.files[0]); fileA.value = ''; };
    }
    if (fileB) {
      fileB.onchange = function () { TD.loadFileInto(mNew, fileB.files[0]); fileB.value = ''; };
    }
    if (btnFileA && fileA) { btnFileA.onclick = function () { fileA.click(); }; }
    if (btnFileB && fileB) { btnFileB.onclick = function () { fileB.click(); }; }

    // 阻止整页拖放把页面替换掉
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    return { refreshStat: refreshStat, setView: setView, goDiff: goDiff };
  };

  global.TD = TD;
})(window);
