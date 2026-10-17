async function finishFixtureQuiz(){
  await openFixturePreview();
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  app.click('[data-choice="B"]');   // Q1 correct, Q2 left unanswered
  await submitQuiz();
}

test("print: prints all questions even when filtered", async function(){
  await finishFixtureQuiz();
  app.click('[data-action="filter-incorrect"]');
  await app.waitFor(function(){ return app.$$(".correction-item").length === 1; });
  var count = -1;
  app.win.print = function(){ count = app.$$(".correction-item").length; };
  app.click('[data-action="print"]');
  assert.equal(count, 2);
  assert.equal(app.$$(".correction-item").length, 1, "filter restored after printing");
});

test("print: header present", async function(){
  await finishFixtureQuiz();
  var h = app.$("#print-header");
  assert.ok(h, "print header exists");
  assert.match(h.textContent, /Fixture QCM/);
  assert.match(h.textContent, /%/);
});
