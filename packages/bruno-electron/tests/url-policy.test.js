const { isAllowedExternalUrl } = require('../src/security/url-policy');

describe('external URL policy', () => {
  test('allows only http and https URLs', () => {
    expect(isAllowedExternalUrl('https://usebruno.com')).toBe(true);
    expect(isAllowedExternalUrl('http://localhost:3000')).toBe(true);
    expect(isAllowedExternalUrl('file:///C:/Windows/System32/calc.exe')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('bruno://callback?code=123')).toBe(false);
    expect(isAllowedExternalUrl('not a url')).toBe(false);
  });
});
