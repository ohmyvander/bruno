import React from 'react';
import { render } from '@testing-library/react';
import SwaggerUI from 'swagger-ui-react';
import Swagger from './index';

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(() => null), {
    config: {
      defaults: Object.freeze({
        validatorUrl: 'https://validator.swagger.io/validator'
      })
    }
  })
}));

jest.mock('./StyledWrapper', () => ({ children }) => <div>{children}</div>);

describe('Swagger renderer', () => {
  it('disables the remote validator to support packaged file URLs', () => {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'Smoke test',
        version: '1.0.0'
      },
      paths: {}
    };

    render(<Swagger spec={spec} />);

    expect(SwaggerUI.config.defaults.validatorUrl).toBe('none');
    expect(SwaggerUI).toHaveBeenCalledWith(
      expect.objectContaining({
        spec
      }),
      undefined
    );
  });
});
