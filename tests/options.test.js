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
  assert.equal(app.$("#opt-hours"), null, "duration hidden without exam");
  setInput("#opt-exam", true);
  await app.waitFor(function(){ return app.$("#opt-hours"); });
  assert.equal(app.$("#opt-hours").value, "1");
  assert.equal(app.$("#opt-minutes").value, "30");
});

test("options: invalid duration blocks start", async function(){
  await openFixturePreview();
  setInput("#opt-exam", true);
  await app.waitFor(function(){ return app.$("#opt-hours"); });
  setInput("#opt-hours", "0");
  setInput("#opt-minutes", "0");
  app.click('[data-action="begin-imported"]');
  var err = await app.waitFor(function(){ return app.$("#launch-error"); });
  assert.match(err.textContent, /entre 1 minute et 10 heures/);
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
