const toHaveStyleRule = require('jest-styled-components/src/toHaveStyleRule');
const styleSheetSerializer = require('./styleSheetSerializer');
const { resetStyleSheet } = require('jest-styled-components/src/utils');

global.beforeEach(resetStyleSheet);

expect.addSnapshotSerializer(styleSheetSerializer);
expect.extend({ toHaveStyleRule });

module.exports = {
  styleSheetSerializer,
};
