test("session: v1 session migrates to v2", async function(){
  await app.load({ storage: { "lucerna:quiz-session:v1": {
    quiz: { title: "Ancien", description: "", questions: [
      { id: 1, question: "Q1", choices: [{ id: "A", text: "a" }, { id: "B", text: "b" }], correctAnswers: ["B"],
        explanation: null, image: null, category: null, difficulty: null } ] },
    current: 0, answers: { "1": ["A"] }, flags: {}, visited: { "1": true }, startedAt: 1, submittedAt: null, screen: "quiz" } } });
  app.click('[data-action="resume"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  var v2 = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.equal(v2.quizId, "import:Ancien");
  assert.equal(v2.options.exam, false);
  assert.equal(v2.quiz.questions[0].choices[1].origLetter, "B");
  assert.deepEqual(v2.answers, { "1": ["A"] });
  assert.equal(app.win.localStorage.getItem("lucerna:quiz-session:v1"), null);
});

test("session: corrupted v2 is ignored", async function(){
  await app.load({ storage: { "lucerna:quiz-session:v2": "not json{" } });
  assert.ok(app.$("#dropzone"), "home rendered");
  assert.equal(app.$('[data-action="resume"]'), null, "no resume banner");
});
