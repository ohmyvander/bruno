describe('main-process constants', () => {
  test('can be loaded from CommonJS main-process modules', () => {
    const { REQUEST_TYPES } = require('../../src/utils/constants');

    expect(REQUEST_TYPES).toEqual(['http-request', 'graphql-request', 'grpc-request', 'ws-request']);
  });
});
