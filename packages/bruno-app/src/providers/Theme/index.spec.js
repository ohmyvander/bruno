import { validateThemeAgainstSchema } from './index';

describe('theme validation', () => {
  it('uses an absolute schema base for packaged file URLs', () => {
    const selectedTheme = { mode: 'light' };
    const schema = { type: 'object' };
    const schemaValidator = {
      validate: jest.fn(() => ({ valid: true }))
    };

    validateThemeAgainstSchema(selectedTheme, schema, schemaValidator);

    expect(schemaValidator.validate).toHaveBeenCalledWith(selectedTheme, schema, { base: 'bruno://theme/' });
  });
});
