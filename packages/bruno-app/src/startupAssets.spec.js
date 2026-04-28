import { injectDiff2HtmlAssets } from './startupAssets';

describe('startup assets', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('loads static diff2html assets with the packaged file names', () => {
    const cleanup = injectDiff2HtmlAssets();

    expect(document.head.querySelector('link[rel="stylesheet"]').getAttribute('href')).toBe(
      'static/diff2Html.min.css'
    );
    expect(document.body.querySelector('script[type="text/javascript"]').getAttribute('src')).toBe(
      'static/diff2Html.js'
    );

    cleanup();

    expect(document.head.querySelector('link[rel="stylesheet"]')).toBeNull();
    expect(document.body.querySelector('script[type="text/javascript"]')).toBeNull();
  });
});
