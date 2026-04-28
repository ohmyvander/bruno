const allowedExternalProtocols = new Set(['http:', 'https:']);

const getUrl = (url) => {
  try {
    return new URL(url);
  } catch (err) {
    return null;
  }
};

const isAllowedExternalUrl = (url) => {
  const parsedUrl = getUrl(url);
  return Boolean(parsedUrl && allowedExternalProtocols.has(parsedUrl.protocol));
};

const openExternalUrl = async (shell, url) => {
  if (!isAllowedExternalUrl(url)) {
    throw new Error(`Blocked external URL: ${url}`);
  }

  return shell.openExternal(url);
};

module.exports = {
  isAllowedExternalUrl,
  openExternalUrl
};
