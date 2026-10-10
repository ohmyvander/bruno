import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';
import themes from 'themes';
import VisualDiff from 'components/Git/VisualDiffViewer/VisualDiffContent/StyledWrapper';
import OpenApiSync from 'components/OpenAPISyncTab/StyledWrapper';
import GrpcResult from 'components/ResponsePane/GrpcResponsePane/GrpcQueryResult/StyledWrapper';
import MethodSelector from 'components/RequestPane/QueryUrl/HttpMethodSelector/StyledWrapper';

test.each(Object.entries(themes))('%s produces legacy-compatible diff and status backgrounds', (name, theme) => {
  const sheet = new ServerStyleSheet();
  try {
    renderToStaticMarkup(sheet.collectStyles(
      <ThemeProvider theme={theme}>
        <VisualDiff /><OpenApiSync /><GrpcResult /><MethodSelector $methodColor="#123456" />
      </ThemeProvider>
    ));
    const styles = sheet.getStyleTags();
    expect(styles).not.toContain('color-mix(');
    expect(styles).toContain('rgba(18,52,86,0.15)');
  } finally {
    sheet.seal();
  }
});
