var FIXTURE_QUIZ = { title: "Fixture QCM", description: "", questions: [
  { id: 1, question: "Q1 ?", image: null, category: null, difficulty: null, explanation: "Why B.",
    choices: [{ id: "A", text: "Alpha", origLetter: "A" }, { id: "B", text: "Beta", origLetter: "B" }], correctAnswers: ["B"] },
  { id: 2, question: "Q2 ?", image: null, category: null, difficulty: null, explanation: null,
    choices: [{ id: "A", text: "Un", origLetter: "A" }, { id: "B", text: "Deux", origLetter: "B" }], correctAnswers: ["A"] }
] };

function examSession(overrides){
  var startedAt = Date.now() - 1000;
  var s = { quiz: FIXTURE_QUIZ, quizId: "bank:good.json",
    options: { shuffleQuestions: false, shuffleChoices: false, exam: true, durationMin: 90 },
    current: 0, answers: {}, flags: {}, visited: { "1": true }, startedAt: startedAt,
    deadline: startedAt + 5400000, submittedAt: null, screen: "quiz",
    timeExpired: false, recorded: false, flagFilter: false };
  Object.keys(overrides || {}).forEach(function(k){ s[k] = overrides[k]; });
  return s;
}

function loadSession(session){
  return app.load({ query: FIXTURE_BANK, storage: { "lucerna:quiz-session:v2": session } });
}

test("exam: timer shown and formatted", async function(){
  await openFixturePreview();
  setInput("#opt-exam", true);
  await app.waitFor(function(){ return app.$("#opt-duration"); });
  app.click('[data-action="begin-imported"]');
  var t = await app.waitFor(function(){ return app.$("#exam-timer"); });
  assert.match(t.textContent.trim(), /^1:(29|30):\d\d$/);
  var s = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.equal(s.deadline - s.startedAt, 5400000);
});

test("exam: warning under 5 minutes", async function(){
  await loadSession(examSession({ deadline: Date.now() + 120000 }));
  var t = await app.waitFor(function(){ return app.$("#exam-timer"); });
  assert.ok(t.classList.contains("warn"));
});

test("exam: reload goes straight back into quiz", async function(){
  await loadSession(examSession());
  await app.waitFor(function(){ return app.$("#question-card"); });
  assert.equal(app.$('[data-action="resume"]'), null);
});

test("exam: expired on load is auto-submitted", async function(){
  await loadSession(examSession({ deadline: Date.now() - 1000 }));
  var sum = await app.waitFor(function(){ return app.$("#exam-summary"); });
  assert.match(sum.textContent, /Temps écoulé/);
  var s = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.ok(s.submittedAt);
  assert.equal(s.timeExpired, true);
});

test("exam: expires while open", async function(){
  await loadSession(examSession({ deadline: Date.now() + 1500 }));
  await app.waitFor(function(){ return app.$("#question-card"); });
  var sum = await app.waitFor(function(){ return app.$("#exam-summary"); }, 5000);
  assert.match(sum.textContent, /Temps écoulé/);
  assert.equal(app.$('[data-action="confirm-submit"]'), null);
});

test("exam: abandon asks confirmation then submits", async function(){
  await loadSession(examSession());
  await app.waitFor(function(){ return app.$("#question-card"); });
  app.click('[data-action="abandon-exam"]');
  await app.waitFor(function(){ return app.$('[data-action="confirm-abandon"]'); });
  app.click('[data-action="confirm-abandon"]');
  var sum = await app.waitFor(function(){ return app.$("#exam-summary"); });
  assert.match(sum.textContent, /Temps utilisé/);
  var s = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.equal(s.timeExpired, false);
  assert.ok(s.submittedAt);
});

test("exam: non-exam session keeps resume banner", async function(){
  var s = examSession({ deadline: null });
  s.options = { shuffleQuestions: false, shuffleChoices: false, exam: false, durationMin: 90 };
  await loadSession(s);
  assert.ok(app.$('[data-action="resume"]'));
  assert.equal(app.$("#exam-timer"), null);
});
