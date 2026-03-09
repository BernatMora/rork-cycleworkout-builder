// Minimal mock of react-native for pure-logic unit tests
module.exports = {
  Alert: { alert: () => {} },
  Platform: { OS: 'web' },
};
