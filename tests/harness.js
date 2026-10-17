/* Minimal test harness: runs tests sequentially against the real app in an iframe. */
(function(){
  var tests = [];
  var grep = new URLSearchParams(location.search).get("grep") || "";

  window.test = function(name, fn){ tests.push({ name: name, fn: fn }); };

  function fail(msg){ throw new Error(msg); }
  function show(v){ try{ return JSON.stringify(v); }catch(e){ return String(v); } }

  window.assert = {
    ok: function(v, msg){ if(!v) fail(msg || ("expected truthy, got " + show(v))); },
    equal: function(a, b, msg){ if(a !== b) fail((msg ? msg + ": " : "") + "expected " + show(b) + ", got " + show(a)); },
    deepEqual: function(a, b, msg){ if(show(a) !== show(b)) fail((msg ? msg + ": " : "") + "expected " + show(b) + ", got " + show(a)); },
    match: function(s, re, msg){ if(!re.test(String(s))) fail((msg ? msg + ": " : "") + show(s) + " does not match " + re); }
  };

  function frame(){ return document.getElementById("app-frame"); }

  function waitFor(pred, timeoutMs){
    timeoutMs = timeoutMs || 3000;
    var start = Date.now();
    return new Promise(function(resolve, reject){
      (function poll(){
        var v;
        try{ v = pred(); }catch(e){ v = null; }
        if(v){ resolve(v); return; }
        if(Date.now() - start > timeoutMs){ reject(new Error("waitFor timed out: " + pred.toString().slice(0, 120))); return; }
        setTimeout(poll, 20);
      })();
    });
  }

  function whenReady(){
    return waitFor(function(){
      var f = frame(); if(!f) return null;
      var d = f.contentDocument;
      var a = d && d.getElementById("app");
      return a && a.children.length > 0 && f.contentWindow.location.href !== "about:blank";
    }, 5000).then(function(){ return { win: app.win, doc: app.doc }; });
  }

  window.app = {
    get win(){ return frame().contentWindow; },
    get doc(){ return frame().contentDocument; },
    load: function(opts){
      opts = opts || {};
      localStorage.clear();
      var storage = opts.storage || {};
      Object.keys(storage).forEach(function(k){
        var v = storage[k];
        localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      });
      var old = frame(); if(old) old.parentNode.removeChild(old);
      var f = document.createElement("iframe");
      f.id = "app-frame";
      f.style.width = "1200px"; f.style.height = "800px";
      f.src = "../index.html" + (opts.query || "");
      document.body.appendChild(f);
      return whenReady();
    },
    reload: function(){
      var f = frame();
      f.contentWindow.location.reload();
      return new Promise(function(r){ setTimeout(r, 50); }).then(whenReady);
    },
    $: function(sel){ return app.doc.querySelector(sel); },
    $$: function(sel){ return Array.prototype.slice.call(app.doc.querySelectorAll(sel)); },
    click: function(sel){
      var el = app.$(sel);
      if(!el) fail("click: no element for " + sel);
      el.click();
    },
    waitFor: waitFor
  };

  window.runTests = async function(){
    var lines = [], passed = 0, failed = 0;
    for(var i = 0; i < tests.length; i++){
      var t = tests[i];
      if(grep && t.name.indexOf(grep) === -1) continue;
      try{ await t.fn(); lines.push("PASS " + t.name); passed++; }
      catch(e){ lines.push("FAIL " + t.name + " — " + (e && e.message || e)); failed++; }
    }
    lines.push("SUMMARY passed=" + passed + " failed=" + failed);
    var pre = document.createElement("pre");
    pre.id = "results";
    pre.textContent = lines.join("\n");
    document.body.appendChild(pre);
    var f = frame(); if(f) f.parentNode.removeChild(f);
    document.body.dataset.done = "1";
  };
})();
