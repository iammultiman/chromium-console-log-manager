const ExtensionSettings = require('../models/ExtensionSettings.js');

test('settings validation works', () => {
  const settings = new ExtensionSettings();
  expect(settings.setCaptureEnabled(true).captureEnabled).toBe(true);
  expect(settings.setCaptureEnabled(false).captureEnabled).toBe(false);
});