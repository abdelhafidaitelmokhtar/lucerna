async function openFixturePreview(){
  await loadFixtureBank();
  app.click(".bank-card");
  return app.waitFor(function(){ return app.$('[data-action="begin-imported"]'); });
}

function setInput(sel, value){
  var el = app.$(sel);
  if(!el) throw new Error("no input " + sel);
  if(el.type === "checkbox"){ el.checked = value; el.dispatchEvent(new app.win.Event("change", { bubbles: true })); }
  else { el.value = value; el.dispatchEvent(new app.win.Event("input", { bubbles: true })); }
}

async function submitQuiz(){
  app.click('[data-action="review"]');
  await app.waitFor(function(){ return app.$('[data-action="submit"]'); });
  app.click('[data-action="submit"]');
  var confirmBtn = app.$('[data-action="confirm-submit"]');
  if(confirmBtn) confirmBtn.click();
  return app.waitFor(function(){ return app.$('[data-action="retake"]'); });
}

test("options: defaults", async function(){
  await openFixturePreview();
  assert.equal(app.$("#opt-shuffle-q").checked, false);
  assert.equal(app.$("#opt-shuffle-c").checked, false);
  assert.equal(app.$("#opt-exam").checked, false);
  assert.equal(app.$("#opt-duration"), null, "duration hidden without exam");
  setInput("#opt-exam", true);
  await app.waitFor(function(){ return app.$("#opt-duration"); });
  assert.equal(app.$("#opt-duration").value, "90");
  assert.equal(app.$("#opt-hours"), null, "no hours field");
});

test("options: invalid duration blocks start", async function(){
  await openFixturePreview();
  setInput("#opt-exam", true);
  await app.waitFor(function(){ return app.$("#opt-duration"); });
  setInput("#opt-duration", "0");
  app.click('[data-action="begin-imported"]');
  var err = await app.waitFor(function(){ return app.$("#launch-error"); });
  assert.match(err.textContent, /entre 1 et 600 minutes/);
  assert.equal(app.$("#question-card"), null);
  assert.equal(app.win.localStorage.getItem("lucerna:quiz-session:v2"), null);
});

test("options: shuffle choices keeps letters positional and shows reminder", async function(){
  await openFixturePreview();
  setInput("#opt-shuffle-c", true);
  app.win.Math.random = function(){ return 0; };
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  assert.equal(app.$(".choice-mark").textContent, "A");
  app.click('[data-action="select"]');
  await submitQuiz();
  var reminders = app.$$(".orig-letter");
  assert.ok(reminders.length > 0, "reminder shown");
  assert.match(reminders[0].textContent, /\([A-D] dans l'explication\)/);
});

test("options: no shuffle → no reminder", async function(){
  await openFixturePreview();
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  app.click('[data-action="select"]');
  await submitQuiz();
  assert.equal(app.$$(".orig-letter").length, 0);
});

test("options: retake keeps options", async function(){
  await openFixturePreview();
  setInput("#opt-shuffle-q", true);
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  await submitQuiz();
  app.click('[data-action="retake"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  var s = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.equal(s.options.shuffleQuestions, true);
  assert.equal(s.quizId, "bank:good.json");
});

test("options: letters in duration block start", async function(){
  await openFixturePreview();
  setInput("#opt-exam", true);
  await app.waitFor(function(){ return app.$("#opt-duration"); });
  setInput("#opt-duration", "abc");
  app.click('[data-action="begin-imported"]');
  var err = await app.waitFor(function(){ return app.$("#launch-error"); });
  assert.match(err.textContent, /nombre entier/);
  assert.equal(app.win.localStorage.getItem("lucerna:quiz-session:v2"), null);
});

test("options: shuffled quiz marks the first shown question as visited", async function(){
  await openFixturePreview();
  setInput("#opt-shuffle-q", true);
  app.win.Math.random = function(){ return 0; };
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  var s = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.deepEqual(Object.keys(s.visited), [String(s.quiz.questions[0].id)]);
});
