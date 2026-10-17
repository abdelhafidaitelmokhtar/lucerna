test("smoke: app loads home screen", async function(){
  await app.load();
  assert.ok(app.$("#dropzone"), "dropzone present");
  assert.ok(app.$('[data-action="pick-file"]'), "import button present");
});
