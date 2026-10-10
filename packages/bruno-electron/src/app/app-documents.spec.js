jest.mock('electron', () => ({
  protocol: { registerSchemesAsPrivileged: jest.fn() },
  session: { fromPartition: jest.fn() }
}));

const { protocol, session } = require('electron');
const AppDocuments = require('./app-documents');
require('../compat/node').installNodeCompat();

test('registers a secure, standard scheme without sharing guest origins', () => {
  AppDocuments.registerScheme();
  expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([{
    scheme: 'bruno-app', privileges: { standard: true, secure: true, supportFetchAPI: true }
  }]);
});

describe.each(['modern', 'legacy'])('%s guest protocol', (backend) => {
  let documents;
  let request;

  beforeEach(() => {
    documents = new AppDocuments();
    const guestProtocol = backend === 'modern'
      ? { handle: jest.fn() } : { registerStreamProtocol: jest.fn() };
    session.fromPartition.mockReturnValue({ protocol: guestProtocol });
    documents.handleProtocol();
    expect(session.fromPartition).toHaveBeenCalledWith(AppDocuments.APP_PARTITION);
    const handler = (guestProtocol.handle || guestProtocol.registerStreamProtocol).mock.calls[0][1];
    request = async (url) => {
      if (backend === 'modern') {
        const response = handler({ url });
        return { status: response.status, html: await response.text(), cache: response.headers.get('Cache-Control') };
      }
      const response = await new Promise((resolve) => handler({ url }, resolve));
      let html = '';
      for await (const chunk of response.data) {
        expect(Buffer.isBuffer(chunk)).toBe(true);
        html += chunk.toString('utf8');
      }
      return { status: response.statusCode, html, cache: response.headers['Cache-Control'] };
    };
  });

  test('serves HTML without cache and keeps per-owner origins stable across edits', async () => {
    const first = documents.register('first', '<p>one</p>');
    const second = documents.register('second', '<p>two</p>');
    expect(new URL(first).hostname).not.toBe(new URL(second).hostname);
    expect(await request(first)).toEqual({ status: 200, html: '<p>one</p>', cache: 'no-store' });
    expect(documents.register('first', '<p>one</p>')).toBe(first);
    const updated = documents.register('first', '<p>updated</p>');
    expect(new URL(updated).hostname).toBe(new URL(first).hostname);
    expect(updated).not.toBe(first);
    expect((await request(first)).html).toBe('<p>updated</p>');
    expect((await request(second)).html).toBe('<p>two</p>');
  });

  test('returns 404 for unknown or unregistered guests', async () => {
    expect((await request('bruno-app://unknown/')).status).toBe(404);
    const url = documents.register('first', '<p>one</p>');
    documents.unregister('first');
    expect((await request(url)).status).toBe(404);
  });
});
