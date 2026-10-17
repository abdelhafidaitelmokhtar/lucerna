function core(){ return app.load().then(function(){ return app.win.LucernaCore; }); }

function seq(values){ var i = 0; return function(){ return values[i++ % values.length]; }; }

var CORE_QUIZ = { title: "T", description: "", questions: [
  { id: 1, question: "Q1", image: null, category: null, difficulty: null, explanation: null,
    choices: [{ id: "A", text: "a", origLetter: "A" }, { id: "B", text: "b", origLetter: "B" }, { id: "C", text: "c", origLetter: "C" }], correctAnswers: ["B"] },
  { id: 2, question: "Q2", image: null, category: null, difficulty: null, explanation: null,
    choices: [{ id: "A", text: "a", origLetter: "A" }, { id: "B", text: "b", origLetter: "B" }], correctAnswers: ["A", "B"] },
  { id: 3, question: "Q3", image: null, category: null, difficulty: null, explanation: null,
    choices: [{ id: "A", text: "a", origLetter: "A" }, { id: "B", text: "b", origLetter: "B" }], correctAnswers: ["A"] }
] };

test("core: shuffle is a permutation and does not mutate", async function(){
  var C = await core();
  var input = [1, 2, 3, 4];
  var out = C.shuffle(input, seq([0.9, 0.1, 0.5]));
  assert.deepEqual(input, [1, 2, 3, 4], "input untouched");
  assert.deepEqual(out.slice().sort(), [1, 2, 3, 4]);
});

test("core: prepareQuiz keeps ids, origLetter and answers", async function(){
  var C = await core();
  var before = JSON.stringify(CORE_QUIZ);
  var q = C.prepareQuiz(CORE_QUIZ, { shuffleQuestions: true, shuffleChoices: true }, function(){ return 0; });
  assert.equal(JSON.stringify(CORE_QUIZ), before, "input unchanged");
  assert.deepEqual(q.questions.map(function(x){ return x.id; }).sort(), [1, 2, 3]);
  assert.ok(q.questions.map(function(x){ return x.id; }).join() !== "1,2,3", "questions permuted");
  q.questions.forEach(function(x){
    var orig = CORE_QUIZ.questions.filter(function(o){ return o.id === x.id; })[0];
    assert.deepEqual(x.correctAnswers, orig.correctAnswers);
    x.choices.forEach(function(c){ assert.equal(c.origLetter, c.id, "origLetter kept"); });
  });
  var q1 = q.questions.filter(function(x){ return x.id === 1; })[0];
  assert.ok(q1.choices.map(function(c){ return c.id; }).join() !== "A,B,C", "choices permuted");
  var same = C.prepareQuiz(CORE_QUIZ, { shuffleQuestions: false, shuffleChoices: false });
  assert.equal(JSON.stringify(same), before, "no options = same order");
});

test("core: isCorrect", async function(){
  var C = await core();
  assert.equal(C.isCorrect(["B", "A"], ["A", "B"]), true);
  assert.equal(C.isCorrect(["A"], ["A", "B"]), false);
  assert.equal(C.isCorrect([], ["A"]), false);
});

test("core: parseDuration", async function(){
  var C = await core();
  assert.deepEqual(C.parseDuration("1", "30"), { ok: true, minutes: 90 });
  assert.deepEqual(C.parseDuration("", "45"), { ok: true, minutes: 45 });
  assert.deepEqual(C.parseDuration("10", "0"), { ok: true, minutes: 600 });
  assert.equal(C.parseDuration("0", "0").ok, false);
  assert.match(C.parseDuration("10", "1").error, /entre 1 minute et 10 heures/);
  assert.match(C.parseDuration("1.5", "0").error, /nombres entiers/);
  assert.equal(C.parseDuration("abc", "").ok, false);
  assert.equal(C.parseDuration("-1", "90").ok, false);
});

test("core: formatClock", async function(){
  var C = await core();
  assert.equal(C.formatClock(5400000), "1:30:00");
  assert.equal(C.formatClock(245000), "4:05");
  assert.equal(C.formatClock(1), "0:01");
  assert.equal(C.formatClock(-5), "0:00");
});

test("core: formatDuration", async function(){
  var C = await core();
  assert.equal(C.formatDuration(4320000), "1 h 12 min");
  assert.equal(C.formatDuration(725000), "12 min 5 s");
  assert.equal(C.formatDuration(45000), "45 s");
});

test("core: nextIndex", async function(){
  var C = await core();
  assert.equal(C.nextIndex(2, 1, [0, 3, 5]), 3);
  assert.equal(C.nextIndex(3, -1, [0, 3, 5]), 0);
  assert.equal(C.nextIndex(5, 1, [0, 3, 5]), -1);
  assert.equal(C.nextIndex(2, 1, []), -1);
});
