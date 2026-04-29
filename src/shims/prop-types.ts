/**
 * CJS `prop-types` → ESM default export (`import PropTypes from 'prop-types'`).
 * Resolves `prop-types/index.js` only; alias uses `/^prop-types$/` so subpaths are unchanged.
 */
import * as propTypesNamespace from 'prop-types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PropTypes = (propTypesNamespace as { default?: any }).default ?? propTypesNamespace;

export default PropTypes;
