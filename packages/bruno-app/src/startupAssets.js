export const DIFF2HTML_CSS_PATH = 'static/diff2Html.min.css';
export const DIFF2HTML_SCRIPT_PATH = 'static/diff2Html.js';

export const injectDiff2HtmlAssets = () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = DIFF2HTML_CSS_PATH;
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = DIFF2HTML_SCRIPT_PATH;
  script.async = true;
  document.body.appendChild(script);

  return () => {
    document.head.removeChild(link);
    document.body.removeChild(script);
  };
};
