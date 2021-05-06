const css = require('css');
const { getCSS, getHashes } = require('jest-styled-components/src/utils');
const jscSerializer = require('jest-styled-components/serializer/index');

const KEY = '__jest-styled-components__';

const getNodes = (node, nodes = []) => {
  if (typeof node === 'object') {
    nodes.push(node);
  }

  if (node.children) {
    Array.from(node.children).forEach(child => getNodes(child, nodes));
  }

  return nodes;
};

const markNodes = nodes => nodes.forEach(node => (node[KEY] = true));

const getClassNamesFromDOM = node => Array.from(node.classList);
const getClassNamesFromProps = node => {
  const classNameProp = node.props && (node.props.class || node.props.className);

  if (classNameProp) {
    return classNameProp.trim().split(/\s+/);
  }

  return [];
};

const getClassNames = nodes =>
  nodes.reduce((classNames, node) => {
    let newClassNames = null;

    if (global.Element && node instanceof global.Element) {
      newClassNames = getClassNamesFromDOM(node);
    } else {
      newClassNames = getClassNamesFromProps(node);
    }

    newClassNames.forEach(className => classNames.add(className));

    return classNames;
  }, new Set());

const filterClassNames = (classNames, hashes) => classNames.filter(className => hashes.includes(className));
const filterUnreferencedClassNames = (classNames, hashes) => classNames.filter(className => className.startsWith('sc-') && !hashes.includes(className));

const includesClassNames = (classNames, selectors) =>
  classNames.some(className => selectors.some(selector => selector.includes(className)));

const filterRules = classNames => rule =>
  rule.type === 'rule' && includesClassNames(classNames, rule.selectors) && rule.declarations.length;

const getAtRules = (ast, filter) =>
  ast.stylesheet.rules
    .filter(rule => rule.type === 'media' || rule.type === 'supports')
    .reduce((acc, atRule) => {
      atRule.rules = atRule.rules.filter(filter);

      return acc.concat(atRule);
    }, []);

const getStyle = classNames => {
  const ast = getCSS();
  const filter = filterRules(classNames);
  const rules = ast.stylesheet.rules.filter(filter);
  const atRules = getAtRules(ast, filter);

  ast.stylesheet.rules = rules.concat(atRules);

  return css.stringify(ast);
};

const getClassNamesFromSelectorsByHashes = (classNames, hashes) => {
  const ast = getCSS();
  const filter = filterRules(classNames);
  const rules = ast.stylesheet.rules.filter(filter);

  const selectors = rules.map(rule => rule.selectors);
  const classNamesIncludingFromSelectors = new Set(classNames);
  const addHashFromSelectorListToClassNames = hash =>
    selectors.forEach(selectorList => selectorList[0].includes(hash) && classNamesIncludingFromSelectors.add(hash));

  hashes.forEach(addHashFromSelectorListToClassNames);

  return [...classNamesIncludingFromSelectors];
};

const replaceClassNames = (result, classNames, style) =>
  classNames
    .filter(className => style.includes(className))
    .reduce((acc, className) => acc.replace(new RegExp(className, 'g'), ''), result);

const stripUnreferencedClassNames = (result, classNames) =>
    classNames
      .reduce((acc, className) => acc.replace(new RegExp(`${className}\\s?`,'g'), ''), result);

const replaceHashes = (result, hashes) =>
  hashes.reduce(
    (acc, className) => acc.replace(new RegExp(`((class|className)="[^"]*?)${className}\\s?([^"]*")`, 'g'), '$1$3'),
    result
  );


module.exports = {
  test: jscSerializer.test,
  print(val, print) {
    const nodes = getNodes(val);
    markNodes(nodes);

    const hashes = getHashes();

    let classNames = [...getClassNames(nodes)];
    let unreferencedClassNames = classNames;

    classNames = filterClassNames(classNames, hashes);
    unreferencedClassNames = filterUnreferencedClassNames(unreferencedClassNames, hashes);

    const style = getStyle(classNames);
    const classNamesToReplace = getClassNamesFromSelectorsByHashes(classNames, hashes);
    const code = print(val);

    let result = code;
    result = stripUnreferencedClassNames(result, unreferencedClassNames);
    result = replaceClassNames(result, classNamesToReplace, style);
    result = replaceHashes(result, hashes);
    result = result.replace(/\s+className="\s*"\s+/g, ' ');
    result = result.replace(/\s+class="\s*"\s+/g, ' ');
    result = result.replace(/className="\s+([^\s]+)\s+"/, 'className="$1"');

    return result;
  },
};