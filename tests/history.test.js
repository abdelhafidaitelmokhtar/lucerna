function history(){ return JSON.parse(app.win.localStorage.getItem("lucerna:history:v1") || "[]"); }

function attempt(pct, date, quizId){
  return { id: (quizId || "bank:good.json") + "@" + date, quizId: quizId || "bank:good.json", title: "Fixture QCM",
    date: date, pct: pct, correct: 1, incorrect: 1, unanswered: 0, total: 2, exam: false, timeExpired: false,
    usedMs: 60000, shuffleQuestions: false, shuffleChoices: false };
}

test("core: summarize", async function(){
  var C = await core();
  var list = [attempt(50, 1), attempt(80, 2), attempt(60, 3), attempt(99, 4, "bank:other.json")];
  assert.deepEqual(C.summarize(list, "bank:good.json"), { count: 3, last: 60, best: 80 });
  assert.deepEqual(C.summarize(list, "nope"), { count: 0, last: null, best: null });
});

test("history: submit records one attempt", async function(){
  await openFixturePreview();
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  app.click('[data-action="select"]');
  await submitQuiz();
  var h = history();
  assert.equal(h.length, 1);
  assert.equal(h[0].quizId, "bank:good.json");
  assert.equal(h[0].total, 2);
  assert.equal(h[0].exam, false);

  // Review focus: reload on results must not record a second time.
  await app.reload();
  await app.waitFor(function(){ return app.$("#app").children.length; });
  assert.equal(history().length, 1, "still one attempt after reload");
});

test("history: reload on results does not record twice", async function(){
  await loadSession(examSession({ deadline: Date.now() - 1000 }));
  await app.waitFor(function(){ return app.$("#exam-summary"); });
  await app.reload();
  await new Promise(function(r){ setTimeout(r, 200); });
  assert.equal(history().length, 1);
});

test("history: expired exam recorded once with timeExpired", async function(){
  await loadSession(examSession({ deadline: Date.now() - 1000 }));
  await app.waitFor(function(){ return app.$("#exam-summary"); });
  var h = history();
  assert.equal(h.length, 1);
  assert.equal(h[0].timeExpired, true);
  assert.equal(h[0].exam, true);
});

test("history: bank card shows last and best", async function(){
  await loadFixtureBank({ storage: { "lucerna:history:v1": [attempt(40, 1), attempt(70, 2)] } });
  var s = await app.waitFor(function(){ return app.$(".bank-score"); });
  assert.equal(s.textContent.trim(), "Dernier : 70 % · Meilleur : 70 %");
});

test("history: list and chart", async function(){
  await loadFixtureBank({ storage: { "lucerna:history:v1": [attempt(40, 1), attempt(70, 2)] } });
  var rows = app.$$(".history-row");
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /70/);
  assert.equal(app.$$("svg.history-chart").length, 1);
});

test("history: clear asks confirmation", async function(){
  await loadFixtureBank({ storage: { "lucerna:history:v1": [attempt(40, 1), attempt(70, 2)] } });
  app.click('[data-action="clear-history"]');
  await app.waitFor(function(){ return app.$('[data-action="confirm-clear-history"]'); });
  app.click('[data-action="confirm-clear-history"]');
  await app.waitFor(function(){ return !app.$("#history"); });
  assert.equal(history().length, 0);
  assert.equal(app.$(".bank-score"), null);
});
