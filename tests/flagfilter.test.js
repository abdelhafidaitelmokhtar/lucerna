function fourQuestionSession(overrides){
  var qs = [1, 2, 3, 4].map(function(id){
    return { id: id, question: "Q" + id + " ?", image: null, category: null, difficulty: null, explanation: null,
      choices: [{ id: "A", text: "a", origLetter: "A" }, { id: "B", text: "b", origLetter: "B" }], correctAnswers: ["A"] };
  });
  var s = { quiz: { title: "Quatre", description: "", questions: qs }, quizId: "import:Quatre",
    options: { shuffleQuestions: false, shuffleChoices: false, exam: true, durationMin: 90 },
    current: 0, answers: {}, flags: {}, visited: { "1": true }, startedAt: Date.now() - 1000,
    deadline: Date.now() + 5400000, submittedAt: null, screen: "quiz",
    timeExpired: false, recorded: false, flagFilter: false };
  Object.keys(overrides || {}).forEach(function(k){ s[k] = overrides[k]; });
  return s;
}

function position(){ return app.$("#quiz-position").textContent.trim(); }

test("flag filter: disabled with no flags", async function(){
  await loadSession(fourQuestionSession());
  var btn = await app.waitFor(function(){ return app.$('[data-action="toggle-flag-filter"]'); });
  assert.ok(btn.disabled);
});

test("flag filter: grid and next restricted to flagged", async function(){
  await loadSession(fourQuestionSession({ flags: { "2": true, "4": true } }));
  await app.waitFor(function(){ return app.$("#question-card"); });
  app.click('[data-action="toggle-flag-filter"]');
  await app.waitFor(function(){ return app.$$(".qbadge").length === 2; });
  app.click('[data-action="next"]');
  assert.equal(position(), "Question 2 / 4");
  app.click('[data-action="next"]');
  assert.equal(position(), "Question 4 / 4");
  assert.ok(!app.$('[data-action="next"]') || app.$('[data-action="next"]').disabled, "no next flagged");
});

test("flag filter: unflag current keeps position, next skips to flagged", async function(){
  await loadSession(fourQuestionSession({ flags: { "1": true, "2": true, "4": true }, flagFilter: true, current: 1 }));
  await app.waitFor(function(){ return app.$("#question-card"); });
  assert.equal(position(), "Question 2 / 4");
  app.click('[data-action="toggle-flag"]');
  assert.equal(position(), "Question 2 / 4");
  app.click('[data-action="next"]');
  assert.equal(position(), "Question 4 / 4");
});

test("flag filter: arrow keys follow filter", async function(){
  await loadSession(fourQuestionSession({ flags: { "1": true, "4": true }, flagFilter: true }));
  await app.waitFor(function(){ return app.$("#question-card"); });
  app.doc.dispatchEvent(new app.win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(position(), "Question 4 / 4");
  app.doc.dispatchEvent(new app.win.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert.equal(position(), "Question 1 / 4");
});
