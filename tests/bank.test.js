var FIXTURE_BANK = "?bank=tests/fixtures/bank-ok/index.json";

function loadFixtureBank(extra){
  var opts = { query: FIXTURE_BANK };
  if(extra){ Object.keys(extra).forEach(function(k){ opts[k] = extra[k]; }); }
  return app.load(opts).then(function(){ return app.waitFor(function(){ return app.$(".bank-card"); }); });
}

function sessionV2(){ return JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2")); }

test("bank: lists quizzes from manifest", async function(){
  await loadFixtureBank();
  var cards = app.$$(".bank-card");
  assert.equal(cards.length, 1);
  assert.match(cards[0].textContent, /Fixture QCM/);
  assert.match(cards[0].textContent, /2 questions/);
  assert.match(cards[0].innerHTML, /&lt;b&gt;/, "description escaped");
});

test("bank: invalid file is skipped, valid ones shown", async function(){
  await loadFixtureBank();
  await new Promise(function(r){ setTimeout(r, 200); });
  assert.equal(app.$$(".bank-card").length, 1);
  assert.equal(app.$("#bank-offline"), null);
});

test("bank: manifest missing shows offline message and import still works", async function(){
  await app.load({ query: "?bank=tests/fixtures/nope/index.json" });
  var msg = await app.waitFor(function(){ return app.$("#bank-offline"); });
  assert.match(msg.textContent, /Banque indisponible hors ligne — importez un fichier JSON/);
  assert.ok(app.$("#dropzone"));
  assert.ok(app.$('[data-action="pick-file"]'));
});

test("bank: open card shows preview and starts quiz with bank quizId", async function(){
  await loadFixtureBank();
  app.click(".bank-card");
  await app.waitFor(function(){ return app.$('[data-action="begin-imported"]'); });
  app.click('[data-action="begin-imported"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  assert.equal(sessionV2().quizId, "bank:good.json");
});

test("bank: real manifest lists CCDV-F", async function(){
  await app.load();
  var card = await app.waitFor(function(){ return app.$(".bank-card"); });
  assert.match(card.textContent, /91 questions/);
});

test("bank: demo button removed", async function(){
  await app.load();
  assert.equal(app.$('[data-action="try-demo"]'), null);
});
