import React from 'react';
import SwaggerUI from 'swagger-ui-react';
import StyledWrapper from './StyledWrapper';

if (SwaggerUI.config?.defaults) {
  SwaggerUI.config.defaults = {
    ...SwaggerUI.config.defaults,
    validatorUrl: 'none'
  };
}

const Swagger = ({ spec }) => {
  return (
    <StyledWrapper>
      <div className="swagger-root w-full">
        <SwaggerUI spec={spec} />
      </div>
    </StyledWrapper>
  );
};

export default Swagger;
