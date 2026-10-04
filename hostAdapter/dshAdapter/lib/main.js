import { createRequire as __femoCreateRequire } from 'node:module'; const require = __femoCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name2 = parts.shift();
        switch (name2) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name2}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name2 = `${prefix}${i}`;
        if (!exclude.has(name2))
          return name2;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name2 = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name2} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge2 = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge2.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge2.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge2.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge2;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge2 = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge2.isMergeKey(ctx, key))
        merge2.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set3 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set3.items.push(Pair.createPair(value, null, ctx));
          }
        return set3;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set2 = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set2;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date2 = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date2 -= 6e4 * d;
        }
        return new Date(date2);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set2 = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge2.merge,
      omap.omap,
      pairs.pairs,
      set2.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set2 = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge2.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set2.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge2.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set2.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge2.merge) ? schemaTags.concat(merge2.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge2.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema2 = class _Schema {
      constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge2);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema2;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema2 = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name2) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name2 || prev.has(name2) ? anchors.findNewAnchor(name2 || "a", prev) : name2;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema2.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name2, pos, code, message) {
        super();
        this.name = name2;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name2 = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse2;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema2 = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema2.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// host/compat/dsh-session-host.ts
var dsh_session_host_exports = {};
__export(dsh_session_host_exports, {
  SessionId: () => SessionId,
  registerSessionEventType: () => registerSessionEventType
});
import { createRequire } from "node:module";
function loadSessionNamespace() {
  const candidates = [];
  if (process.argv[1] !== void 0 && process.argv[1].length > 0) {
    candidates.push(() => createRequire(process.argv[1])("@deepseek-ai/dsh-session"));
  }
  candidates.push(() => createRequire(import.meta.url)("@deepseek-ai/dsh-session"));
  for (const load of candidates) {
    try {
      return load();
    } catch {
    }
  }
  console.warn("[femo-plugin][dsh-session-bridge] host dsh-session unresolvable; degrading to inert stub");
  return new Proxy({}, { get: () => void 0 });
}
var sessionNS = loadSessionNamespace();
var SessionId = sessionNS.SessionId;
var registerSessionEventType = sessionNS.registerSessionEventType;

// host/config.ts
import { fileURLToPath } from "node:url";
import { join as join2 } from "node:path";

// ../../femo2host/femoRoot.mjs
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
function resolveFemoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "femo2host"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}
function dataRootOf(femoRoot2) {
  return process.env.FEMO_DATA_DIR || join(femoRoot2, "user_data");
}

// node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.3/node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  if (a === b) return true;
  if (!strict && isNullable(a) && isNullable(b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (!a || !b) return false;
  function check(test, then) {
    return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
  }
  return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
    if (a2.byteLength !== b2.byteLength) return false;
    const viewA = new Uint8Array(a2);
    const viewB = new Uint8Array(b2);
    for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
    return true;
  }) ?? Object.keys({
    ...a,
    ...b
  }).every((key) => deepEqual(a[key], b[key], strict));
}
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// node_modules/.pnpm/@deepseek-ai+schemastery@3.18.2/node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = Symbol.for("schemastery");
var kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
var resolvers = {};
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name2, keys, format) {
  formatters[name2] = format;
  Object.assign(Schema, { [name2](...args) {
    const schema = new Schema({ type: name2 });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name2 === "object" || name2 === "dict") schema.meta.default = {};
    else if (name2 === "array" || name2 === "tuple") schema.meta.default = [];
    else if (name2 === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// host/config.ts
var packageRoot = fileURLToPath(new URL("..", import.meta.url));
var engineRoot = resolveFemoRoot(fileURLToPath(new URL("..", import.meta.url)));
var hostManifestFile = join2(packageRoot, "host.manifest.json");
var portArg = (() => {
  const i = process.argv.indexOf("--port");
  const v = i >= 0 ? process.argv[i + 1] : void 0;
  return v !== void 0 && /^\d+$/.test(v) ? v : "";
})();
var instanceHostId = portArg !== "" ? `dsh-${portArg}` : "dsh";
if (portArg !== "") {
  process.env.FEMO_HOST_NAME = instanceHostId;
}
var Config = Schema.object({
  /** Master switch. */
  enabled: Schema.boolean().default(true),
  /** Femo 引擎根目录（femoCompiler/femoBridges 所在；宿主边界层（门面 API + CLI 工具）在 femo2host/，示例FEMO脚本与 @func 伴生模块在 femoExamples/）。缺省 = 插件包根（自包含）。 */
  femoRoot: Schema.string().default(""),
  /** Python executable used to launch the bridge. */
  python: Schema.string().default("python"),
  /** Provider/model/URL for the engine's AI nodes (llmBridge args). */
  provider: Schema.string().default("deepseek"),
  model: Schema.string().default("deepseek-v4-flash"),
  apiUrl: Schema.string().default("https://api.deepseek.com/v1/chat/completions"),
  /** Credential reference (env name) for the engine's LLM key. */
  apiKeyRef: Schema.string().default("DEEPSEEK_API_KEY"),
  /** M5: dsh LLM provider route for subagents (dsh adapter name). */
  dshProvider: Schema.string().default("deepseek-official"),
  /** M5: route every AI node through a host subagent (native tool calls + cot).
   *  注意：不给 schema default——缺省语义由 resolveConfig 的回落链表达
   *  （hostAiBackend ?? dshAiBackend ?? true），否则管线注入的 true 会
   *  遮蔽旧键的显式 false。 */
  hostAiBackend: Schema.boolean(),
  /** @deprecated 旧配置键（引擎协议字段已更名 host_ai_backend）。仅在
   *  hostAiBackend 未显式设置时作为回落读取，后续版本移除。 */
  dshAiBackend: Schema.boolean().default(true),
  /**
   * Per-Actor tool access default. The FEMO脚本 author decides per actor with
   * `tools: true/false` (or `tools: [name, ...]` as a whitelist); an actor
   * that declares nothing falls back to this global default. Default TRUE —
   * the plugin also runs coding workflows, so工具能力 must not vanish
   * unless a script opts out.
   */
  defaultActorTools: Schema.boolean().default(true),
  /**
   * Global附加 tool whitelist applied on top of the actor's own access
   * (empty = no extra restriction). Actor whitelists (tools: [..]) win over
   * this for the actor that declares them.
   */
  toolWhitelist: Schema.array(Schema.string()).default([]),
  /** Subagent provider name (spawn = fresh child, zero parent context). */
  subagentProvider: Schema.string().default("spawn"),
  /**
   * Subagent IDLE timeout: a child that keeps producing events (reasoning
   * chunks, tool calls, streamed text) is alive no matter how long it runs —
   * multi-turn tool workflows can legitimately take tens of minutes, so there
   * is NO total-duration cap. Only a child that goes silent for this long is
   * presumed hung and aborted.
   */
  subagentIdleTimeoutMs: Schema.number().default(12e4),
  /**
   * 子 agent 推理等级（'off'|'low'|'high'|'max'）。缺省跟随主会话请求头的
   * 生效档位（跟随主模型 = 连推理档位一起跟随）。显式设置可覆盖——针对
   * 强制思考的模型（如 glm-5.3-flash：不带 low/high/max 直接 400 1210），
   * 子代理请求必须点名一个合法档位。schema 此前漏声明此字段（ResolvedConfig
   * 有消费无入口，2026-08-29 补上）。
   *
   * 注意：这里不是 zod——`z` 实为 @deepseek-ai/schemastery 的 Schema，
   * 没有 .optional() 方法（不加 .required() 就默认可选）。写成
   * z.string().optional() 会在模块加载时 TypeError，炸掉整个插件树
   * （2026-08-29 踩过：3081 启动即崩）。
   */
  subagentReasoning: Schema.string()
});
function resolveConfig(config) {
  const c = config ?? {};
  return {
    enabled: c.enabled ?? true,
    femoRoot: c.femoRoot && c.femoRoot.length > 0 ? c.femoRoot : engineRoot,
    hostManifest: hostManifestFile,
    python: c.python ?? "python",
    provider: c.provider ?? "deepseek",
    model: c.model ?? "deepseek-v4-flash",
    apiUrl: c.apiUrl ?? "https://api.deepseek.com/v1/chat/completions",
    apiKeyRef: c.apiKeyRef ?? "DEEPSEEK_API_KEY",
    dshProvider: c.dshProvider ?? "deepseek-official",
    // 旧键 dshAiBackend 回落：老配置只写了旧名时依旧生效（显式设置新名则新名赢）。
    hostAiBackend: c.hostAiBackend ?? c.dshAiBackend ?? true,
    toolWhitelist: c.toolWhitelist ?? [],
    defaultActorTools: c.defaultActorTools ?? true,
    subagentProvider: c.subagentProvider ?? "spawn",
    subagentIdleTimeoutMs: c.subagentIdleTimeoutMs ?? 12e4,
    ...c.subagentReasoning === void 0 ? {} : { subagentReasoning: c.subagentReasoning }
  };
}

// host/index.ts
import { join as join18 } from "node:path";

// host/bridge.ts
import { readFileSync as readFileSync3 } from "node:fs";

// ../../femo2host/femoGenConnector/sse-core.mjs
var RING_CAP = 400;
var EPHEMERAL = /* @__PURE__ */ new Set(["femo_stream", "ai_token", "step"]);
var defaultCodec = {
  encode(type, data, replay) {
    return `data: ${JSON.stringify(replay ? { type, data: data ?? {}, replay: true } : { type, data: data ?? {} })}

`;
  }
};
function createSseChannel({ cap = RING_CAP, codec = defaultCodec, heartbeatMs = 15e3, log = () => {
} } = {}) {
  const ring2 = [];
  const clients = /* @__PURE__ */ new Set();
  function remember(eventType, data) {
    if (EPHEMERAL.has(eventType)) return;
    if (eventType === "checkpoint") {
      const idx = ring2.findIndex((e) => e.type === "checkpoint");
      if (idx >= 0) {
        ring2[idx] = { type: eventType, data };
        return;
      }
    }
    ring2.push({ type: eventType, data });
    if (ring2.length > cap) ring2.shift();
  }
  function writeRaw(frame) {
    for (const res of clients) {
      try {
        res.write(frame);
      } catch {
        clients.delete(res);
      }
    }
  }
  function broadcast(eventType, data) {
    remember(eventType, data);
    writeRaw(codec.encode(eventType, data, false));
  }
  function pushLive(eventType, data) {
    writeRaw(codec.encode(eventType, data, false));
  }
  function connect(res) {
    for (const ev of ring2) {
      try {
        res.write(codec.encode(ev.type, ev.data, true));
      } catch {
        clients.delete(res);
        break;
      }
    }
    clients.add(res);
    const hb = setInterval(() => {
      try {
        res.write(`: heartbeat

`);
      } catch {
        clearInterval(hb);
        clients.delete(res);
      }
    }, heartbeatMs);
    const cleanup = () => {
      clearInterval(hb);
      clients.delete(res);
    };
    res.on?.("close", cleanup);
    return cleanup;
  }
  function clientCount() {
    return clients.size;
  }
  function ringSize() {
    return ring2.length;
  }
  return { remember, broadcast, pushLive, connect, clientCount, ringSize };
}

// ../../femo2host/host/variable-api.mjs
var VARIABLE_EVENTS = /* @__PURE__ */ new Set(["checkpoint", "func_result", "assign_result"]);
function createVariableApi({ log = () => {
} } = {}) {
  const listeners = /* @__PURE__ */ new Set();
  function handles(eventType) {
    return VARIABLE_EVENTS.has(eventType);
  }
  function ingest(eventType, data) {
    if (!handles(eventType)) return null;
    const d = data ?? {};
    const record = {
      kind: eventType,
      jobId: typeof d.job_id === "number" ? d.job_id : void 0,
      node: typeof d.node_name === "string" ? d.node_name : void 0
    };
    if (eventType === "checkpoint") {
      record.checkpoints = d.checkpoints ?? {};
      record.state = d.state;
    } else {
      record.output = d.output;
      record.input = d.input;
    }
    for (const l of [...listeners]) {
      try {
        l.fn(toView(record, l.view));
      } catch (e) {
        log(`[variable-api] subscriber failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    return record;
  }
  function toView(record, view = "brief") {
    if (view === "full") return record;
    const r = { ...record };
    delete r.state;
    delete r.input;
    return r;
  }
  function subscribe(view, fn) {
    const l = { view: view === "full" ? "full" : "brief", fn };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }
  return { handles, ingest, toView, subscribe };
}

// host/sse.ts
var sseChannel = createSseChannel();
var variableApi = createVariableApi({ log: (m) => console.log(`[femo-plugin] ${m}`) });

// host/http.ts
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
function writeJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
function broadcastSse(eventType, data) {
  sseChannel.pushLive(eventType, data);
}

// host/diag/debug-log.ts
import { appendFileSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname as dirname2, join as join3 } from "node:path";
var KEEP_DAYS = 1;
var ROTATE_BYTES = 5 * 1024 * 1024;
var NL = String.fromCharCode(10);
function debugLogPath(femoRoot2, name2) {
  return join3(femoRoot2, "cache", "logs", name2);
}
function appendDebugLog(femoRoot2, name2, line) {
  try {
    const file = debugLogPath(femoRoot2, name2);
    const gen1 = file + ".1";
    mkdirSync(dirname2(file), { recursive: true });
    const now = Date.now();
    try {
      if (statSync(file).mtimeMs < now - KEEP_DAYS * 864e5) unlinkSync(file);
    } catch {
    }
    try {
      if (statSync(gen1).mtimeMs < now - KEEP_DAYS * 864e5) unlinkSync(gen1);
    } catch {
    }
    try {
      if (statSync(file).size > ROTATE_BYTES) {
        try {
          unlinkSync(gen1);
        } catch {
        }
        renameSync(file, gen1);
      }
    } catch {
    }
    appendFileSync(file, line.endsWith(NL) ? line : line + NL, "utf8");
  } catch {
  }
}

// host/diag/diag-feed.ts
var CAP = 800;
var ring = [];
var femoRoot;
function initDiagFeed(root) {
  femoRoot = root;
}
function pushDiag(tag, msg) {
  const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tag, msg };
  ring.push(entry);
  if (ring.length > CAP) ring.shift();
  try {
    broadcastSse("femo_diag", entry);
  } catch {
  }
  if (femoRoot !== void 0) {
    appendDebugLog(femoRoot, "debug-diag-feed.log", `[${entry.ts}] [${tag}] ${msg}`);
  }
}
function diagTail(n) {
  const count = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), CAP) : 300;
  return ring.slice(-count);
}

// ../../femo2host/host/daemon-client.mjs
import { spawn } from "node:child_process";
import { closeSync, existsSync as existsSync2, mkdirSync as mkdirSync2, openSync, readFileSync as readFileSync2, unlinkSync as unlinkSync2, writeSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { dirname as dirname4, join as join5 } from "node:path";

// ../../femo2host/host/hub-client.mjs
import { readFileSync, statSync as statSync2 } from "node:fs";
import { dirname as dirname3, join as join4 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var _defaultRoot;
function defaultFemoRoot() {
  if (process.env.FEMO_ROOT) return process.env.FEMO_ROOT.replace(/[\\/]+$/, "");
  _defaultRoot ??= resolveFemoRoot(dirname3(fileURLToPath2(import.meta.url)));
  return _defaultRoot;
}
function hubJsonPath(femoRoot2) {
  const root = femoRoot2 ?? defaultFemoRoot();
  if (process.env.FEMO_DATA_DIR) return join4(process.env.FEMO_DATA_DIR, "femo", "projection", "hub.json");
  return join4(root, "user_data", "projection", "hub.json");
}
var _cache = { path: "", mtimeMs: -1, size: -1, info: void 0 };
function readHubInfo(femoRoot2) {
  const path = hubJsonPath(femoRoot2);
  try {
    const st = statSync2(path);
    if (_cache.path === path && _cache.mtimeMs === st.mtimeMs && _cache.size === st.size) return _cache.info;
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const port = Number(raw?.port);
    const info = Number.isFinite(port) && port > 0 ? { port, host: typeof raw.host === "string" ? raw.host : void 0 } : void 0;
    _cache = { path, mtimeMs: st.mtimeMs, size: st.size, info };
    return info;
  } catch {
    if (_cache.path === path) _cache = { path: "", mtimeMs: -1, size: -1, info: void 0 };
    return void 0;
  }
}
function resolveHubPort(femoRoot2) {
  const fromFile = readHubInfo(femoRoot2);
  if (fromFile) return fromFile.port;
  const env = String(process.env.FEMO_PROJECTION_PORT ?? "");
  if (/^\d+$/.test(env)) return Number(env);
  return 8790;
}
function hubBaseUrl(femoRoot2) {
  return `http://127.0.0.1:${resolveHubPort(femoRoot2)}`;
}

// ../../femo2host/host/daemon-client.mjs
var HTTP_TIMEOUT_SEC = 120;
var DISCOVER_DEADLINE_SEC = 60;
var SPAWN_LOCK_TTL_MS = 3e4;
var DOORBELL_PERIOD_MS = 1e4;
var DAEMON_LOG_REL = join5("logs", "femo_daemon.log");
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function httpJson(base, pathAndQuery, { method = "GET", body, timeoutSec = 5 } = {}) {
  return new Promise((resolve2, reject) => {
    const { hostname, port, pathname, search } = new URL(base + pathAndQuery);
    const payload = body === void 0 || typeof body === "string" ? body : JSON.stringify(body);
    const r = httpRequest({
      hostname,
      port,
      path: pathname + search,
      method,
      agent: false,
      headers: payload !== void 0 ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {},
      timeout: timeoutSec * 1e3
    }, (resp) => {
      let buf = "";
      resp.on("data", (c) => {
        buf += c;
      });
      resp.on("end", () => {
        let out = null;
        try {
          out = JSON.parse(buf);
        } catch {
        }
        resolve2({ status: resp.statusCode, body: out, raw: buf });
      });
    });
    r.on("timeout", () => {
      r.destroy(new Error(`timeout ${timeoutSec}s: ${pathAndQuery}`));
    });
    r.on("error", reject);
    if (payload !== void 0) r.write(payload);
    r.end();
  });
}
async function probeDaemon(femoRoot2, { quiet404 = false, timeoutSec = 3 } = {}) {
  const addrPath = hubJsonPath(femoRoot2);
  if (!existsSync2(addrPath)) return null;
  let addr;
  try {
    addr = JSON.parse(readFileSync2(addrPath, "utf8"));
  } catch {
    return null;
  }
  const port = Number(addr?.port);
  if (!Number.isFinite(port) || port <= 0) return null;
  const base = `http://127.0.0.1:${port}`;
  let health;
  try {
    health = await httpJson(base, "/health", { timeoutSec });
  } catch {
    return null;
  }
  if (health.status !== 200 || health.body?.ok !== true) return null;
  const want = dirname4(addrPath);
  const got = String(health.body?.data || "");
  if (got && want !== got) return null;
  let eng;
  try {
    eng = await httpJson(base, "/engine/health", { timeoutSec });
  } catch {
    return null;
  }
  if (eng.status === 404) {
    if (quiet404) return null;
    throw new Error("\u5E38\u9A7B\u5F15\u64CE\u7F3A\u5F15\u64CE\u9762\uFF08\u65E7\u7248 v0 daemon\uFF0CHTTP 404\uFF09\u2014\u2014\u8FD0\u7EF4\uFF1A\u6740\u65E7 femo_daemon\uFF08hub.json pid=" + (addr.pid ?? "?") + "\uFF09\uFF0C\u4E0B\u4E00\u5EA7\u5BA2\u6237\u7AEF\u4EE3\u62C9\u65B0\u7248\u3002");
  }
  if (eng.status !== 200 || eng.body?.engine !== true) return null;
  return { base, pid: Number(addr.pid) || 0, health: eng.body };
}
var DaemonClient = class {
  constructor(opts = {}) {
    if (!opts.femoRoot) throw new Error("DaemonClient: femoRoot is required");
    if (!opts.host) throw new Error("DaemonClient: host is required");
    this.femoRoot = opts.femoRoot;
    this.host = String(opts.host);
    this.hostName = String(opts.hostName || opts.host);
    this.hostManifestPath = opts.hostManifestPath || "";
    this.dataDir = opts.dataDir || "";
    this.pushUrl = opts.pushUrl || "";
    this.pythonPath = opts.python ?? process.env.FEMO_PYTHON ?? "python";
    this.onEvent = opts.onEvent;
    this.onEngineLine = opts.onEngineLine;
    this.onEngineStderr = opts.onEngineStderr;
    this.log = opts.log ?? (() => {
    });
    this.onExited = void 0;
    this.projectionDir = dirname4(hubJsonPath(this.femoRoot));
    this.daemonPy = join5(this.femoRoot, "femo2host", "python", "femo_daemon.py");
    this._ready = null;
    this._readyLock = Promise.resolve();
    this._base = "";
    this._pid = 0;
    this._sseAbort = void 0;
    this._doorbellAbort = void 0;
    this._stopped = false;
    this._idSeq = 0;
  }
  get alive() {
    return this._ready !== null && this._base !== "";
  }
  /** 当前引擎地址（诊断用）。 */
  get base() {
    return this._base;
  }
  // ── 发现 / 代拉 / 就绪 ────────────────────────────────────────────────
  /** 探活双验（数据根指纹 + 引擎面）。返回 {base,pid} 或 null（死/无）；
   *  旧版 v0 daemon 抛错（响亮，绝不裸奔）。正身=模块级 probeDaemon
   *  （2026-09-29 收编导出，zcode 钩子同吃一份）。 */
  async _probe() {
    return probeDaemon(this.femoRoot);
  }
  /** 代拉 femo_daemon.py（脱离母进程；镜像 Python 侧 _spawn_daemon 的全部落点）。 */
  _spawnDaemon() {
    if (!existsSync2(this.daemonPy)) {
      throw new Error(`femo_daemon.py \u4E0D\u5B58\u5728\uFF1A${this.daemonPy}\uFF08\u5F15\u64CE\u6839\u6307\u9519\u6216\u5B89\u88C5\u7F3A\u4EF6\uFF09`);
    }
    mkdirSync2(join5(this.projectionDir, "logs"), { recursive: true });
    const logPath = join5(this.projectionDir, DAEMON_LOG_REL);
    const logf = openSync(logPath, "a");
    const env = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONUNBUFFERED: "1", FEMO_ROOT: this.femoRoot };
    const argv = [this.daemonPy, "--data-dir", this.projectionDir];
    if (this.dataDir) {
      const db = join5(this.dataDir, "femo", "memory", "Chronica.wor");
      env.FEMO_DB_PATH = db;
      argv.push("--db", db);
    }
    const child = spawn(
      this.pythonPath,
      argv,
      { cwd: this.femoRoot, env, detached: true, windowsHide: true, stdio: ["ignore", logf, logf] }
    );
    child.unref();
    this.log(`daemon spawned (pid=${child.pid}) log=${logPath}`);
  }
  /** 跨进程代拉意图锁（2026-09-28 镜窗成群事故）：hub.json 死账谁探到谁就想
   *  代拉，多客户端同刻齐醒就是一波孪生 daemon。锁文件 O_EXCL 建锁（驿站信柜
   *  同款跨进程原语），同数据根同一时刻只许一家代拉——没抢到的只探账不抢生
   *  （引擎侧另有收口闸 femo_daemon._claim_ledger 兜底，这里是少生浪费进程）。 */
  _spawnLockPath() {
    return join5(this.projectionDir, "daemon-spawn.lock");
  }
  /** 试拿代拉锁：建锁成功=拿到；已存在则看持锁者——活着且未超时不抢，
   *  已死（pid 探不到）或超时（30s，防 pid 复用假活）删锁接管。 */
  _acquireSpawnLock() {
    const lockPath = this._spawnLockPath();
    mkdirSync2(this.projectionDir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = openSync(lockPath, "wx");
        try {
          writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }));
        } finally {
          closeSync(fd);
        }
        return true;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      let holder = null;
      try {
        holder = JSON.parse(readFileSync2(lockPath, "utf8"));
      } catch {
        holder = null;
      }
      let holderAlive = false;
      if (Number(holder?.pid) > 0) {
        try {
          process.kill(Number(holder.pid), 0);
          holderAlive = true;
        } catch {
          holderAlive = false;
        }
      }
      const fresh = Date.now() - Number(holder?.ts || 0) < SPAWN_LOCK_TTL_MS;
      if (holderAlive && fresh) return false;
      try {
        unlinkSync2(lockPath);
      } catch {
      }
    }
    return false;
  }
  /** 放锁——只删自己名下的（被接管者覆写过的锁不动它）。 */
  _releaseSpawnLock() {
    try {
      const holder = JSON.parse(readFileSync2(this._spawnLockPath(), "utf8"));
      if (Number(holder?.pid) === process.pid) unlinkSync2(this._spawnLockPath());
    } catch {
    }
  }
  /** ensure 全链：发现 → 死/无则代拉循环（60s）→ 就绪后补登记/开播/开门铃。
   *  代拉节奏镜像 Python 侧 connect：spawn 一发后先探 ~12s 再下一发——daemon
   *  冷启（hub+引擎装配）要几秒才写账，1s 一发会养出竞态孪生。 */
  _ensure() {
    const run = async () => {
      const t0 = Date.now();
      let hit = null;
      let lastErr = "";
      const probeOnce = async () => {
        try {
          hit = await this._probe();
        } catch (e) {
          this.log(`daemon probe fatal: ${String(e.message ?? e)}`);
          throw e;
        }
        return hit !== null;
      };
      while (!hit && Date.now() - t0 < DISCOVER_DEADLINE_SEC * 1e3) {
        if (await probeOnce()) break;
        if (!this._acquireSpawnLock()) {
          await sleep(2e3);
          continue;
        }
        try {
          try {
            this._spawnDaemon();
          } catch (e) {
            lastErr = String(e.message ?? e);
            this.log(`daemon spawn failed: ${lastErr}`);
          }
          for (let i = 0; i < 12 && !hit; i++) {
            await sleep(1e3);
            if (Date.now() - t0 >= DISCOVER_DEADLINE_SEC * 1e3) break;
            await probeOnce();
          }
        } finally {
          this._releaseSpawnLock();
        }
      }
      if (!hit) throw new Error(`\u5E38\u9A7B\u5F15\u64CE\u4EE3\u62C9\u5931\u8D25\uFF08${DISCOVER_DEADLINE_SEC}s \u5185\u672A\u5C31\u7EEA\uFF09${lastErr ? "\uFF1A" + lastErr : ""}`);
      this._base = hit.base;
      this._pid = hit.pid;
      this.log(`daemon discovered: ${this._base} (pid=${this._pid})`);
      await this._registerHost();
      this._startSse();
      this._startDoorbell();
      return hit;
    };
    const p = this._readyLock.then(run, run);
    this._readyLock = p.catch(() => {
    });
    return p;
  }
  /** hub 宿主登记（转发壳 HubClient.connect(register_name) 的直连版；best-effort——
   *  信任集由喂方登记兜底，花名册少一行不挡运行）。登记体捎带清单申报的能力
   *  （god_window 等，投影中心据申报决定给不给这家出上帝视角条目）：清单读
   *  不到/没申报的字段就不带——hub 对缺省字段一律按「有」办，老宿主零回归。 */
  _manifestCaps() {
    if (!this.hostManifestPath || !existsSync2(this.hostManifestPath)) return {};
    try {
      const m = JSON.parse(readFileSync2(this.hostManifestPath, "utf8"));
      const caps = {};
      if (typeof m.god_window === "boolean") caps.god_window = m.god_window;
      return caps;
    } catch {
      return {};
    }
  }
  async _registerHost() {
    try {
      await httpJson(
        this._base,
        "/hub-register",
        { method: "POST", body: { kind: "host", name: this.hostName, ...this._manifestCaps() }, timeoutSec: 5 }
      );
    } catch (e) {
      this.log(`hub-register failed (best-effort): ${String(e.message ?? e).slice(0, 160)}`);
    }
  }
  /** 惰性重发现（引擎死后恢复）：清 ready 状态重跑 ensure；返回新址。 */
  async _rediscover() {
    this._ready = null;
    this._base = "";
    this._pid = 0;
    return this._ensure();
  }
  // ── SSE 事件直播（live-only）──────────────────────────────────────────
  _startSse() {
    if (this._sseAbort) this._sseAbort.stop = true;
    const stopFlag = { stop: false };
    this._sseAbort = stopFlag;
    void (async () => {
      while (!stopFlag.stop) {
        const pidBefore = this._pid;
        try {
          await this._sseOnce(stopFlag);
        } catch (e) {
          if (stopFlag.stop) return;
          this.log(`sse down: ${String(e.message ?? e).slice(0, 160)} \u2014 rediscover in 1s`);
        }
        if (stopFlag.stop) return;
        try {
          const hit = await this._rediscover();
          if (pidBefore && hit.pid && hit.pid !== pidBefore && this.onExited) {
            this.onExited({ code: null, signal: null });
          }
        } catch (e) {
          this.log(`rediscover failed: ${String(e.message ?? e).slice(0, 160)}`);
        }
        await sleep(1e3);
      }
    })();
  }
  _sseOnce(stopFlag) {
    return new Promise((resolve2, reject) => {
      const { hostname, port } = new URL(this._base);
      const path = "/engine/events?host=" + encodeURIComponent(this.host) + "&since=1000000000";
      const r = httpRequest({ hostname, port, path, timeout: 6e4, agent: false }, (resp) => {
        this.log(`sse connected status=${resp.statusCode}`);
        if (resp.statusCode !== 200) {
          reject(new Error(`sse HTTP ${resp.statusCode}`));
          resp.resume();
          return;
        }
        let buf = "";
        resp.on("data", (chunk) => {
          buf += chunk.toString("utf8");
          let idx;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            let env;
            try {
              env = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            if (env.replay) continue;
            if (env.type === "event") this.onEvent?.(String(env.event ?? ""), env.data);
          }
        });
        resp.on("end", () => resolve2());
        resp.on("error", reject);
      });
      r.on("timeout", () => r.destroy(new Error("sse idle timeout")));
      r.on("error", reject);
      r.end();
      const timer = setInterval(() => {
        if (stopFlag.stop) {
          try {
            r.destroy();
          } catch {
          }
          clearInterval(timer);
        }
      }, 200);
      r.on("close", () => clearInterval(timer));
    });
  }
  // ── 门铃心跳（全员报到：推送户带门牌可上门，自取户空门牌只报在线）──────
  _startDoorbell() {
    if (this._doorbellAbort) this._doorbellAbort.stop = true;
    const stopFlag = { stop: false };
    this._doorbellAbort = stopFlag;
    void (async () => {
      while (!stopFlag.stop) {
        try {
          await httpJson(
            this._base,
            "/engine/doorbell",
            { method: "POST", body: { host: this.host, url: this.pushUrl }, timeoutSec: 5 }
          );
        } catch (e) {
          this.log(`doorbell register failed: ${String(e.message ?? e).slice(0, 120)}`);
        }
        for (let i = 0; i < DOORBELL_PERIOD_MS / 100 && !stopFlag.stop; i++) await sleep(100);
      }
    })();
  }
  // ── 命令与生命周期 ────────────────────────────────────────────────────
  /** 发命令；resolve=result / reject=Error(detail||error)。语义与 BridgeClient.send
   *  对齐（含超时）；连接类失败惰性重发现+代拉后重试一次，再失败诚实报错——
   *  业务错误（HTTP 200 的 ok:false 信封）不重试，不会重复 job_start。 */
  send(cmd, args = {}, timeoutMs = 15e3) {
    if (this._stopped) return Promise.reject(new Error("daemon client stopped"));
    if (!this._ready) this._ready = this._ensure().catch((e) => {
      this._ready = null;
      throw e;
    });
    const attempt = async () => {
      let out;
      try {
        out = await httpJson(this._base, "/cmd/" + encodeURIComponent(cmd), {
          method: "POST",
          body: JSON.stringify({ id: ++this._idSeq, cmd, args: this._bindCaller(cmd, args) }),
          timeoutSec: HTTP_TIMEOUT_SEC
        });
      } catch (e) {
        const err2 = new Error("daemon_unreachable");
        err2.detail = `\u5E38\u9A7B\u5F15\u64CE\u4E0D\u53EF\u8FBE\uFF08${String(e.message ?? e).slice(0, 200)}\uFF09`;
        throw err2;
      }
      const env = out.body;
      if (out.status !== 200 || !env || env.type !== "response") {
        const err2 = new Error("daemon_bad_response");
        err2.detail = `/cmd/${cmd} \u5E94\u7B54\u5F02\u5E38\uFF08HTTP ${out.status}\uFF09\uFF1A${String(out.raw ?? "").slice(0, 160)}`;
        throw err2;
      }
      if (env.ok === true) return env.result;
      const reason = String(env.detail ?? env.error ?? "").trim();
      const err = new Error(reason ? `daemon error: ${reason}` : "daemon error");
      err.detail = reason;
      err.code = env.error;
      throw err;
    };
    const run = async () => {
      const t0 = Date.now();
      for (let tries = 0; ; tries++) {
        try {
          if (!this._base) await this._ready;
          return await attempt();
        } catch (e) {
          const connDead = e.message === "daemon_unreachable";
          if (!connDead || tries >= 1 || Date.now() - t0 > timeoutMs) throw e;
          this.log(`send ${cmd} connection dead \u2014 rediscover & retry once`);
          await this._rediscover();
        }
      }
    };
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => reject(new Error(`daemon command "${cmd}" timed out`)), timeoutMs);
      run().then(
        (v) => {
          clearTimeout(timer);
          resolve2(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
  /** 调用方身份与清单随命令走（转发壳 dispatch 的直连版）。 */
  _bindCaller(cmd, args) {
    const a = { ...args && typeof args === "object" ? args : {}, _caller_host: this.host };
    if ((cmd === "job_start" || cmd === "job_resume") && this.hostManifestPath && existsSync2(this.hostManifestPath)) {
      a._host_manifest = this.hostManifestPath;
    }
    return a;
  }
  /** 启动（异步 ensure 在后台跑；send 会排队等就绪——ensureBridgeReady 的
   *  ping 重试语义不变）。 */
  start() {
    if (this._stopped) return;
    if (!this._ready) this._ready = this._ensure().catch((e) => {
      this._ready = null;
      throw e;
    });
  }
  /** 只断自己：关 SSE/门铃、弃 pending——**不发 shutdown**，常驻引擎继续站岗
   *  （金标准①）。宿主要按宿主停戏请显式 send('shutdown')。 */
  async stop() {
    this._stopped = true;
    this._ready = null;
    if (this._sseAbort) this._sseAbort.stop = true;
    if (this._doorbellAbort) this._doorbellAbort.stop = true;
  }
};
async function sendActorFailure(bridge, jobId, waitKey, kind, detail) {
  await bridge.send("actor_failed", {
    job_id: jobId,
    wait_key: waitKey,
    kind,
    detail: String(detail).slice(0, 500)
  }, 1e4);
}

// host/bridge.ts
function hostNameOf(manifestFile) {
  try {
    const data = JSON.parse(readFileSync3(manifestFile, "utf8"));
    const h = typeof data.host === "string" ? data.host.trim() : "";
    return h;
  } catch {
    return "";
  }
}
function mailboxHostIdOf(argv = process.argv) {
  const i = argv.indexOf("--port");
  const port = i >= 0 ? argv[i + 1] : void 0;
  return port !== void 0 && /^\d+$/.test(port) ? `dsh-${port}` : "dsh";
}
var FemoBridge = class {
  /** 驿站投递员上门端口（index.ts 起好收件口后注入；undefined=自取模式）。
   *  直连后换形为门铃 URL 交 daemon 注册表（每 10s 心跳，TTL 30s 过期留柜）。 */
  pushPort;
  /** 投影事件插座（index.ts 事后注入 `(bridge as any).emit = ...`）。 */
  emit;
  /** 引擎半路死亡回调（bridge-supervisor 的 C1 自愈接线点）。 */
  onExited;
  client;
  constructor() {
  }
  get alive() {
    return this.client?.alive ?? false;
  }
  /** 发命令（与原 BridgeClient.send 同形同义：resolve=result、reject=Error）。 */
  send(cmd, args, timeoutMs) {
    const client = this.client;
    if (client === void 0) return Promise.reject(new Error("bridge not running"));
    return client.send(cmd, args, timeoutMs);
  }
  /** 装配并连上常驻引擎（原签名不变；重入安全——C1 respawn 幂等）。
   *  旧世界的 subprocess 服务 spawn 退役；dsh 配置的 python 仍经 subprocess
   *  服务解析成绝对路径（解析不到就回落原词，daemon 侧 spawn 再兜 FEMO_PYTHON/
   *  'python' 并响亮报错）。 */
  start(ctx, config) {
    if (this.alive) return;
    if (config === void 0) {
      throw new Error("femo-plugin: bridge.start(config) is required");
    }
    const hostName = process.env.FEMO_HOST_NAME?.trim() || hostNameOf(config.hostManifest);
    if (hostName !== "") process.env.FEMO_HOST_NAME = hostName;
    const mailboxHostId = mailboxHostIdOf();
    console.log(`[femo-plugin] bridge mailbox host id = ${mailboxHostId}`);
    void this.connect(ctx, config, hostName, mailboxHostId);
  }
  async connect(ctx, config, hostName, mailboxHostId) {
    let pythonPath = config.python;
    try {
      const subprocess = ctx?.get("subprocess");
      if (subprocess !== void 0) pythonPath = await subprocess.resolveExecutable(config.python);
    } catch (error) {
      console.log(`[femo-plugin] python resolve via subprocess failed (${String(error)}); falling back to '${config.python}'`);
    }
    const client = new DaemonClient({
      femoRoot: config.femoRoot,
      host: mailboxHostId,
      hostName: hostName !== "" ? hostName : mailboxHostId,
      hostManifestPath: config.hostManifest,
      // FEMO_DATA_DIR 刻意不透传 dataDir/--db：数据根共享（多实例连跑同一个
      // Job 的多宿主本意，2026-09-24 用户拍板）；沙盒场景 env FEMO_DATA_DIR
      // 由测试/多实例自设，daemon-client 的发现账路径同一口径读 env。
      python: pythonPath,
      ...this.pushPort !== void 0 ? { pushUrl: `http://127.0.0.1:${this.pushPort}/femo-plugin/mailbox-push` } : {},
      onEvent: (eventType, data) => {
        pushDiag("bridge", `event ${eventType} job=${String(data?.job_id ?? "-")}`);
        this.emit?.("femo-plugin/event", eventType, data);
      },
      log: (msg) => console.log(`[femo-plugin] ${msg}`)
    });
    client.onExited = () => {
      this.onExited?.();
    };
    this.client = client;
    client.start();
  }
  /** 只断自己：关 SSE/门铃——**不发 shutdown**，常驻引擎继续站岗（金标准①）。
   *  引擎面要按宿主停戏请走运行控制（job_pause），引擎死亡由 daemon 看门自愈。 */
  async stop() {
    await this.client?.stop();
    this.client = void 0;
  }
};

// host/compat/session-events.ts
function readSessionEvents(session) {
  const s = session;
  try {
    if (typeof s.snapshotEvents === "function") {
      return s.snapshotEvents();
    }
  } catch (error) {
    console.log(`[femo-plugin] readSessionEvents snapshotEvents() failed: ${String(error)}`);
  }
  return s.events ?? [];
}
function readSessionEventCount(session) {
  return readSessionEvents(session).length;
}

// host/persona.ts
var FEMO_PRESET = "femo-plugin";
var presetOverrides = /* @__PURE__ */ new Map();
var femoRootSections = /* @__PURE__ */ new Map();
function presetOf(session) {
  return presetOverrides.get(String(session.id)) ?? session.header.agentPreset;
}
function isFemoAgent(agent) {
  return presetOf(agent.session) === FEMO_PRESET && agent.session.header.parentSession === void 0;
}
var docsFemoRoot = engineRoot;
function configurePersonaDocs(femoRoot2) {
  const root = (femoRoot2 || engineRoot).replace(/[\/]+$/, "");
  docsFemoRoot = root + "/";
}
function injectFemoRoot(agentCtx) {
  const systemPrompt = agentCtx.systemPrompt;
  if (systemPrompt === void 0) return void 0;
  try {
    return systemPrompt.section({
      name: "femo:root",
      order: 50,
      text: `FEMO_ROOT\uFF08femo\u7CFB\u7EDF\u6839\u76EE\u5F55\uFF1B\u7CFB\u7EDF\u63D0\u793A\u4E2D\u5199\u4F5C {FEMO_ROOT} \u7684\u4F4D\u7F6E\u90FD\u6307\u5B83\uFF09\uFF1A${docsFemoRoot.replace(/[\\/]+$/, "")}`
    });
  } catch (error) {
    console.log(`[femo-plugin] femo:root section inject failed: ${String(error)}`);
    return void 0;
  }
}
function registerPersonaHooks(ctx, femoRoot2) {
  configurePersonaDocs(femoRoot2);
  ctx.on("agent/created", ({ agent }) => {
    const events = readSessionEvents(agent.session);
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event?.type === "agent-preset/selected") {
        presetOverrides.set(String(agent.session.id), event.data.agentPreset);
        break;
      }
    }
  });
  ctx.on(
    "agent-preset/selected",
    (sessionId, agentPreset) => {
      presetOverrides.set(String(sessionId), agentPreset);
      console.log(`[femo-plugin] preset override ${sessionId} -> ${agentPreset}`);
      const sid = String(sessionId);
      if (agentPreset !== FEMO_PRESET) {
        const dispose2 = femoRootSections.get(sid);
        if (dispose2 !== void 0) {
          dispose2();
          femoRootSections.delete(sid);
          console.log(`[femo-plugin] femo:root section removed (preset -> ${agentPreset})`);
        }
        return;
      }
      if (femoRootSections.has(sid)) return;
      const agent = ctx.agents.get(sessionId);
      if (agent === void 0) {
        console.log(`[femo-plugin] femo:root inject skipped: agent for ${sessionId} not found`);
        return;
      }
      const dispose = injectFemoRoot(agent.ctx);
      if (dispose !== void 0) {
        femoRootSections.set(sid, dispose);
        console.log(`[femo-plugin] femo:root section injected (recompose path)`);
      }
    }
  );
}

// host/session-roster.ts
import { existsSync as existsSync3 } from "node:fs";
import { join as join7 } from "node:path";

// ../../femo2host/host/state-files.mjs
import { join as join6 } from "node:path";
function recordHost() {
  return String(process.env.FEMO_HOST_NAME ?? "").trim();
}
async function readSessionRecord(femoRoot2, sessionId, quarantineOnParseError = false) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  let raw;
  try {
    raw = await readFile3(sessionScriptPath(femoRoot2, sessionId), "utf8");
  } catch {
    return void 0;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (!quarantineOnParseError) return void 0;
    const { rename } = await import("node:fs/promises");
    const quarantined = `${sessionScriptPath(femoRoot2, sessionId)}.corrupt-${Date.now()}`;
    try {
      await rename(sessionScriptPath(femoRoot2, sessionId), quarantined);
      console.log(`[femo-plugin] \u26A0\uFE0F \u4F1A\u8BDD\u8BB0\u5F55\u635F\u574F\uFF0C\u539F\u6863\u5DF2\u9694\u79BB\u7559\u8BC1: ${quarantined}\uFF08${String(error)}\uFF09`);
    } catch (renameError) {
      console.log(`[femo-plugin] \u26A0\uFE0F \u4F1A\u8BDD\u8BB0\u5F55\u89E3\u6790\u5931\u8D25\u4E14\u9694\u79BB\u5931\u8D25: ${String(error)} / ${String(renameError)}`);
    }
    return void 0;
  }
}
var recordLocks = /* @__PURE__ */ new Map();
function withRecordLock(sessionId, fn) {
  const prev = recordLocks.get(sessionId) ?? Promise.resolve();
  const next = prev.then(() => fn(), () => fn());
  recordLocks.set(sessionId, next);
  return (async () => {
    try {
      return await next;
    } finally {
      if (recordLocks.get(sessionId) === next) recordLocks.delete(sessionId);
    }
  })();
}
async function writeSessionRecord(femoRoot2, sessionId, record) {
  const { mkdir: mkdir3, writeFile: writeFile2 } = await import("node:fs/promises");
  const path = sessionScriptPath(femoRoot2, sessionId);
  await mkdir3(join6(path, ".."), { recursive: true });
  await writeFile2(path, JSON.stringify({
    ...record,
    sessionId,
    host: record.host ?? recordHost()
  }, null, 2), "utf8");
}
async function setSessionCurrentJob(femoRoot2, sessionId, jobId) {
  await withRecordLock(sessionId, async () => {
    const record = { ...await readSessionRecord(femoRoot2, sessionId, true) ?? {} };
    if (jobId === null) delete record.currentJobId;
    else record.currentJobId = jobId;
    await writeSessionRecord(femoRoot2, sessionId, record);
  });
}
async function readSessionCurrentJob(femoRoot2, sessionId) {
  const record = await readSessionRecord(femoRoot2, sessionId);
  return record?.currentJobId;
}
async function readSessionJobIds(femoRoot2, sessionId) {
  const record = await readSessionRecord(femoRoot2, sessionId);
  return record?.jobIds;
}
async function appendSessionJob(femoRoot2, sessionId, jobId) {
  await withRecordLock(sessionId, async () => {
    const record = { ...await readSessionRecord(femoRoot2, sessionId, true) ?? {} };
    if (record.jobIds?.includes(jobId)) return;
    record.jobIds = [...record.jobIds ?? [], jobId];
    await writeSessionRecord(femoRoot2, sessionId, record);
  });
}
function appendFemoSession(femoRoot2, sessionId, femoSessionId) {
  return withRecordLock(sessionId, async () => {
    const record = { ...await readSessionRecord(femoRoot2, sessionId, true) ?? {} };
    const list = record.femoSessions ?? [];
    if (list[list.length - 1] === femoSessionId) return;
    record.femoSessions = [...list, femoSessionId];
    await writeSessionRecord(femoRoot2, sessionId, record);
  });
}
function draftsDirOf(femoRoot2) {
  return join6(dataRootOf(femoRoot2), "host-history", "drafts");
}
function sessionScriptPath(femoRoot2, sessionId) {
  return join6(draftsDirOf(femoRoot2), `${sessionId}.json`);
}
function writeSessionScript(femoRoot2, sessionId, record, expectRev) {
  return withRecordLock(sessionId, async () => {
    const prevFile = await readSessionRecord(femoRoot2, sessionId, true);
    if (expectRev !== void 0 && (prevFile?.rev ?? 0) !== expectRev) {
      const conflictRecord = {};
      if (prevFile?.path !== void 0) conflictRecord.path = prevFile.path;
      if (prevFile?.text !== void 0) conflictRecord.text = prevFile.text;
      if (prevFile?.rev !== void 0) conflictRecord.rev = prevFile.rev;
      return { ok: false, reason: "conflict", record: conflictRecord };
    }
    const rev = (prevFile?.rev ?? 0) + 1;
    const next = {
      ...prevFile?.femoSessions !== void 0 ? { femoSessions: prevFile.femoSessions } : {},
      ...prevFile?.currentJobId !== void 0 ? { currentJobId: prevFile.currentJobId } : {},
      ...prevFile?.jobIds !== void 0 ? { jobIds: prevFile.jobIds } : {},
      ...prevFile?.host !== void 0 ? { host: prevFile.host } : {},
      ...record,
      rev
    };
    await writeSessionRecord(femoRoot2, sessionId, next);
    return { ok: true, rev };
  });
}
async function readSessionScript(femoRoot2, sessionId) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(sessionScriptPath(femoRoot2, sessionId), "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...parsed.path === void 0 ? {} : { path: parsed.path },
      ...parsed.text === void 0 ? {} : { text: parsed.text },
      ...parsed.rev === void 0 ? {} : { rev: parsed.rev }
    };
  } catch {
    return void 0;
  }
}
async function readSessionScriptText(femoRoot2, sessionId) {
  const record = await readSessionScript(femoRoot2, sessionId);
  if (record === void 0) return void 0;
  if (record.text !== void 0 && record.text.trim().length > 0) return record.text;
  if (record.path !== void 0) {
    try {
      const { readFile: readFile3 } = await import("node:fs/promises");
      return await readFile3(record.path, "utf8");
    } catch {
      return void 0;
    }
  }
  return void 0;
}

// ../../femo2host/host/hub-feed-core.mjs
var HAS_FETCH = typeof fetch === "function";
function segFieldOf(base) {
  if (typeof base.segRef === "string" && base.segRef.length > 0) return { seg: base.segRef };
  if (typeof base.ref === "string" && base.ref.length > 0) return { wait_key: base.ref };
  return void 0;
}
function draftKeyOf(base, index, kind) {
  return [kind, base.step ?? "-", index ?? "-"].join("#");
}
function postFeedFrames(feedUrl, payload) {
  return fetch(feedUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
function createHubFeedCore(opts) {
  function microbatchChannel({ chain, gate, payloadOf }) {
    let buffer = [];
    let timer;
    function push2(op) {
      if (gate && !gate()) return;
      buffer.push(op);
      if (buffer.length >= 20) {
        void flush2();
        return;
      }
      if (timer === void 0) {
        timer = setTimeout(() => {
          timer = void 0;
          void flush2();
        }, 40);
      }
    }
    function flush2() {
      const ops = buffer;
      buffer = [];
      if (ops.length === 0) return chain.promise;
      const payload = payloadOf(ops);
      if (payload === null) return chain.promise;
      const run = async () => {
        try {
          await postFeedFrames(opts.feedUrl(), payload);
        } catch {
        }
      };
      chain.promise = chain.promise.then(run);
      return chain.promise;
    }
    return { push: push2, flush: flush2 };
  }
  let currentJob = null;
  const jobChannel = microbatchChannel({
    chain: { promise: Promise.resolve() },
    gate: () => currentJob !== null && HAS_FETCH,
    payloadOf: (ops) => currentJob === null ? null : { job_id: currentJob, source: opts.source(), frames: ops }
  });
  const sessChain = { promise: Promise.resolve() };
  const sessChannels = /* @__PURE__ */ new Map();
  const sessChannelOf = (addr) => {
    let ch = sessChannels.get(addr);
    if (ch === void 0) {
      ch = microbatchChannel({
        chain: sessChain,
        gate: () => HAS_FETCH,
        payloadOf: (ops) => ({ session: addr, source: opts.source(), frames: ops })
      });
      sessChannels.set(addr, ch);
    }
    return ch;
  };
  const sessPush = (addr, op) => sessChannelOf(addr).push(op);
  const sessFlush = (addr) => sessChannelOf(addr).flush();
  const hostSegs = /* @__PURE__ */ new Map();
  function hostSegClose(sid, items) {
    const cur = hostSegs.get(sid);
    hostSegs.delete(sid);
    if (cur === void 0) return;
    sessPush(opts.sessionAddr(sid), { op: "seg-close", seg: cur.seg, items, src_seq: cur.closeSrc });
  }
  return {
    /** 场次登记：引擎事件入口（带 job_id）每事件刷新；null=停喂 job 寻址路。
     *  会话寻址帧不过这道闸（录制无条件）。 */
    setJob(jobId) {
      currentJob = jobId;
    },
    /** 流式块 → 草稿帧（词汇判定：text-delta/reasoning-delta/tool-call-delta；
     *  只有名字没参数的工具块不开槽，等参数到了再开）。 */
    feedChunk(base, chunk) {
      try {
        const ref = segFieldOf(base);
        if (ref === void 0) return;
        const sess = ref.seg !== void 0;
        if (!sess && currentJob === null) return;
        const emit = (op) => {
          if (sess) sessPush(opts.sessionAddr(base.sid), op);
          else jobChannel.push(op);
        };
        if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") {
          if (typeof chunk.text !== "string" || chunk.text.length === 0) return;
          const kind = chunk.type === "reasoning-delta" ? "reasoning" : "text";
          emit({ op: "draft-delta", ...ref, key: draftKeyOf(base, chunk.index, kind), kind, text: chunk.text });
        } else if (chunk.type === "tool-call-delta") {
          const name2 = typeof chunk.name === "string" && chunk.name.length > 0 ? chunk.name : void 0;
          const args = typeof chunk.argumentsDelta === "string" ? chunk.argumentsDelta : "";
          if (args.length === 0) return;
          emit({
            op: "draft-delta",
            ...ref,
            key: draftKeyOf(base, chunk.index, "toolcall"),
            kind: "toolcall",
            text: args,
            ...name2 !== void 0 ? { name: name2 } : {}
          });
        }
      } catch {
      }
    },
    /** 清屏（内容交接/孤儿 attempt）：这一拍已写出去的字作废，hub 撤该容器里的
     *  草稿（页面同步撤），容器本身留着。寻址分叉同 feedChunk。 */
    clearBucket(base) {
      const ref = segFieldOf(base);
      if (ref === void 0) return;
      if (ref.seg !== void 0) sessPush(opts.sessionAddr(base.sid), { op: "draft-drop", ...ref });
      else jobChannel.push({ op: "draft-drop", ...ref });
    },
    /** 开一个宿主轮容器（user 发言那拍调用：位置就此锁定在 user 之后）。
     *  重复开（同一 sid 上一轮还没收口）= 先把旧的收掉，绝不叠容器。 */
    hostSegOpen(sid, o) {
      const prev = hostSegs.get(sid);
      if (prev !== void 0) hostSegClose(sid, []);
      const seg = `h:${sid}:${o.seq}`;
      hostSegs.set(sid, {
        seg,
        /** 收口用的幂等键（从同一枚 seq 推出来，重放时一模一样）。 */
        closeSrc: `main:${sid}:seg${o.seq}:turn`
      });
      sessPush(opts.sessionAddr(sid), {
        // role:'main'=段角色标（显示策略用）：宿主轮容器=主 Agent 的声音
        op: "seg-open",
        seg,
        zone: "outside",
        actor: "\u4E3BAgent",
        node: "",
        text: "",
        role: "main",
        ...o.turn !== void 0 ? { turn: o.turn } : {}
      });
      return seg;
    },
    /** 本 sid 当前开着的宿主轮容器（主Agent流据此把字喂进去）；没开就没有
     *  ——FEMO内轮不开宿主容器，它的字由桥那条路（wait_key）喂。 */
    hostSegCurrent(sid) {
      return hostSegs.get(sid)?.seg;
    },
    /** 收口本 sid 的宿主轮（turn/end 那拍）：定稿 items 交给 hub，同 kind 的
     *  流式草稿被吸收、没流到的 kind 由草稿转正兜底（宿主不必自己防双份）。 */
    hostSegClose(sid, items) {
      hostSegClose(sid, items);
    },
    /** 通用 op 喂送口：**job 寻址**专用（闸门照旧；调试与未来引擎侧直投用）。
     *  会话寻址帧走 feedRow / 宿主轮三口，不走这里。 */
    feedOp(op) {
      jobChannel.push(op);
    },
    /** 行旁挂：会话寻址直投、无运行照喂（src_seq 由调用方给足，hub 幂等去重）。 */
    feedRow(sid, row) {
      sessPush(opts.sessionAddr(sid), { op: "row", ...row });
    }
  };
}

// host/hub/hub-feed.ts
function hostAddr() {
  return String(process.env.FEMO_HOST_NAME ?? "").trim() || "dsh";
}
var core = createHubFeedCore({
  feedUrl: () => `${hubBaseUrl()}/feed`,
  source: () => String(process.env.FEMO_HOST_NAME ?? "").trim(),
  sessionAddr: (sid) => `${hostAddr()}:${sid}`
});
function hubFeedSetJob(jobId) {
  core.setJob(jobId);
}
function hubFeedChunk(base, chunk) {
  core.feedChunk(base, chunk);
}
function hubFeedClearBucket(base) {
  core.clearBucket(base);
}
function hubFeedEndTurn(_base) {
}
function hubHostSegOpen(sid, opts) {
  return core.hostSegOpen(sid, opts);
}
function hubHostSegCurrent(sid) {
  return core.hostSegCurrent(sid);
}
function hubHostSegClose(sid, items) {
  core.hostSegClose(sid, items);
}
function hubFeedRow(sid, row) {
  core.feedRow(sid, row);
}

// host/session-roster.ts
var HAS_FETCH2 = typeof fetch === "function";
var announceUrl = () => `${hubBaseUrl()}/sessions/announce`;
var pendingUpserts = /* @__PURE__ */ new Map();
var lastOrder = [];
var pendingBind = null;
var pendingOrder = null;
var pendingDelist = null;
var flushTimer;
var attempts = 0;
function announceSessions(entries, bindSid, order, delist) {
  if (!HAS_FETCH2) return;
  let dirty = false;
  for (const e of entries ?? []) {
    const sid = String(e?.sid ?? "").trim();
    if (sid === "") continue;
    pendingUpserts.set(sid, {
      sid,
      name: String(e?.name ?? "").trim(),
      ...typeof e?.job === "number" && Number.isFinite(e.job) ? { job: e.job } : {}
    });
    dirty = true;
  }
  const bind = String(bindSid ?? "").trim();
  if (bind !== "") {
    pendingBind = bind;
    dirty = true;
  }
  if (Array.isArray(order) && order.length > 0) {
    lastOrder = order.map((s) => String(s));
    pendingOrder = lastOrder;
    dirty = true;
  }
  if (Array.isArray(delist) && delist.length > 0) {
    pendingDelist = delist.map((s) => String(s));
    dirty = true;
  }
  if (!dirty) return;
  attempts = 0;
  if (flushTimer === void 0) {
    flushTimer = setTimeout(() => {
      flushTimer = void 0;
      void flush();
    }, 50);
  }
}
async function flush() {
  if (pendingUpserts.size === 0 && pendingBind === null && pendingOrder === null && pendingDelist === null) return;
  const body = {
    source: hostAddr(),
    upsert: [...pendingUpserts.values()].map((e) => ({
      sid: e.sid,
      name: e.name,
      ...e.job !== void 0 ? { job: e.job } : {}
    }))
  };
  if (pendingBind !== null) body.bind = pendingBind;
  if (pendingOrder !== null) body.order = pendingOrder;
  if (pendingDelist !== null) body.delist = pendingDelist;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8e3);
  try {
    const resp = await fetch(announceUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    if (!resp.ok) throw new Error(`hub responded ${resp.status}`);
    pendingUpserts.clear();
    pendingBind = null;
    pendingOrder = null;
    pendingDelist = null;
    attempts = 0;
  } catch {
    if (++attempts <= 12) {
      if (flushTimer === void 0) {
        flushTimer = setTimeout(() => {
          flushTimer = void 0;
          void flush();
        }, 5e3);
      }
    } else {
      pendingUpserts.clear();
      pendingBind = null;
      pendingOrder = null;
      pendingDelist = null;
      attempts = 0;
    }
  } finally {
    clearTimeout(timer);
  }
}
function titleOfSession(session) {
  const events = readSessionEvents(session);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type !== "session/title") continue;
    const title = event.data?.title;
    if (typeof title === "string" && title.trim() !== "") return title.trim();
  }
  return "";
}
function workspaceTitleOf(path) {
  const trimmed = path.replace(/[/\\]+$/, "");
  const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(separator + 1);
}
function displayNameOf(title, cwd) {
  if (title !== "") return title;
  if (cwd !== "") {
    const base = workspaceTitleOf(cwd);
    if (base !== "") return base;
  }
  return "";
}
function cwdOfSession(session) {
  const header = session?.header;
  return typeof header?.cwd === "string" ? header.cwd : "";
}
function rosterNameOfSession(session) {
  return displayNameOf(titleOfSession(session), cwdOfSession(session));
}
function getService(ctx, name2) {
  try {
    return ctx.get?.(name2);
  } catch {
    return void 0;
  }
}
async function observeTitle(query, sessionId, keys) {
  const observe = query.observeSession;
  if (typeof observe !== "function") return "";
  let obs;
  try {
    obs = await observe.call(query, sessionId, { projectionMode: "all" });
    const o = obs;
    const values = o.projections?.values;
    if (keys !== void 0 && values) {
      const meta = values.sessionListMetadata;
      const lp = typeof meta?.lastPromptAt === "number" ? meta.lastPromptAt : 0;
      if (lp > (keys.get(sessionId) ?? 0)) keys.set(sessionId, lp);
    }
    const title = values?.title;
    if (typeof title === "string" && title.trim() !== "") return title.trim();
    const events = o.events;
    if (Array.isArray(events)) {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event?.type !== "session/title") continue;
        const t = event.data?.title;
        if (typeof t === "string" && t.trim() !== "") return t.trim();
      }
    }
    return "";
  } catch {
    return "";
  } finally {
    if (obs !== void 0) {
      try {
        const sym = Symbol.dispose;
        const bySym = sym !== void 0 ? obs[sym] : void 0;
        if (typeof bySym === "function") bySym.call(obs);
        else {
          const dispose = obs.dispose;
          if (typeof dispose === "function") dispose.call(obs);
        }
      } catch {
      }
    }
  }
}
function isFemoSession(sid, identity) {
  if (identity !== void 0 && presetOf(identity) === FEMO_PRESET) return true;
  if (sid === "" || femoRootDir === "") return false;
  return existsSync3(join7(draftsDirOf(femoRootDir), `${sid}.json`));
}
var femoRootDir = "";
async function readLatestJob(femoRoot2, sid) {
  if (femoRoot2 === "" || sid === "") return void 0;
  try {
    const cur = await readSessionCurrentJob(femoRoot2, sid);
    if (typeof cur === "number" && cur > 0) return cur;
    const ids = await readSessionJobIds(femoRoot2, sid);
    const last = Array.isArray(ids) ? ids[ids.length - 1] : void 0;
    if (typeof last === "number" && last > 0) return last;
  } catch {
  }
  return void 0;
}
async function coldScanRoster(ctx, femoRoot2, attempt) {
  try {
    const query = getService(ctx, "sessionQuery");
    if (typeof query?.listSessions !== "function") {
      if (attempt < 2) {
        setTimeout(() => {
          void coldScanRoster(ctx, femoRoot2, attempt + 1);
        }, attempt === 0 ? 3e3 : 1e4);
      }
      return;
    }
    const records = await query.listSessions();
    const entries = [];
    const keys = /* @__PURE__ */ new Map();
    const cwds = /* @__PURE__ */ new Map();
    for (const record of records ?? []) {
      const header = record?.header;
      if (!header || header.id === void 0) continue;
      if (header.origin === "subagent" || header.parentSession !== void 0) continue;
      const sid = String(header.id);
      if (!isFemoSession(sid, { id: header.id, header: { agentPreset: typeof header.agentPreset === "string" ? header.agentPreset : void 0 } })) continue;
      entries.push({ sid, name: "" });
      keys.set(sid, typeof header.createdAt === "number" ? header.createdAt : 0);
      if (typeof header.cwd === "string" && header.cwd !== "") cwds.set(sid, header.cwd);
    }
    const inRoster = [];
    const emptySids = [];
    let withTitle = 0;
    for (let i = 0; i < entries.length; i += 8) {
      const batch = entries.slice(i, i + 8);
      await Promise.all(batch.map(async (e) => {
        const title = await observeTitle(query, e.sid, keys);
        e.job = await readLatestJob(femoRootDir, e.sid);
        e.name = displayNameOf(title, cwds.get(e.sid) ?? "");
        if (title !== "") withTitle += 1;
        if (title !== "" || e.job !== void 0) inRoster.push(e);
        else emptySids.push(e.sid);
      }));
      await new Promise((resolve2) => setImmediate(resolve2));
    }
    inRoster.sort((a, b) => (keys.get(b.sid) ?? 0) - (keys.get(a.sid) ?? 0));
    console.log(`[femo-plugin] session roster cold scan: ${inRoster.length} femo session(s) / ${records?.length ?? 0} total, ${withTitle} titled, ${emptySids.length} empty delisted (DSH UI order)`);
    if (inRoster.length > 0 || emptySids.length > 0) {
      announceSessions(
        inRoster,
        void 0,
        inRoster.length > 0 ? inRoster.map((e) => e.sid) : void 0,
        emptySids
      );
    }
  } catch (error) {
    console.log(`[femo-plugin] session roster cold scan failed: ${String(error)}`);
  }
}
function promoteInOrder(sid) {
  const next = [sid, ...lastOrder.filter((x) => x !== sid)];
  lastOrder = next;
  return next;
}
function registerSessionRoster(ctx, femoRoot2) {
  femoRootDir = String(femoRoot2 || "").replace(/[\\/]+$/, "");
  ctx.on(
    "agent-preset/selected",
    (sessionId, agentPreset) => {
      if (agentPreset !== FEMO_PRESET) return;
      const sid = String(sessionId);
      const session = ctx.agents.get(sessionId)?.session;
      const name2 = session ? displayNameOf(titleOfSession(session), cwdOfSession(session)) : "";
      announceSessions([{ sid, name: name2 }], void 0, promoteInOrder(sid));
      console.log(`[femo-plugin] session roster: ${sid} entered (preset ${agentPreset})`);
    }
  );
  ctx.on("session/event", (session, event) => {
    try {
      if (session.header.parentSession !== void 0) return;
      if (event.type !== "user/message") return;
      const data = event.data;
      const srcKind = data.source?.kind;
      if (srcKind !== void 0 && srcKind !== "user") return;
      if (!isFemoSession(String(session.id), session)) return;
      const sid = String(session.id);
      void (async () => {
        const job = await readLatestJob(femoRootDir, sid);
        announceSessions(
          [{ sid, name: displayNameOf(titleOfSession(session), cwdOfSession(session)), job }],
          sid,
          promoteInOrder(sid)
        );
      })();
    } catch {
    }
  });
  void coldScanRoster(ctx, femoRoot2, 0);
}

// host/compat/list-cache.ts
import { readdir } from "node:fs/promises";
import { join as join8 } from "node:path";
var bareList = /* @__PURE__ */ new WeakMap();
function yieldToEventLoop() {
  return new Promise((resolve2) => setImmediate(resolve2));
}
function installPersistenceListCache(ctx) {
  let disposed = false;
  let timer;
  let restore;
  const finish = () => {
    if (timer !== void 0) {
      clearInterval(timer);
      timer = void 0;
    }
  };
  const tryInstall = () => {
    if (disposed) return;
    const persistence = ctx.get("sessionPersistence");
    if (persistence === void 0 || typeof persistence.list !== "function") return;
    if (typeof persistence.root !== "string" || persistence.root === "") {
      console.log("[femo-plugin] list-cache: persistence has no root dir (non-jsonl backend?), skip");
      finish();
      return;
    }
    const root = persistence.root;
    const compression = persistence.config?.compression === "none" ? "none" : "zstd";
    const bare = bareList.get(persistence);
    if (bare !== void 0) persistence.list = bare;
    const orig = persistence.list.bind(persistence);
    bareList.set(persistence, orig);
    const state = { headers: void 0, fingerprint: "" };
    let inflight;
    const scanFingerprint = async () => {
      const parts = [];
      const projects = await readdir(root, { withFileTypes: true });
      for (const project of projects) {
        if (!project.isDirectory()) continue;
        const projectPath = join8(root, project.name);
        const entries = await readdir(projectPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.endsWith(".jsonl.zstd"))) {
            return "fallback";
          }
          if (!entry.isDirectory()) continue;
          parts.push(`${project.name}/${entry.name}`);
        }
      }
      parts.sort();
      return parts.join("\n");
    };
    const normalizeSignal = (opts) => opts instanceof AbortSignal ? opts : opts?.signal;
    const wrapped = async (opts) => {
      const signal = normalizeSignal(opts);
      signal?.throwIfAborted();
      if (inflight !== void 0) {
        const shared = await inflight;
        signal?.throwIfAborted();
        return shared.slice();
      }
      inflight = (async () => {
        const fingerprint = await scanFingerprint();
        if (fingerprint === "fallback") {
          const fresh = await orig(signal === void 0 ? void 0 : { signal });
          state.headers = fresh.slice();
          state.fingerprint = "";
          return state.headers;
        }
        if (state.headers === void 0 || fingerprint !== state.fingerprint) {
          const fresh = await orig(signal === void 0 ? void 0 : { signal });
          state.headers = fresh.slice();
          state.fingerprint = fingerprint;
          console.log(`[femo-plugin] list-cache: rebuilt via native scan (sessions=${fresh.length})`);
        }
        return state.headers;
      })();
      try {
        const result = await inflight;
        signal?.throwIfAborted();
        return result.slice();
      } finally {
        inflight = void 0;
      }
    };
    persistence.list = wrapped;
    restore = () => {
      if (bareList.get(persistence) === orig) persistence.list = orig;
      bareList.delete(persistence);
      state.headers = void 0;
      state.fingerprint = "";
    };
    finish();
    console.log(`[femo-plugin] list-cache installed (root=${root}, compression=${compression})`);
  };
  tryInstall();
  timer = setInterval(tryInstall, 200);
  const giveUp = setTimeout(() => {
    if (!disposed && timer !== void 0) finish();
  }, 3e4);
  giveUp.unref?.();
  return () => {
    disposed = true;
    finish();
    restore?.();
    restore = void 0;
  };
}

// host/compat/native-state.ts
var nativeState = {
  /** true = 原生 0.1.3+ 构建（无 registerSessionEventType）。 */
  native: false,
  /** true = 本构建持久层白名单已收录 femo-plugin/chat（实验性补丁）。
   *  决定：主会话可写 sys/role 行；投影窗走 agent-loop 持久化创建。 */
  mainChatSafe: false
};
function durableProjectionWindows() {
  return nativeState.native && nativeState.mainChatSafe;
}

// host/projection/hub-anchor.ts
var HUB_ANCHOR_KIND = "hub";
var HUB_ANCHOR_SRC = "femo-hub-anchor";

// ../../femo2host/host/projection-core.mjs
function actorKeyOf(name2) {
  let out = "";
  for (const ch of String(name2)) {
    if (/[A-Za-z0-9_-]/.test(ch)) out += ch;
    else out += `_${ch.codePointAt(0).toString(16)}`;
  }
  return out || "_";
}
function dedupeStructKey(eventType, d) {
  if (typeof d?.turn !== "number") return void 0;
  if (eventType === "turn/start" || eventType === "turn/end") return `${eventType}:${d.turn}`;
  if ((eventType === "step/start" || eventType === "step/end") && typeof d.step === "number") {
    return `${eventType}:${d.turn}:${d.step}`;
  }
  return void 0;
}
function replayKey(type, d = {}) {
  return [
    type,
    String(d._srcSeq ?? ""),
    typeof d.turn === "number" ? String(d.turn) : "",
    typeof d.step === "number" ? String(d.step) : "",
    String(d.seq ?? ""),
    String(d.kind ?? ""),
    typeof d.index === "number" ? String(d.index) : "",
    String(d.actor ?? "")
  ].join("|");
}
var WindowLedger = class {
  constructor() {
    this.srcSeqs = /* @__PURE__ */ new Set();
    this.structKeys = /* @__PURE__ */ new Set();
    this.cursor = 0;
    this.seeded = false;
  }
  seed(rows) {
    if (this.seeded) return;
    this.seeded = true;
    for (const row of rows) {
      const d = row.data ?? {};
      if (d._srcSeq !== void 0) this.srcSeqs.add(d._srcSeq);
      const sk = dedupeStructKey(row.type, d);
      if (sk !== void 0) this.structKeys.add(sk);
      if (typeof row.seq === "number" && row.seq > this.cursor) this.cursor = row.seq;
    }
  }
  check(type, data) {
    const d = data ?? {};
    if (d._srcSeq !== void 0 && this.srcSeqs.has(d._srcSeq)) return "dup-src";
    const sk = dedupeStructKey(type, d);
    if (sk !== void 0 && this.structKeys.has(sk)) return "dup-struct";
    return "ok";
  }
  mark(type, data) {
    const d = data ?? {};
    if (d._srcSeq !== void 0) this.srcSeqs.add(d._srcSeq);
    const sk = dedupeStructKey(type, d);
    if (sk !== void 0) this.structKeys.add(sk);
  }
  nextSeq() {
    return ++this.cursor;
  }
};

// shared/window-id.mjs
var PROJECTION_WINDOW_PREFIX = "femo-proj-";
function parseProjectionWindowId(sessionId) {
  if (!sessionId.startsWith(PROJECTION_WINDOW_PREFIX)) return void 0;
  const suffix = sessionId.slice(PROJECTION_WINDOW_PREFIX.length);
  const cut = suffix.lastIndexOf("-");
  if (cut <= 0) return void 0;
  return { mainSid: suffix.slice(0, cut), win: suffix.slice(cut + 1) };
}

// host/projection/projection.ts
function appendEvent(session, type, data, surface) {
  if (type === "turn/end") {
    const d = data ?? {};
    if (d.reason === void 0) {
      data = { ...d, reason: { kind: "completed" } };
    }
  }
  ;
  session.append(type, data, surface);
}
var winDedupeIndex = /* @__PURE__ */ new WeakMap();
function dedupeIndexFor(session) {
  let idx = winDedupeIndex.get(session);
  if (idx === void 0) {
    const ledger = new WindowLedger();
    let hasDescriptor = false;
    const rows = [];
    for (const e of readSessionEvents(session)) {
      if (e.type === "subagent/descriptor") hasDescriptor = true;
      rows.push({ type: e.type, data: e.data ?? {} });
    }
    ledger.seed(rows);
    idx = {
      ledger,
      hasDescriptor,
      get srcSeqs() {
        return ledger.srcSeqs;
      },
      get structKeys() {
        return ledger.structKeys;
      }
    };
    winDedupeIndex.set(session, idx);
  }
  return idx;
}
function dedupeMarkIndexed(session, type, data) {
  const idx = winDedupeIndex.get(session);
  if (idx === void 0) return;
  idx.ledger.mark(type, data);
  if (type === "subagent/descriptor") idx.hasDescriptor = true;
}
function appendChat(ctx, session, text, kind = "notice", actor, visible) {
  try {
    session.append("femo-plugin/chat", {
      ...actor === void 0 ? {} : { actor },
      text,
      kind,
      ...visible === void 0 ? {} : { visible }
    });
    console.log(`[femo-plugin] chat: kind=${kind} actor=${actor ?? "-"} len=${text.length}`);
  } catch (error) {
    console.log(`[femo-plugin] appendChat failed: ${String(error)}`);
  }
}
function appendChatProjected(ctx, session, _projections, text, kind, actor, visible, alsoMainSession = false) {
  if (alsoMainSession) {
    appendChat(ctx, session, text, kind, actor, visible);
  }
}
function appendChatMain(ctx, session, text) {
  appendChat(ctx, session, text, "sys");
}
function appendChatBroadcast(ctx, session, _projections, text) {
  appendChatMain(ctx, session, text);
}
var GOD_ACTOR = "god";
var STAGE_ACTOR = "stage";
function projectionActorKey(actor) {
  return actorKeyOf(actor);
}
function projectionId(sid, actor) {
  return `femo-proj-${sid}-${projectionActorKey(actor)}`;
}
function mainSessionIdOf(sessionId) {
  return parseProjectionWindowId(sessionId)?.mainSid ?? sessionId;
}
function descriptorLabel(actor) {
  return actor === GOD_ACTOR ? "\u{1F441} \u4E0A\u5E1D\u89C6\u89D2" : actor === STAGE_ACTOR ? "FEMO\u5185\u89C6\u89D2" : `\u{1F3AD} ${actor}`;
}
function projectionHasDescriptor(session) {
  return dedupeIndexFor(session).hasDescriptor;
}
var awakenedDisposers = [];
async function awakenProjectionWindow(ctx, sessions, id, cwd) {
  const persistence = ctx.get("sessionPersistence");
  if (persistence === void 0) return void 0;
  if (nativeState.native && typeof persistence.readStoredLog === "function" && typeof persistence.locate === "function" && sessions.prepare !== void 0 && sessions.enter !== void 0 && sessions.announce !== void 0) {
    const t02 = Date.now();
    try {
      const loc = persistence.locate({ cwd, id: SessionId(id) });
      if (loc === void 0) {
        console.log(`[femo-plugin] awaken ${id}: no stored log (fresh window)`);
        return void 0;
      }
      const stored = await persistence.readStoredLog(loc.path, SessionId(id));
      if (stored === void 0 || stored.status !== "current" || !Array.isArray(stored.events)) {
        console.log(`[femo-plugin] awaken ${id}: stored log not usable (status=${String(stored?.status)})`);
        return void 0;
      }
      const sanitized = stored.events.map((raw) => {
        const e = raw;
        if (e?.type === "turn/end" && e.data?.reason === void 0) {
          return { ...e, data: { ...e.data ?? {}, reason: { kind: "completed" } } };
        }
        return raw;
      });
      const session = sessions.prepare(SessionId(id), {
        eventState: stored.eventState ?? "shared-frozen",
        seed: sanitized,
        meta: stored.meta,
        inheritedEventCount: stored.inheritedEventCount ?? 0
      });
      const detach = sessions.enter(session);
      sessions.announce(session);
      awakenedDisposers.push(detach);
      console.log(`[femo-plugin][diag] awaken ${id}: durable load ${Date.now() - t02}ms, events=${stored.events.length}`);
      return session;
    } catch (error) {
      console.log(`[femo-plugin] awaken ${id} durable load failed: ${String(error instanceof Error ? error.message : error)} (after ${Date.now() - t02}ms)`);
      return void 0;
    }
  }
  if (persistence.prepare === void 0 || sessions.enter === void 0 || sessions.announce === void 0) {
    return void 0;
  }
  let prep;
  const t0 = Date.now();
  try {
    prep = await persistence.prepare(SessionId(id));
    console.log(`[femo-plugin][diag] awaken ${id}: prepare ${Date.now() - t0}ms, events=${readSessionEventCount(prep.session)}`);
  } catch (error) {
    console.log(`[femo-plugin] awaken ${id} PREPARE FAILED: ${String(error instanceof Error ? error.message : error)} (after ${Date.now() - t0}ms)`);
    return void 0;
  }
  try {
    const detach = sessions.enter(prep.session);
    sessions.announce(prep.session);
    awakenedDisposers.push(detach);
    return prep.session;
  } catch (error) {
    console.log(`[femo-plugin] awaken ${id} enter failed: ${String(error)}`);
    return void 0;
  }
}
function descriptorPayload(actor) {
  return {
    version: nativeState.native ? 3 : 2,
    mode: "one-shot",
    provider: "femo-plugin",
    label: descriptorLabel(actor)
  };
}
var projectionWriters = /* @__PURE__ */ new Map();
async function attachProjectionWriter(ctx, session, id) {
  if (projectionWriters.has(id)) return;
  const persistence = ctx.get("sessionPersistence");
  if (persistence?.open === void 0) return;
  try {
    const handle = await persistence.open(SessionId(id), "write");
    try {
      const stored = await handle.read(0);
      let nextSeq = Array.isArray(stored.events) ? stored.events.length : 0;
      let chain = Promise.resolve();
      const enqueue = (events) => {
        if (events.length === 0) return;
        chain = chain.then(() => handle.append(events)).catch((error) => {
          console.log(`[femo-plugin] \u5199\u76D8\u5931\u8D25 ${id}: ${String(error instanceof Error ? error.message : error).slice(0, 120)}`);
        });
      };
      const buffered = [];
      let subscribed = false;
      ctx.on("session/event", (target, event) => {
        if (target !== session) return;
        if (!subscribed) {
          buffered.push(event);
          return;
        }
        const seq = typeof event.seq === "number" ? event.seq : -1;
        if (seq >= 0 && seq < nextSeq) return;
        nextSeq = seq + 1;
        enqueue([event]);
      });
      const all = readSessionEvents(session);
      const suffix = all.slice(nextSeq);
      enqueue(suffix);
      nextSeq = all.length;
      subscribed = true;
      buffered.length = 0;
      projectionWriters.set(id, handle);
    } catch (error) {
      await handle.close().catch(() => {
      });
      throw error;
    }
  } catch (error) {
  }
}
function disposeProjectionWriters() {
  for (const [id, handle] of projectionWriters) {
    void handle.close().catch(() => {
    });
  }
  projectionWriters.clear();
}
function ensureHubAnchor(session) {
  try {
    const idx = dedupeIndexFor(session);
    if (idx.srcSeqs.has(HUB_ANCHOR_SRC)) return;
    appendEvent(session, "femo-plugin/chat", {
      kind: HUB_ANCHOR_KIND,
      text: "",
      _srcSeq: HUB_ANCHOR_SRC
    });
    idx.srcSeqs.add(HUB_ANCHOR_SRC);
    console.log("[femo-plugin] hub anchor written (content seam \u2192 projection hub)");
  } catch (error) {
    console.log(`[femo-plugin] hub anchor write failed: ${String(error)}`);
  }
}
async function ensureProjectionWindow(ctx, sid, actor, cwd) {
  const sessions = ctx.get("sessions");
  if (sessions === void 0) return void 0;
  const id = projectionId(sid, actor);
  try {
    const existing = sessions.get(SessionId(id));
    if (existing !== void 0) {
      if (!projectionHasDescriptor(existing)) {
        appendEvent(existing, "subagent/descriptor", descriptorPayload(actor));
      }
      void attachProjectionWriter(ctx, existing, id);
      ensureHubAnchor(existing);
      return existing;
    }
    const awakened = await awakenProjectionWindow(ctx, sessions, id, cwd);
    if (awakened !== void 0) {
      if (!projectionHasDescriptor(awakened)) {
        appendEvent(awakened, "subagent/descriptor", descriptorPayload(actor));
      }
      await attachProjectionWriter(ctx, awakened, id);
      ensureHubAnchor(awakened);
      console.log(`[femo-plugin] projection window awakened: ${id} (${actor})`);
      return awakened;
    }
    if (durableProjectionWindows()) {
      const agents = ctx.get("agents");
      if (agents !== void 0) {
        try {
          const handle = await agents.create({
            sessionId: SessionId(id),
            meta: { cwd, parentSession: sid, origin: "subagent" }
          });
          const session = handle.agent?.session;
          if (session !== void 0) {
            appendEvent(session, "subagent/descriptor", descriptorPayload(actor));
            ensureHubAnchor(session);
            console.log(`[femo-plugin] projection window created (durable): ${id} (${actor})`);
            return session;
          }
          console.log(`[femo-plugin] durable projection window ${id}: no session on handle \u2014 window unavailable this boot`);
          return void 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("already exists")) {
            console.log(`[femo-plugin] durable projection window ${id} exists but is not live \u2014 window unavailable this boot`);
            return void 0;
          }
          console.log(`[femo-plugin] durable projection window ${id} create failed: ${String(error)} \u2014 falling back to bare create`);
        }
      }
    }
    const created = sessions.create(id, {
      meta: { cwd, parentSession: sid, origin: "subagent" }
    });
    appendEvent(created, "subagent/descriptor", descriptorPayload(actor));
    ensureHubAnchor(created);
    console.log(`[femo-plugin] projection window created: ${id} (${actor})`);
    return created;
  } catch (error) {
    console.log(`[femo-plugin] ensureProjectionWindow(${actor}) failed: ${String(error)}`);
    return void 0;
  }
}
async function ensureProjectionWindows(ctx, sid, actors, cwd) {
  const god = await ensureProjectionWindow(ctx, sid, GOD_ACTOR, cwd);
  await yieldToEventLoop();
  const stage = await ensureProjectionWindow(ctx, sid, STAGE_ACTOR, cwd);
  await yieldToEventLoop();
  const map = /* @__PURE__ */ new Map();
  for (const actor of actors) {
    const win = await ensureProjectionWindow(ctx, sid, actor, cwd);
    if (win !== void 0) map.set(actor, win);
    await yieldToEventLoop();
  }
  return { god, stage, actors: map };
}
function createProjectionRegistry(ctx) {
  const windows = /* @__PURE__ */ new Map();
  const inflight = /* @__PURE__ */ new Map();
  ctx.on("session/event", (session, event) => {
    dedupeMarkIndexed(session, event.type, event.data);
  });
  const buildOnce = async (sid, actors, cwd) => {
    const existing = windows.get(sid);
    if (existing !== void 0) {
      for (const actor of actors) {
        if (!existing.actors.has(actor)) {
          const win = await ensureProjectionWindow(ctx, sid, actor, cwd);
          if (win !== void 0) existing.actors.set(actor, win);
          await yieldToEventLoop();
        }
      }
      if (existing.god === void 0) {
        existing.god = await ensureProjectionWindow(ctx, sid, GOD_ACTOR, cwd);
        await yieldToEventLoop();
      }
      if (existing.stage === void 0) {
        existing.stage = await ensureProjectionWindow(ctx, sid, STAGE_ACTOR, cwd);
        await yieldToEventLoop();
      }
    } else {
      const created = await ensureProjectionWindows(ctx, sid, actors, cwd);
      windows.set(sid, created);
    }
  };
  return {
    windows,
    ensure(sid, actors, cwd) {
      const prev = inflight.get(sid) ?? Promise.resolve();
      const task = prev.then(() => buildOnce(sid, actors, cwd));
      inflight.set(sid, task);
      void task.catch(() => void 0);
      const cleanup = () => {
        if (inflight.get(sid) === task) inflight.delete(sid);
      };
      task.then(cleanup, cleanup);
      return task.then(() => windows.get(sid));
    },
    get(sid) {
      return windows.get(sid);
    }
  };
}

// host/projection/windowing-native.ts
import { createRequire as createRequire2 } from "node:module";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join as join9 } from "node:path";
var WINDOW_ID_PREFIX = "femo-proj-";
var DESCRIPTOR_TYPE = "subagent/descriptor";
var FEMO_CHAT_TYPE = "femo-plugin/chat";
var LEGACY_FEMO_EVENT_TYPES = ["femo-plugin/turn-scope"];
var SURFACE_ELIGIBLE_TYPES = /* @__PURE__ */ new Set(["user/message", "assistant/message", "tool/result"]);
function isNativeDshBuild(sessionNamespace) {
  return sessionNamespace?.registerSessionEventType === void 0;
}
function isNativeMode() {
  return nativeState.native;
}
var replaying = /* @__PURE__ */ new Set();
var mirrorWrites = /* @__PURE__ */ new Map();
function mirrorFile(mirrorDir, windowId) {
  const safe = windowId.replace(/[^\w.-]/g, "_");
  return join9(mirrorDir, `${safe}.jsonl`);
}
function isHubAnchorEvent(event) {
  return event.type === FEMO_CHAT_TYPE && event.data?._srcSeq === HUB_ANCHOR_SRC;
}
function mirrorEnqueue(mirrorDir, windowId, event) {
  const file = mirrorFile(mirrorDir, windowId);
  const row = { type: event.type, data: event.data };
  const prev = mirrorWrites.get(file) ?? Promise.resolve();
  const next = prev.then(() => appendFile(file, `${JSON.stringify(row)}
`, "utf8")).catch((error) => {
    console.log(`[femo-plugin][native] mirror write failed for ${windowId}: ${String(error)}`);
  });
  mirrorWrites.set(file, next);
}
async function mirrorReadAll(mirrorDir, windowId) {
  try {
    const raw = await readFile(mirrorFile(mirrorDir, windowId), "utf8");
    return raw.split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
async function replayWindow(window, mirrorDir) {
  const windowId = String(window.id);
  const rows = await mirrorReadAll(mirrorDir, windowId);
  if (rows.length === 0) return;
  replaying.add(windowId);
  try {
    const durable = readSessionEventCount(window) > 0;
    const seen = /* @__PURE__ */ new Set();
    if (durable) {
      for (const e of readSessionEvents(window)) {
        seen.add(replayKey(e.type, e.data ?? {}));
      }
    }
    let replayed = 0;
    for (const row of rows) {
      if (row.type === DESCRIPTOR_TYPE) continue;
      if (durable) {
        const key = replayKey(row.type, row.data ?? {});
        if (seen.has(key)) continue;
        seen.add(key);
      }
      const surface = row.surfaceOp !== void 0 ? row.surfaceOp : SURFACE_ELIGIBLE_TYPES.has(row.type) ? { surfaceOp: "append" } : void 0;
      try {
        appendEvent(window, row.type, row.data, surface);
        replayed += 1;
      } catch (error) {
        console.log(`[femo-plugin][native] replay row skipped (${row.type}): ${String(error).slice(0, 120)}`);
      }
    }
    if (replayed > 0) console.log(`[femo-plugin][native] window ${windowId} restored from mirror: ${replayed} rows`);
  } finally {
    replaying.delete(windowId);
  }
}
function registerRuntimeWhitelist() {
  const candidates = [];
  let hostPath;
  if (process.argv[1] !== void 0 && process.argv[1].length > 0) {
    try {
      const req = createRequire2(process.argv[1]);
      hostPath = req.resolve("@deepseek-ai/dsh-session");
      candidates.push(() => req("@deepseek-ai/dsh-session"));
    } catch {
    }
  }
  candidates.push(() => createRequire2(import.meta.url)("@deepseek-ai/dsh-session"));
  for (const load of candidates) {
    try {
      const mod = load();
      const set2 = mod?.KNOWN_SESSION_EVENT_TYPES;
      if (set2 !== void 0 && typeof set2.add === "function") {
        set2.add(FEMO_CHAT_TYPE);
        for (const legacy of LEGACY_FEMO_EVENT_TYPES) set2.add(legacy);
        const ok = set2.has(FEMO_CHAT_TYPE);
        console.log(`[femo-plugin][native] runtime whitelist registration: femo-plugin/chat ${ok ? "registered" : "failed"}${hostPath !== void 0 ? ` (host copy: ...${hostPath.slice(-60)})` : " (plugin-local copy)"} (+${LEGACY_FEMO_EVENT_TYPES.length} legacy femo types)`);
        return { ok, hostPath };
      }
    } catch {
    }
  }
  console.log("[femo-plugin][native] runtime whitelist registration unavailable; persistence gate stays conservative");
  return { ok: false, hostPath: void 0 };
}
async function verifyHostWhitelistView(hostPath) {
  if (hostPath === void 0) return true;
  try {
    const { pathToFileURL } = await import("node:url");
    const ns = await import(pathToFileURL(hostPath).href);
    const ok = ns?.KNOWN_SESSION_EVENT_TYPES?.has(FEMO_CHAT_TYPE) === true;
    if (!ok) console.log("[femo-plugin][native] ESM view of the whitelist lacks femo-plugin/chat \u2014 downgrading persistence gate");
    return ok;
  } catch {
    return true;
  }
}
function installNativeWindowing(ctx, opts) {
  nativeState.native = opts.native;
  if (!opts.native) return;
  const registration = registerRuntimeWhitelist();
  nativeState.mainChatSafe = registration.ok;
  void mkdir(opts.mirrorDir, { recursive: true }).catch((error) => {
    console.log(`[femo-plugin][native] mirror dir create failed: ${String(error)}`);
  });
  if (registration.ok) {
    void verifyHostWhitelistView(registration.hostPath).then((ok) => {
      if (!ok) {
        nativeState.mainChatSafe = false;
        console.log("[femo-plugin][native] persistence gate downgraded to window-only (ESM view mismatch)");
      }
    });
  }
  ctx.on("session/event", (session, event) => {
    if (!String(session.id).startsWith(WINDOW_ID_PREFIX)) return;
    if (replaying.has(String(session.id))) return;
    if (!isHubAnchorEvent(event)) return;
    mirrorEnqueue(opts.mirrorDir, String(session.id), event);
  });
  ctx.on("session/created", (session) => {
    if (!String(session.id).startsWith(WINDOW_ID_PREFIX)) return;
    void replayWindow(session, opts.mirrorDir);
  });
  console.log(`[femo-plugin][native] native dsh build: projection windows ${nativeState.mainChatSafe ? "durable (agent-loop created, native persistence)" : "live-only + mirror-restored"}; main-session femo-plugin/chat ${nativeState.mainChatSafe ? "allowed (event type whitelisted in this build)" : "suppressed (event type NOT in persistence whitelist)"}`);
}
function broadcastCompat(ctx, session, projections, text) {
  if (nativeState.native && !nativeState.mainChatSafe) {
    appendChatProjected(ctx, session, projections, text, "sys");
    return;
  }
  appendChatBroadcast(ctx, session, projections, text);
}
function projectedCompat(ctx, session, projections, text, kind, actor, visible, alsoMainSession = false) {
  const mainAllowed = !nativeState.native || nativeState.mainChatSafe;
  appendChatProjected(ctx, session, projections, text, kind, actor, visible, alsoMainSession && mainAllowed);
}

// host/engine-transcript.ts
function blocksToText(content) {
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    const b = block;
    if (b.type === "text" && typeof b.text === "string") return b.text;
    if (b.type === "tool-result" && Array.isArray(b.content)) return blocksToText(b.content);
    return "";
  }).join("");
}
function buildTranscript(events) {
  const buckets = /* @__PURE__ */ new Map();
  const bucketOf = (step) => {
    let b = buckets.get(step);
    if (b === void 0) {
      b = { cot: [], reply: [], calls: [], results: [] };
      buckets.set(step, b);
    }
    return b;
  };
  let output = "";
  for (const event of events) {
    if (event.type === "assistant/message") {
      const data = event.data;
      const content = data.message?.content;
      if (!Array.isArray(content)) continue;
      const step = typeof data.step === "number" ? data.step : 0;
      const b = bucketOf(step);
      const text = content.filter((b2) => b2.type === "text").map((b2) => String(b2.text ?? "")).join("");
      const reasoning = content.filter((b2) => b2.type === "reasoning").map((b2) => String(b2.text ?? "")).join("");
      if (reasoning.length > 0) b.cot.push(reasoning);
      if (text.length > 0) {
        b.reply.push(text);
        output = text;
      }
    } else if (event.type === "tool/call") {
      const data = event.data;
      const step = typeof data.step === "number" ? data.step : 0;
      bucketOf(step).calls.push({
        name: typeof data.name === "string" ? data.name : "",
        arguments: typeof data.arguments === "string" ? data.arguments : ""
      });
    } else if (event.type === "tool/result") {
      const data = event.data;
      const step = typeof data.step === "number" ? data.step : 0;
      const message = data.message;
      if (message === void 0) continue;
      const content = message.content;
      const items = Array.isArray(content) ? content : [];
      for (const block of items) {
        const bl = block;
        if (bl.type !== "tool-result") continue;
        const text = typeof bl.text === "string" ? bl.text : blocksToText(bl.content);
        if (text.length > 0) bucketOf(step).results.push(text);
      }
    }
  }
  const steps = [...buckets.keys()].sort((a, b) => a - b).map((step) => {
    const b = buckets.get(step);
    return {
      step,
      cot: b.cot.join("\n\n"),
      reply: b.reply.join("\n\n"),
      tool_calls: b.calls,
      tool_results: b.calls.length > 0 || b.results.length > 0 ? b.results : []
    };
  });
  return { output, steps };
}

// host/compat/plugin-source.ts
var FEMO_PLUGIN_KIND = "plugin:femo-plugin";
var FEMO_PLUGIN_SOURCE = { kind: FEMO_PLUGIN_KIND };
function pluginSourceName(source) {
  if (source === null || typeof source !== "object") return void 0;
  const record = source;
  if (typeof record.kind === "string" && record.kind.startsWith("plugin:")) {
    return record.kind.slice("plugin:".length);
  }
  if (record.kind === "plugin" && typeof record.plugin === "string") return record.plugin;
  return void 0;
}

// host/hub/god-mirror.ts
var MIRROR_MAIN_EVENTS = /* @__PURE__ */ new Set([
  "turn/start",
  "step/start",
  "step/end",
  "turn/end",
  "assistant/message",
  "tool/call",
  "tool/result",
  "user/message"
]);
function hubContentOf(data) {
  if (Array.isArray(data.content)) return data.content;
  return data.message?.content;
}
function createGodMirror(deps) {
  const hubToolNames = /* @__PURE__ */ new Map();
  const MEOW_BAN_UNTIL_TURN_END = -1;
  const meowBannedTurns = /* @__PURE__ */ new Map();
  const sidCurTurn = /* @__PURE__ */ new Map();
  const MEOW_DIRECTIVE_MARKERS = [
    "[meow-memory-reflect]",
    "[meow-memory-dream]",
    "\u3010\u8BB0\u5FC6\u6574\u7406\u6807\u8BB0\u3011",
    // 旧 delegate 打点（v0.23 遗留识别，与 meow-memory 自身口径一致）
    "\u3010\u8BB0\u5FC6\u53CD\u601D\u6807\u8BB0\u3011",
    "\u3010\u8BB0\u5FC6\u53CD\u601D\u5B8C\u6210\u6807\u8BB0\u3011"
  ];
  const hubTurnBuf = /* @__PURE__ */ new Map();
  function hubTurnBufOf(sid, turn) {
    const buf = hubTurnBuf.get(sid);
    if (buf !== void 0) {
      if (buf.turn !== turn) {
        flushHubTurnBuf(sid);
        return hubTurnBufOf(sid, turn);
      }
      return buf;
    }
    const fresh = { turn, items: [] };
    hubTurnBuf.set(sid, fresh);
    return fresh;
  }
  function flushHubTurnBuf(sid) {
    const buf = hubTurnBuf.get(sid);
    hubTurnBuf.delete(sid);
    hubHostSegClose(sid, buf?.items ?? []);
  }
  function ensureHostSeg(sid, seq, turn) {
    if (hubHostSegCurrent(sid) !== void 0) return;
    hubHostSegOpen(sid, { seq: `a${seq}`, turn: Number.isFinite(turn) ? turn : void 0 });
  }
  function hubFeedMainEvent(sid, event) {
    try {
      const data = event.data;
      const mT = Number(data.turn);
      const mTn = Number.isFinite(mT) ? mT : -1;
      const srcSeq = `main:${sid}:${event.seq}`;
      const turnField = Number.isFinite(mT) ? { turn: mT } : {};
      const meowBan = meowBannedTurns.get(sid);
      if (meowBan !== void 0) {
        if (event.type === "turn/end") {
          meowBannedTurns.delete(sid);
          return;
        }
        if (meowBan === MEOW_BAN_UNTIL_TURN_END || mTn === meowBan) return;
      }
      if (event.type === "user/message") {
        const srcKind = data.source?.kind;
        const isHuman = srcKind === void 0 || srcKind === "user";
        const text = typeof data.text === "string" && data.text.trim() !== "" ? data.text : blocksToText(hubContentOf(data));
        if (deps.isMainActorNotice?.(sid, text) === true) return;
        if (srcKind !== "user" && MEOW_DIRECTIVE_MARKERS.some((m) => text.includes(m))) {
          meowBannedTurns.set(sid, sidCurTurn.get(sid) ?? MEOW_BAN_UNTIL_TURN_END);
          return;
        }
        if (pluginSourceName(data.source) === "meow-memory") return;
        if (meowBan !== void 0) {
          if (isHuman) meowBannedTurns.delete(sid);
          else return;
        }
        if (text.trim() !== "") {
          hubFeedRow(sid, {
            zone: "outside",
            kind: "whisper",
            actor: isHuman ? "\u7528\u6237" : "\u63D2\u4EF6",
            ...isHuman ? { role: "human" } : { role: "plugin" },
            text,
            ...turnField,
            src_seq: srcSeq
          });
        }
        hubHostSegOpen(sid, { seq: event.seq, turn: Number.isFinite(mT) ? mT : void 0 });
        return;
      }
      if (Number.isFinite(mT) && deps.mainActorSceneActor?.(sid, mT) !== void 0) return;
      if (event.type === "assistant/message" || event.type === "tool/call") {
        ensureHostSeg(sid, event.seq, mTn);
      }
      if (event.type === "assistant/message") {
        const content = hubContentOf(data);
        if (!Array.isArray(content)) return;
        const buf = hubTurnBufOf(sid, mTn);
        for (const block of content) {
          const bl = block;
          const t = String(bl.text ?? "");
          if (bl.type === "reasoning" && t.trim() !== "") {
            buf.items.push({ kind: "cot", text: t });
          } else if (bl.type === "text" && t.trim() !== "") {
            buf.items.push({ kind: "say", text: t });
          }
        }
        return;
      }
      if (event.type === "tool/call") {
        const name2 = typeof data.name === "string" ? data.name : "";
        if (typeof data.callId === "string" && name2 !== "") {
          if (hubToolNames.size > 1e3) hubToolNames.clear();
          hubToolNames.set(data.callId, name2);
        }
        hubTurnBufOf(sid, mTn).items.push({
          kind: "tool",
          text: "",
          toolCall: { name: name2 || "unknown", arguments: typeof data.arguments === "string" ? data.arguments : "" }
        });
        return;
      }
      if (event.type === "tool/result") {
        const callId = typeof data.message?.source?.callId === "string" ? data.message.source.callId : void 0;
        const name2 = callId !== void 0 ? hubToolNames.get(callId) : void 0;
        const items = Array.isArray(data.message?.content) ? data.message.content : [];
        let text = "";
        for (const block of items) {
          const bl = block;
          if (bl.type !== "tool-result") continue;
          text = typeof bl.text === "string" ? bl.text : blocksToText(bl.content);
          if (text.trim() !== "") break;
        }
        if (text.trim() === "") return;
        hubTurnBufOf(sid, mTn).items.push({
          kind: "tool_result",
          text: "",
          toolResult: { node: name2 ?? "", output: text }
        });
        return;
      }
      if (event.type === "turn/end") {
        flushHubTurnBuf(sid);
      }
    } catch {
    }
  }
  function mirrorMainEventToGod(sid, event) {
    if (event.type === "turn/start") {
      const t = Number(event.data?.turn);
      sidCurTurn.set(sid, Number.isFinite(t) ? t : MEOW_BAN_UNTIL_TURN_END);
      return;
    }
    if (event.type === "user/message" || event.type === "assistant/message" || event.type === "tool/call" || event.type === "tool/result" || event.type === "turn/end") {
      hubFeedMainEvent(sid, event);
    }
  }
  const femoFedSids = /* @__PURE__ */ new Set();
  function registerRealtimeListener(ctx) {
    ctx.on("session/event", (session, event) => {
      if (session.header.parentSession !== void 0) return;
      if (!MIRROR_MAIN_EVENTS.has(event.type)) return;
      const sid = String(session.id);
      if (!femoFedSids.has(sid) && !isFemoSession(sid, session)) return;
      femoFedSids.add(sid);
      mirrorMainEventToGod(sid, event);
    });
  }
  return { registerRealtimeListener };
}

// host/events/engine-events.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// ../../femo2host/host/subagent-core.mjs
var turnBaseBySession = /* @__PURE__ */ new Map();
var TURN_BASE_EPOCH = Math.floor(Date.now() / 1e3);
var actorUsageBySession = /* @__PURE__ */ new Map();
var ACTOR_CONTEXT_WINDOW_FALLBACK = 1e6;
var FORWARD_CHILD_EVENTS = /* @__PURE__ */ new Set([
  "turn/start",
  "step/start",
  "assistant/chunk",
  "assistant/message",
  "tool/call",
  "tool/result",
  "step/end",
  "turn/end"
]);
var activeSubagents = /* @__PURE__ */ new Set();
var activeChildRuns = /* @__PURE__ */ new Map();
var runControlAborted = /* @__PURE__ */ new WeakSet();
function abortEntry(entry, reason) {
  if (entry.controller.signal.aborted) return false;
  runControlAborted.add(entry.controller);
  entry.interrupt?.();
  entry.controller.abort(new Error(reason));
  return true;
}
function abortJobSubagents(jobId, reason) {
  let aborted = 0;
  for (const entry of [...activeSubagents]) {
    if (entry.jobId !== jobId) continue;
    if (abortEntry(entry, reason)) aborted += 1;
  }
  return aborted;
}
function abortAllSubagents(reason) {
  let aborted = 0;
  for (const entry of [...activeSubagents]) {
    if (abortEntry(entry, reason)) aborted += 1;
  }
  return aborted;
}
async function readSoulPersona(bridge, soulId) {
  try {
    const res = await bridge.send("get_soul", { soul_id: soulId }, 15e3);
    return typeof res?.description === "string" ? res.description : "";
  } catch (error) {
    console.log(`[femo-plugin] read soul persona failed (soul_id=${soulId}): ${String(error)} \u2014 actor runs in standard mode`);
    return "";
  }
}
var KNOWN_BLOCK_KEYS = /* @__PURE__ */ new Set([
  "basic_safety",
  "basic_output",
  "user_info",
  "context",
  "prompt",
  "memory",
  "showprompt",
  "soul",
  "_actor_info"
]);
function buildSubagentPrompt(blocks) {
  const str = (key) => typeof blocks[key] === "string" ? String(blocks[key]) : "";
  const system = [str("basic_safety"), str("basic_output"), str("user_info")].filter(Boolean).join("\n\n");
  const promptRaw = str("prompt");
  const showprompt = str("showprompt");
  const prompt = showprompt ? `[\u63D0\u9192]
${showprompt}

${promptRaw}` : promptRaw;
  const parts = [str("context"), prompt];
  const memory = str("memory");
  if (memory.length > 0) {
    parts.push("---\n[\u56DE\u5FC6]\n\u6839\u636E\u4EE5\u4E0A\u60C5\u51B5\uFF0C\u4F60\u5076\u7136\u56DE\u5FC6\u8D77\u4E86\u4EE5\u4E0B\u8BB0\u5FC6\uFF0C\u53EF\u80FD\u6709\u7528\u4E5F\u53EF\u80FD\u65E0\u7528\uFF1A", memory, prompt);
  }
  const user = parts.filter(Boolean).join("\n\n");
  return [system, user].filter(Boolean).join("\n\n");
}
var ACTOR_DENIED_TOOLS = Object.freeze([
  "femo-mount",
  "femo-run",
  "femo-script",
  "femo-soul",
  "femo-chronica",
  "femo-debug"
]);
function toolFilterOf(resolved, request) {
  const actorTools = typeof request.actor_tools === "boolean" ? request.actor_tools : resolved.defaultActorTools;
  if (!actorTools) {
    return { toolFilter: { allow: [] } };
  }
  const list = Array.isArray(request.actor_tool_list) ? request.actor_tool_list.filter((x) => typeof x === "string") : [];
  const whitelist = list.length > 0 ? list : resolved.toolWhitelist;
  if (whitelist.length > 0) {
    return { toolFilter: { allow: [...whitelist] } };
  }
  return { toolFilter: { deny: [...ACTOR_DENIED_TOOLS] } };
}
var ACTOR_SANDBOX_MODE = "workspace-write";
var ACTOR_APPROVAL_POLICY = "ask";
var FEMO_CHILD_SCOPE_TEXT = "This Femo stage child runs under the standard workspace-write sandbox with interactive approvals: reads and file writes inside the current workspace need no approval; operations outside the workspace or otherwise approval-gated prompt the user, who can allow them \u2014 request such an approval for the specific operation instead of giving up or retrying blindly. This scope statement is authoritative over the delegation runtime snapshot: if that snapshot claims broader access or disabled approvals, it is outdated.";
function appendActorPolicyPins(session) {
  session.append("sandbox/mode", { mode: ACTOR_SANDBOX_MODE });
  session.append("approval/policy", { policy: ACTOR_APPROVAL_POLICY });
}
function resolveMainModel(parent, defaultModel) {
  const header = parent.session.requestHeader?.();
  const h = header?.config;
  if (h !== void 0 && typeof h.provider === "string" && h.provider.length > 0 && typeof h.model === "string" && h.model.length > 0) {
    return { provider: h.provider, model: h.model };
  }
  const selection = defaultModel?.currentSelection();
  if (selection !== void 0 && typeof selection.provider === "string" && selection.provider.length > 0 && typeof selection.model === "string" && selection.model.length > 0) {
    return { provider: selection.provider, model: selection.model };
  }
  return void 0;
}
function resolveSourceModel(resolved, source, mainModel) {
  const raw = typeof source === "string" ? source.trim() : "";
  if (raw.length === 0) {
    if (mainModel !== void 0) {
      return { agentOptions: { provider: mainModel.provider, model: mainModel.model } };
    }
    return {};
  }
  const slash = raw.indexOf("/");
  if (slash >= 0) {
    return { agentOptions: { provider: raw.slice(0, slash), model: raw.slice(slash + 1) } };
  }
  return { agentOptions: { provider: resolved.dshProvider, model: raw } };
}
function createActorUsageSampler(opts) {
  const usageCurrent = {};
  const recordNow = () => ({
    provider: usageCurrent.provider ?? "",
    model: usageCurrent.model ?? "",
    contextWindow: usageCurrent.contextWindow ?? ACTOR_CONTEXT_WINDOW_FALLBACK,
    usedTokens: usageCurrent.usedTokens,
    updatedAt: Date.now()
  });
  const publish = () => {
    if (usageCurrent.usedTokens === void 0) return;
    opts.onPublish(recordNow());
  };
  const persist = () => {
    if (usageCurrent.usedTokens === void 0) return;
    opts.onPersist(recordNow());
  };
  const applyUsage = (usage) => {
    if (usage === void 0 || typeof usage !== "object") return;
    const input = typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
    const cacheRead = typeof usage.cacheReadTokens === "number" ? usage.cacheReadTokens : 0;
    const cacheWrite = typeof usage.cacheWriteTokens === "number" ? usage.cacheWriteTokens : 0;
    usageCurrent.usedTokens = input + cacheRead + cacheWrite;
    publish();
  };
  const capture = (event) => {
    if (event.type === "request/context") {
      const d = event.data ?? {};
      if (typeof d.provider === "string") usageCurrent.provider = d.provider;
      if (typeof d.model === "string") usageCurrent.model = d.model;
      if (typeof d.contextWindow === "number" && d.contextWindow > 0) usageCurrent.contextWindow = d.contextWindow;
      return;
    }
    const data = event.data ?? {};
    applyUsage(event.type === "assistant/chunk" && data.chunk?.type === "usage" ? data.chunk.usage : event.type === "assistant/message" ? data.usage : void 0);
  };
  const modelIdNow = () => {
    const actualProvider = typeof usageCurrent.provider === "string" ? usageCurrent.provider : "";
    const actualModel = typeof usageCurrent.model === "string" ? usageCurrent.model : "";
    return actualProvider && actualModel ? `${actualProvider}/${actualModel}` : actualModel || actualProvider || "";
  };
  return { capture, applyUsage, publish, persist, modelIdNow, current: usageCurrent };
}

// host/actor-name.ts
function actorNameOf(src) {
  if (src === void 0) return "";
  const name2 = src.actor_name;
  return typeof name2 === "string" ? name2 : "";
}
function soulIdentityOf(src) {
  if (src === void 0) return "";
  const info = src.actor_info;
  const soul = info?.soul;
  return typeof soul === "string" ? soul.trim() : "";
}

// host/actors/main/capture.ts
function debugLogMainActor(resolved, line) {
  appendDebugLog(
    resolved.femoRoot,
    "debug-main-actor.log",
    "[" + (/* @__PURE__ */ new Date()).toISOString() + "] " + line
  );
}
var pending = /* @__PURE__ */ new Map();
function rearmPending(sid, fields, resolve2) {
  pending.set(sid, {
    waitKey: fields.waitKey,
    nodeName: fields.nodeName,
    actor: fields.actor,
    soul: fields.soul,
    jobId: fields.jobId,
    scopes: fields.scopes,
    buffer: [],
    sawTurnStart: false,
    notice: fields.notice,
    noticeEntered: false,
    noticeEnteredClean: false,
    stepEnded: false,
    userMessageInTurn: false,
    firstAdmitted: "none",
    settled: false,
    resolve: resolve2 ?? (() => {
    }),
    ...fields.showprompt !== void 0 ? { showprompt: fields.showprompt } : {}
  });
}
function takePending(sid) {
  const p = pending.get(sid);
  if (p !== void 0) pending.delete(sid);
  return p;
}
function peekPending(sid) {
  return pending.get(sid);
}
function mainActorSceneActor(sid, turn) {
  const p = pending.get(sid);
  if (p === void 0 || p.settled) return void 0;
  if (p.turn !== void 0 && p.turn !== turn) return void 0;
  return p.actor;
}
function isMainActorNotice(sid, text) {
  const p = pending.get(sid);
  return p !== void 0 && p.notice.length > 0 && text === p.notice;
}
function isMainAnswerPending(sid) {
  return pending.has(sid);
}
function pendingNodeName(sid) {
  return pending.get(sid)?.nodeName ?? "";
}
function userMessageTextOf(event) {
  const d = event.data ?? {};
  const content = Array.isArray(d.content) ? d.content : Array.isArray(d.message?.content) ? d.message.content : [];
  let out = "";
  for (const part of content) {
    if (part?.type === "text" && typeof part.text === "string") out += part.text;
  }
  return out;
}
function isRealUserMessage(event) {
  const d = event.data ?? {};
  return d.source?.kind === "user";
}
function captureVerdict(f) {
  if (!f.noticeEntered) return "wait";
  if (f.firstAdmitted !== "ours") return "requeue";
  if (!f.noticeEnteredClean || f.userMessageInTurn) return "requeue";
  return "settle";
}

// host/verbs.ts
import { randomUUID } from "node:crypto";
function steerMainAgent(ctx, sessionId, text) {
  try {
    const sid = String(sessionId);
    const bag = ctx;
    const viaProp = bag.agents?.get(sid);
    const viaSvc = typeof bag.get === "function" ? bag.get("agents")?.get(sid) : void 0;
    const agent = viaProp ?? viaSvc;
    if (agent === void 0 || typeof agent.steer !== "function") {
      console.log(`[femo-plugin] steer skipped (main agent unavailable): sid=${sid}`);
      return;
    }
    agent.steer({
      id: randomUUID(),
      role: "user",
      content: [{ type: "text", text }],
      source: FEMO_PLUGIN_SOURCE
    });
    console.log(`[femo-plugin] steered main agent: sid=${sid} len=${text.length}`);
  } catch (error) {
    console.log(`[femo-plugin] steer failed: ${String(error)}`);
  }
}
function followupMain(ctx, sessionId, text) {
  try {
    const sid = String(sessionId);
    const bag = ctx;
    const viaProp = bag.agents?.get(sid);
    const viaSvc = typeof bag.get === "function" ? bag.get("agents")?.get(sid) : void 0;
    const agent = viaProp ?? viaSvc;
    if (agent === void 0 || typeof agent.followup !== "function") {
      console.log(`[femo-plugin] followup skipped (main agent unavailable): sid=${sid}`);
      return;
    }
    agent.followup({
      id: randomUUID(),
      role: "user",
      content: [{ type: "text", text }],
      source: { kind: "user" }
    });
    console.log(`[femo-plugin] followed up main agent: sid=${sid} len=${text.length}`);
  } catch (error) {
    console.log(`[femo-plugin] followup failed: ${String(error)}`);
  }
}

// ../../femo2host/host/node-retry.mjs
var PARK_TIMEOUT_MS = 15 * 6e4;
var SET_VARIABLE_TEACHING = "\u9700\u8981 SET VARIABLE \u7684\u8282\u70B9\u628A\u8D4B\u503C\u53E6\u8D77\u4E00\u884C\u5199\u5728\u53F0\u8BCD\u672B\u5C3E\uFF08\u5FC5\u987B\u72EC\u5360\u4E00\u884C\u624D\u88AB\u5F15\u64CE\u8BC6\u522B\uFF09";
function RETRY_STEER_TEXT(attempt, message) {
  return `[femo-plugin\xB7\u8282\u70B9\u91CD\u8BD5] \u4F60\u4E0A\u4E00\u8F6E\u7684\u8F93\u51FA\u672A\u901A\u8FC7FEMO\u811A\u672C\u6821\u9A8C\uFF08\u7B2C ${attempt} \u6B21\u53CD\u9988\uFF09\uFF1A
${message}
\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5168\u90E8\u8FC7\u7A0B\u4FEE\u6B63\u5E76\u91CD\u65B0\u8F93\u51FA\u672C\u8282\u70B9\u53F0\u8BCD\uFF08${SET_VARIABLE_TEACHING}\uFF09\u3002`;
}
function guardedSteer(parker, text, tag) {
  try {
    parker.steer(text);
  } catch (error) {
    console.log(`[femo-plugin] steer guard (${tag}): ${String(error)}`);
  }
}
var NodeRetryBroker = class {
  constructor() {
    this.parkers = /* @__PURE__ */ new Map();
  }
  /** 持久登记（幂等：同 waitKey 已存在则跳过——首次登记权威）。 */
  register(spec) {
    if (this.parkers.has(spec.waitKey)) return;
    this.parkers.set(spec.waitKey, { ...spec, state: "idle" });
  }
  /** 停靠点（仅 subagent/main 调用；human 不 park——引擎在自己的人类重等
   *  循环里等输入）。已暂存裁决 → 立即返回；否则置 parked 并武装 15min 超时。 */
  park(waitKey) {
    const p = this.parkers.get(waitKey);
    if (p === void 0) {
      console.log(`[femo-plugin] park without registration: wait_key=${waitKey}`);
      return Promise.resolve({ kind: "aborted" });
    }
    if (p.pending !== void 0) {
      const verdict = p.pending;
      p.pending = void 0;
      return Promise.resolve(verdict);
    }
    return new Promise((resolve2) => {
      p.resolve = resolve2;
      p.state = "parked";
      p.timer = setTimeout(() => {
        console.log(`[femo-plugin] node-retry park timeout (${Math.round(PARK_TIMEOUT_MS / 6e4)}min): wait_key=${waitKey} node=${p.nodeName}`);
        p.resolve = void 0;
        p.state = "idle";
        p.timer = void 0;
        resolve2({ kind: "aborted" });
      }, PARK_TIMEOUT_MS);
    });
  }
  /** node_retry 信号的入口。按 kind 分发：
   *  - human → 租约即翻译：显示到人类输入的地方，引擎在自己的人类重等循环
   *    里等重输，宿主零额外机制；
   *  - subagent/main → parked 则 resolve(retry)，否则暂存 pending。
   *  ⚠️ 对 subagent/main 只 resolve/pending，不代调租约——steer 的调用时机
   *  =停靠循环收到 verdict 之后（漏调=重试永远空转）。 */
  deliverRetry(waitKey, feedback, attempt, actorName) {
    const p = this.parkers.get(waitKey);
    if (p === void 0) {
      console.log(`[femo-plugin] node_retry without parker (dropped; engine 3600s timeout covers): wait_key=${waitKey} attempt=${attempt}`);
      return;
    }
    if (p.kind === "human") {
      guardedSteer(p, feedback, `node_retry human ${waitKey}`);
      return;
    }
    const verdict = { kind: "retry", feedback, attempt, actorName };
    if (p.state === "parked" && p.resolve !== void 0) {
      this.clearTimer(p);
      const resolve2 = p.resolve;
      p.resolve = void 0;
      p.state = "idle";
      resolve2(verdict);
    } else {
      p.pending = verdict;
    }
  }
  /** 停靠循环统一经租约 steer 的出口（循环体不直接触碰执行者）。 */
  steerLease(waitKey, text) {
    const p = this.parkers.get(waitKey);
    if (p === void 0) return;
    guardedSteer(p, text, `lease ${waitKey}`);
  }
  /** node_settled 信号（ai/human 同发）→ resolve(done) + 清 timer（幂等）。
   *  human 不暂存 pending（human 不 park，无消费者）。 */
  markSettled(waitKey) {
    const p = this.parkers.get(waitKey);
    if (p === void 0) return;
    this.clearTimer(p);
    if (p.kind === "human") return;
    if (p.state === "parked" && p.resolve !== void 0) {
      const resolve2 = p.resolve;
      p.resolve = void 0;
      p.state = "idle";
      resolve2({ kind: "done" });
    } else {
      p.pending = { kind: "done" };
    }
  }
  /** 全场放行（flow_paused/flow_error/bridge_run_ended/桥死亡）：所有 parker
   *  resolve(aborted) 并清空登记（引擎已停，剩余停靠无意义；幂等）。 */
  abortAll(reason) {
    for (const [waitKey, p] of [...this.parkers]) {
      this.clearTimer(p);
      if (p.state === "parked" && p.resolve !== void 0) {
        const resolve2 = p.resolve;
        p.resolve = void 0;
        resolve2({ kind: "aborted" });
      }
      this.parkers.delete(waitKey);
    }
    if (reason.length > 0) console.log(`[femo-plugin] node-retry abortAll: ${reason}`);
  }
  /** Job 域放行：只 abort 本 Job 的 parker——flow_paused/flow_error 清场用，
   *  不误杀其他会话在飞角色（abortAll 保留给桥死亡/卸载全场场景）。 */
  abortJob(jobId, reason) {
    for (const [waitKey, p] of [...this.parkers]) {
      if (p.jobId !== jobId) continue;
      this.clearTimer(p);
      if (p.state === "parked" && p.resolve !== void 0) {
        const resolve2 = p.resolve;
        p.resolve = void 0;
        resolve2({ kind: "aborted" });
      }
      this.parkers.delete(waitKey);
    }
    if (reason.length > 0) console.log(`[femo-plugin] node-retry abortJob(${jobId}): ${reason}`);
  }
  has(waitKey) {
    return this.parkers.has(waitKey);
  }
  /** 各方 finally 兜底清登记（幂等防泄漏）。 */
  unregister(waitKey) {
    const p = this.parkers.get(waitKey);
    if (p === void 0) return;
    this.clearTimer(p);
    this.parkers.delete(waitKey);
  }
  /** 卸载：清全部状态（在飞 timer 一并清）。 */
  dispose() {
    this.abortAll("broker disposed");
  }
  clearTimer(p) {
    if (p.timer !== void 0) {
      clearTimeout(p.timer);
      p.timer = void 0;
    }
  }
};

// host/node-retry.ts
var NodeRetryBroker2 = class extends NodeRetryBroker {
};
var broker = new NodeRetryBroker2();

// ../../femo2host/host/delivery-queue.mjs
var MainDeliveryQueue = class {
  /** 主会话最近一次轮开启记下的轮号（有轮在飞；轮收口删条目）。 */
  open = /* @__PURE__ */ new Map();
  /** 排队中的交付件（FIFO，按会话）。 */
  queued = /* @__PURE__ */ new Map();
  /** 轮开启：本会话有轮在飞。 */
  noteTurnStart(sid, turn) {
    this.open.set(sid, turn);
  }
  /** 轮收口（此后交付立即放行，直到下一次轮开启）。 */
  noteTurnEnd(sid) {
    this.open.delete(sid);
  }
  /** 在飞轮号（无 → undefined；日志/诊断用）。 */
  openTurn(sid) {
    return this.open.get(sid);
  }
  /** 排队条数。 */
  queuedCount(sid) {
    return this.queued.get(sid)?.length ?? 0;
  }
  /** 投递一条交付件：true = 立即交付（无轮在飞），false = 已排队等本轮收口。 */
  offer(sid, item) {
    if (this.open.get(sid) === void 0) return true;
    this.enqueue(sid, item);
    return false;
  }
  /** 显式入队（2026-09-23）：调用方已判定"必须排队"（账本说轮在飞 / driver
   *  实际忙）——只入队，不查轮开闭、不去重。与 offer 的分工：offer 是"问一句
   *  能不能立即交付"，enqueue 是"我知道要排队，替我排上"。 */
  enqueue(sid, item) {
    let q = this.queued.get(sid);
    if (q === void 0) {
      q = [];
      this.queued.set(sid, q);
    }
    q.push(item);
  }
  /** 队首只读（交付前窥视：等待期间被作废 → 自然不再交付）。 */
  peek(sid) {
    return this.queued.get(sid)?.[0];
  }
  /** 轮收口：取队首一条（无 → undefined）。 */
  takeNext(sid) {
    const q = this.queued.get(sid);
    if (q === void 0 || q.length === 0) return void 0;
    const next = q.shift();
    if (q.length === 0) this.queued.delete(sid);
    return next;
  }
  /** 作废本会话排队件（FEMO脚本停止/出错）：返回被丢弃条目——调用方负责 resolve
   *  其交卷槽，防悬挂。轮开闭状态不动（用户可能还在说话）。 */
  dropAll(sid) {
    const q = this.queued.get(sid);
    this.queued.delete(sid);
    return q ?? [];
  }
  /** 按条件剔除排队件（节点收尾兜底：等它的那个人已经走了）。返回被剔除条目。 */
  dropWhere(sid, match) {
    const q = this.queued.get(sid);
    if (q === void 0 || q.length === 0) return [];
    const kept = [];
    const dropped = [];
    for (const item of q) (match(item) ? dropped : kept).push(item);
    if (kept.length === 0) this.queued.delete(sid);
    else this.queued.set(sid, kept);
    return dropped;
  }
  /** 彻底遗忘本会话（换场/卸载）：队列 + 轮开闭状态全清。 */
  forget(sid) {
    const dropped = this.dropAll(sid);
    this.open.delete(sid);
    return dropped;
  }
  /** 全清（卸载）。 */
  clear() {
    this.queued.clear();
    this.open.clear();
  }
};

// host/actors/main/delivery.ts
var deliveries = new MainDeliveryQueue();
function deliverMain(ctx, sid, d) {
  rearmPending(sid, {
    waitKey: d.waitKey,
    nodeName: d.nodeName,
    actor: d.actor,
    soul: d.soul,
    scopes: d.scopes,
    jobId: d.jobId,
    notice: d.text,
    ...d.showprompt !== void 0 ? { showprompt: d.showprompt } : {}
  }, d.resolve);
  steerMainAgent(ctx, sid, d.text);
}
function queueOrDeliverMain(ctx, resolved, sid, d) {
  const busy = mainDriverBusy(ctx, sid);
  const queuedByLedger = !deliveries.offer(sid, d);
  if (!queuedByLedger && !busy) {
    debugLogMainActor(resolved, `\u4EA4\u4ED8\u6CE8\u5165(via=${d.via}): node=${d.nodeName}\uFF08\u8D26\u672C\u65E0\u5728\u98DE\u8F6E + driver \u7A7A\u95F2 \u2192 \u7ACB\u5373 steer\uFF09`);
    deliverMain(ctx, sid, d);
    return;
  }
  if (!queuedByLedger) deliveries.enqueue(sid, d);
  const why = queuedByLedger ? "\u8D26\u672C\u8F6E\u5728\u98DE" : "driver \u5FD9";
  const open3 = deliveries.openTurn(sid);
  const line = `\u6CE8\u5165\u6392\u961F(via=${d.via}, ${why}): node=${d.nodeName} \u7B49\u4E3B\u4F1A\u8BDD\u7B2C ${open3 ?? "?"} \u8F6E\u6536\u53E3\uFF08\u961F\u5217 ${deliveries.queuedCount(sid)} \u6761\uFF09`;
  console.log(`[femo-plugin] ${line}`);
  debugLogMainActor(resolved, line);
  pushDiag("main-actor", `FEMO\u811A\u672C\u8282\u70B9\u300C${d.nodeName}\u300D\u7B49\u4E3B\u6A21\u578B\u628A\u5F53\u524D\u8FD9\u8F6E\u8BF4\u5B8C\uFF08\u7B2C ${open3 ?? "?"} \u8F6E\u6536\u53E3\u540E\u767B\u573A\uFF0Cvia=${d.via}\uFF09`);
}
function mainAgentOf(ctx, sid) {
  const bag = ctx;
  return bag.agents?.get(sid) ?? (typeof bag.get === "function" ? bag.get("agents")?.get(sid) : void 0);
}
function mainDriverBusy(ctx, sid) {
  const status = mainAgentOf(ctx, sid)?.status;
  return typeof status === "string" && status !== "idle";
}
function flushNextMainDelivery(ctx, resolved, sid) {
  if (deliveries.queuedCount(sid) === 0) return;
  tryDeliverNext(ctx, resolved, sid, 0);
}
function tryDeliverNext(ctx, resolved, sid, tries) {
  queueMicrotask(() => {
    const next = deliveries.peek(sid);
    if (next === void 0) return;
    if (mainDriverBusy(ctx, sid)) {
      if (tries < 40) {
        setTimeout(() => tryDeliverNext(ctx, resolved, sid, tries + 1), 50);
      } else {
        debugLogMainActor(resolved, `\u4EA4\u4ED8\u7B49\u5F85 driver \u7A7A\u95F2\u8D85\u65F6\uFF08${tries}\xD750ms\uFF09: node=${next.nodeName}`);
      }
      return;
    }
    if (deliveries.openTurn(sid) !== void 0) return;
    if (!broker.has(next.waitKey)) {
      const dropped = deliveries.dropWhere(sid, (d) => d === next);
      for (const d of dropped) d.resolve?.();
      const line = `\u6392\u961F\u6CE8\u5165\u4F5C\u5E9F\uFF08\u8282\u70B9\u5DF2\u6536\u5C3E/\u505C\u6B62\u8FD0\u884C\uFF09: node=${next.nodeName} wait_key=${next.waitKey}`;
      console.log(`[femo-plugin] ${line}`);
      debugLogMainActor(resolved, line);
      return;
    }
    const taken = deliveries.takeNext(sid);
    if (taken === void 0) return;
    debugLogMainActor(resolved, `\u8F6E\u6536\u53E3 \u2192 \u4EA4\u4ED8\u6392\u961F\u6CE8\u5165(via=${taken.via}): node=${taken.nodeName}`);
    pushDiag("main-actor", `\u8F6E\u6536\u53E3 \u2192 FEMO\u811A\u672C\u8282\u70B9\u300C${taken.nodeName}\u300D\u767B\u573A\uFF08via=${taken.via}\uFF09`);
    deliverMain(ctx, sid, taken);
  });
}
function requeueSwallowedInjection(ctx, resolved, sid, p, why) {
  takePending(sid);
  deliveries.enqueue(sid, {
    waitKey: p.waitKey,
    nodeName: p.nodeName,
    actor: p.actor,
    soul: p.soul,
    scopes: p.scopes,
    jobId: p.jobId,
    ...p.showprompt !== void 0 ? { showprompt: p.showprompt } : {},
    text: p.notice,
    via: "\u91CD\u6295",
    resolve: p.resolve
  });
  const line = `\u6CE8\u5165\u88AB\u541E(${why})\uFF1Anode=${p.nodeName} \u2192 \u9000\u56DE\u961F\u5217\uFF0C\u7B49\u4E0B\u4E00\u4E2A\u5E72\u51C0\u8F6E\u91CD\u6295`;
  console.log(`[femo-plugin] main injection swallowed (${why}): node=${p.nodeName}`);
  debugLogMainActor(resolved, line);
  flushNextMainDelivery(ctx, resolved, sid);
}
function dropMainDeliveries(sid, reason, resolved) {
  const dropped = deliveries.dropAll(sid);
  for (const d of dropped) d.resolve?.();
  if (dropped.length > 0) {
    const line = `\u6392\u961F\u6CE8\u5165\u4F5C\u5E9F(${reason}): ${dropped.length} \u6761 [${dropped.map((d) => d.nodeName).join(", ")}]`;
    console.log(`[femo-plugin] ${line}`);
    if (resolved !== void 0) debugLogMainActor(resolved, line);
  }
  return dropped.length;
}
function disposeMainDeliveries() {
  deliveries.clear();
}
function abandonMainAnswer(sid, reason, _projections) {
  dropMainDeliveries(sid, reason);
  const p = takePending(sid);
  if (p === void 0) return false;
  p.settled = true;
  p.resolve();
  console.log(`[femo-plugin] main-actor answer abandoned: node=${p.nodeName} (${reason})`);
  return true;
}

// host/actors/main/notice.ts
var mainActorNames = /* @__PURE__ */ new Map();
var flows = /* @__PURE__ */ new Map();
var waterMarks = /* @__PURE__ */ new Map();
var playNames = /* @__PURE__ */ new Map();
var queues = /* @__PURE__ */ new Map();
function clearMainPlayState(sid, name2, mainActors) {
  const inflight = takePending(sid);
  if (inflight !== void 0) {
    inflight.settled = true;
    inflight.resolve();
  }
  mainActorNames.delete(sid);
  flows.delete(sid);
  waterMarks.delete(sid);
  queues.delete(sid);
  dropMainDeliveries(sid, "\u6362\u573A\u6E05\u573A");
  if (name2.trim().length > 0) playNames.set(sid, name2.trim());
  else playNames.delete(sid);
  if (mainActors !== void 0 && mainActors.length > 0) {
    const set2 = /* @__PURE__ */ new Set();
    for (const n of mainActors) if (n.length > 0) set2.add(n);
    if (set2.size > 0) mainActorNames.set(sid, set2);
  }
}
function noteMainActor(sid, actorName) {
  if (actorName.length === 0) return;
  let set2 = mainActorNames.get(sid);
  if (set2 === void 0) {
    set2 = /* @__PURE__ */ new Set();
    mainActorNames.set(sid, set2);
  }
  set2.add(actorName);
}
function clearGuestActors(protectedOwners) {
  const keep = new Set(protectedOwners);
  for (const sid of [...mainActorNames.keys()]) {
    if (keep.has(sid)) continue;
    mainActorNames.delete(sid);
    flows.delete(sid);
    waterMarks.delete(sid);
  }
}
function isMainVisible(sid, scopes) {
  if (scopes === void 0 || scopes.length === 0) return true;
  const mains = mainActorNames.get(sid);
  if (mains === void 0) return false;
  return scopes.some((name2) => mains.has(name2));
}
function noteFlowLine(sid, actor, text, scopes) {
  if (text.length === 0) return -1;
  if (mainActorNames.get(sid)?.has(actor)) return -1;
  if (!isMainVisible(sid, scopes)) return -1;
  let list = flows.get(sid);
  if (list === void 0) {
    list = [];
    flows.set(sid, list);
  }
  list.push({ actor, text });
  return list.length;
}
function noteFlowLineAll(actor, text, scopes) {
  let counted = 0;
  for (const actorSid of mainActorNames.keys()) {
    if (noteFlowLine(actorSid, actor, text, scopes) >= 0) counted += 1;
  }
  return counted;
}
function mainRetrySteerText(play, nodeName, actor, attempt, feedback) {
  return `[femo-plugin\xB7\u8282\u70B9\u91CD\u8BD5] FEMO\u811A\u672C\u300A${play}\u300B\u8282\u70B9\u300C${nodeName}\u300D\uFF08\u4F60\u7684\u89D2\u8272\u662F ${actor}\uFF09\u7684\u4E0A\u4E00\u8F6E\u8F93\u51FA\u672A\u901A\u8FC7FEMO\u811A\u672C\u6821\u9A8C\uFF08\u7B2C ${attempt} \u6B21\u53CD\u9988\uFF09\uFF1A
${feedback}
\u8BF7\u91CD\u65B0\u8F93\u51FA\u8BE5\u8282\u70B9\u7684\u53F0\u8BCD\uFF08${SET_VARIABLE_TEACHING}\uFF09\u3002`;
}
function stageNotice(sid, nodeName, actor, prompt, delta, final, context = "") {
  const play = playNames.get(sid);
  const parts = final ? [`[femo-plugin\xB7\u8FD0\u884C\u7ED3\u675F\u8865\u9057] FEMO\u811A\u672C\u300A${play ?? "FEMO\u811A\u672C"}\u300B\u5DF2\u8DD1\u5B8C\uFF0C\u4EE5\u4E0B\u662F\u6700\u540E\u4E00\u622A\u4F60\u53EF\u89C1\u7684\u8FD0\u884C\u671F\u95F4\u53D1\u8A00\u3002`] : [`[femo-plugin\xB7\u8282\u70B9\u901A\u77E5] FEMO\u811A\u672C\u300A${play ?? "FEMO\u811A\u672C"}\u300B\u8FDB\u884C\u5230\u8282\u70B9\u300C${nodeName}\u300D\uFF0C\u8F6E\u5230 ${actor} \u8BF4\u8BDD\u3002`];
  const flowLines = delta.map((l) => `${l.actor}\uFF1A${l.text}`).join("\n");
  const field = context.trim().length > 0 ? context : flowLines;
  if (field.length > 0) parts.push(`\u3016\u573A\u4E0A\u4FE1\u606F\u3017
${field}`);
  if (!final) parts.push(`\u3016\u672C\u8282\u70B9\u6307\u4EE4\u3017
${prompt}`);
  if (!final) parts.push(`\u3016\u8981\u6C42\u3017\u73B0\u5728\u8F6E\u5230\u4F60\u7684\u8FD0\u884C\u4E2D\u56DE\u5408\uFF1A\u53EA\u8F93\u51FA\u53F0\u8BCD\u6B63\u6587\u3002${SET_VARIABLE_TEACHING}\u3002`);
  return parts.join("\n\n");
}
function flushMainFinalDelta(ctx, sessionId, resolved) {
  const sid = String(sessionId);
  const all = flows.get(sid) ?? [];
  const mark = waterMarks.get(sid) ?? 0;
  const delta = all.slice(mark);
  waterMarks.set(sid, all.length);
  if (delta.length === 0) return;
  const notice = stageNotice(sid, "", "", "", delta, true);
  steerMainAgent(ctx, sid, notice);
  debugLogMainActor(resolved, `\u8FD0\u884C\u7ED3\u675F\u8865\u9057\u6CE8\u5165: ${delta.length}\u6761 ${notice.length}ch`);
}

// host/hub/stream-frames.ts
function broadcastStreamChunk(base, chunk) {
  hubFeedChunk(base, chunk);
}
function broadcastActorStreamChunk(base, chunk) {
  broadcastStreamChunk(base, chunk);
}
function clearLiveBucket(base) {
  hubFeedClearBucket(base);
}
function onAssistantStreamFrames(ctx, handler) {
  const on = ctx.on;
  return on.call(ctx, "agent/assistant-stream", handler, { global: true });
}
var LiveStreamFrames = class {
  /**
   * @param base - 直播帧身份（sid/actor/node_name；step 逐帧覆盖）。
   * @param onChunk - 每个 chunk 帧的旁挂（如占用采样），不参与广播。
   */
  constructor(base, onChunk) {
    this.base = base;
    this.onChunk = onChunk;
  }
  orphan = false;
  /** 折叠一帧；非 chunk 帧只维护孤儿状态与回合状态行。 */
  frame(frame) {
    if (frame.type === "start") {
      if (this.orphan) this.clear();
      this.broadcastTurnStatus(true);
      return;
    }
    if (frame.type === "end") {
      const outcome = frame.outcome;
      if (outcome?.kind === "abandoned") {
        this.clear();
        return;
      }
      this.orphan = outcome?.eventType === "assistant/attempt";
      return;
    }
    if (frame.type !== "chunk" || frame.chunk === void 0) return;
    this.onChunk?.(frame.chunk);
    broadcastStreamChunk(this.baseFor(frame.step), frame.chunk);
  }
  /** 回合收口 → 熄灭本直播位的状态行（各路径在自己的 turn/end 处调用；幂等）。 */
  endTurn() {
    hubFeedEndTurn(this.base);
    this.broadcastTurnStatus(false);
  }
  /** 状态帧（前端按直播位点亮/熄灭「Deep diving…」）。【链路B 退役·2026-09-20
   *  大扫除】turn_status 帧整段删除（「正在…」由 hub 段 open 标记承担）；本方法
   *  只剩 trace——**收口接缝保留**：桥收口后若要恢复宿主侧信号即在此接。 */
  broadcastTurnStatus(running) {
  }
  /** 清本直播位（客户端删桶）。 */
  clear() {
    this.orphan = false;
    clearLiveBucket(this.base);
  }
  /** 帧自带步号优先（0.1.3 帧恒带 turn/step）；缺省回落本直播位的步号。 */
  baseFor(step) {
    const resolved = typeof step === "number" ? step : this.base.step;
    return resolved === void 0 ? this.base : { ...this.base, step: resolved };
  }
};

// ../../femo2host/host/api-retry.mjs
var RETRYABLE_CODES = /* @__PURE__ */ new Set([
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT",
  "EMPTY_RESPONSE"
]);
var SLOW_DELAYS_MS = [0, 2e4, 6e4, 18e4, 6e5];
var MAX_CONSECUTIVE_FAILURES = 5;
var ApiRetryChain = class {
  constructor() {
    this.attempts = /* @__PURE__ */ new Map();
    this.lifetime = new AbortController();
  }
  /**
   * 瀑布下游决策 + 排程（宿主 listener 翻译完事实后调用）。
   * @param {ApiRetryFact} fact
   * @param {ApiRetryDeps} deps
   * @param {() => unknown} pass  宿主的 next()（透传放行）
   * @returns {Promise<unknown>} pass() 的返回值 / {kind:'retry'} / undefined（见头注契约）
   */
  async handleFailure(fact, deps, pass) {
    const target = deps.resolveTarget(fact.childId);
    if (target === void 0) {
      this.attempts.delete(fact.childId);
      return pass();
    }
    if (fact.signal.aborted) return pass();
    if (!RETRYABLE_CODES.has(fact.failure.code)) return pass();
    const previous = this.attempts.get(fact.childId);
    const count = previous !== void 0 && previous.turn === fact.turn && previous.step === fact.step ? previous.count + 1 : 1;
    if (count > MAX_CONSECUTIVE_FAILURES) {
      this.attempts.delete(fact.childId);
      deps.onExhausted(target, fact.failure);
      return pass();
    }
    this.attempts.set(fact.childId, { turn: fact.turn, step: fact.step, count });
    const delayMs = SLOW_DELAYS_MS[count - 1] ?? 0;
    deps.onRetry(target, count, delayMs, fact.failure);
    const fused = AbortSignal.any([fact.signal, this.lifetime.signal]);
    if (fused.aborted) return void 0;
    const completed = await new Promise((resolve2) => {
      const timer = setTimeout(() => {
        fused.removeEventListener("abort", onAbort);
        resolve2(true);
      }, delayMs);
      function onAbort() {
        clearTimeout(timer);
        resolve2(false);
      }
      fused.addEventListener("abort", onAbort, { once: true });
    });
    if (!completed) return void 0;
    return { kind: "retry" };
  }
  /** 显式清某个 child 的失败计数（子代理/main 收尾路径可调用；幂等）。 */
  clearChild(childSessionId) {
    this.attempts.delete(childSessionId);
  }
  /** 宿主卸载（插件 dispose / HMR）：中止在飞延迟 + 清计数。 */
  dispose() {
    this.lifetime.abort(new Error("femo api-retry chain disposed"));
    this.attempts.clear();
  }
};
var apiRetry = new ApiRetryChain();

// host/api-retry.ts
var ApiRetryChain2 = class extends ApiRetryChain {
  install(ctx, deps) {
    const disposeListener = ctx.on("agent/request-error", async (payload, next) => {
      const verdict = await this.handleFailure({
        childId: String(payload.agent.session.id),
        turn: payload.turn,
        step: payload.step,
        signal: payload.signal,
        failure: { code: String(payload.failure.code), message: String(payload.failure.message) }
      }, deps, next);
      return verdict;
    });
    return () => {
      disposeListener();
      this.dispose();
    };
  }
};
var apiRetry2 = new ApiRetryChain2();

// ../../femo2host/host/speech-core.mjs
function humanSpeechArgs({ jobId, waitKey, soul, node, text, variables = {} }) {
  const cleanVars = {};
  for (const [k, v] of Object.entries(variables ?? {})) {
    if (typeof v === "string" && v.trim().length > 0) cleanVars[k] = v.trim();
  }
  return {
    job_id: jobId,
    wait_key: waitKey,
    soul: soul || "human",
    ...node ? { node } : {},
    payload: text,
    body: { chat_text: text, ...Object.keys(cleanVars).length > 0 ? { variables: cleanVars } : {} }
  };
}
function executorSpeechArgs({ jobId, waitKey, soul = "main", node, output, steps, modelId }) {
  const merged = (Array.isArray(steps) ? steps : []).map((s) => s && typeof s === "object" ? { ...s } : { reply: String(s ?? "") });
  if (merged.length > 0) {
    const last = merged[merged.length - 1];
    if (String(last.reply ?? "").trim().length === 0) last.reply = output;
  } else {
    merged.push({ step: 0, reply: output });
  }
  return {
    job_id: jobId,
    wait_key: waitKey,
    soul,
    ...node ? { node } : {},
    payload: output,
    body: {
      steps: merged,
      ...modelId === void 0 ? {} : { model_id: modelId }
    }
  };
}

// host/actors/main/index.ts
function runMainModelTurn(ctx, resolved, bridge, session, request, recordError, projections, nodeScopes, nodeShowprompts, jobId = -1) {
  const sid = String(session.id);
  const prev = queues.get(sid) ?? Promise.resolve();
  const call = prev.catch(() => void 0).then(
    () => runMainModelTurnInner(ctx, resolved, bridge, session, request, recordError, projections, nodeScopes, nodeShowprompts, jobId)
  );
  queues.set(sid, call.catch(() => void 0));
  return call;
}
async function runMainModelTurnInner(ctx, resolved, bridge, session, request, recordError, projections, nodeScopes, nodeShowprompts, jobId = -1) {
  const sid = String(session.id);
  const waitKey = String(request.wait_key ?? "");
  const nodeName = String(request.node_name ?? "");
  const actor = actorNameOf(request) || `@${nodeName}`;
  const soul = soulIdentityOf(request) || "main";
  const blocks = request.blocks ?? void 0;
  const prompt = typeof blocks?.prompt === "string" ? String(blocks.prompt) : "";
  const fieldContext = typeof blocks?.context === "string" ? String(blocks.context) : "";
  const scopes = nodeScopes?.get(nodeName);
  debugLogMainActor(resolved, `[\u5BBF\u4E3B] main \u8282\u70B9\u8FDB\u5165: node=${nodeName} actor=${actor} wait_key=${waitKey} \u573A\u4E0A\u4FE1\u606F=BC(${fieldContext.length}ch) \u6D41\u6C34=${flows.get(sid)?.length ?? 0}\u6761 \u6C34\u4F4D=${waterMarks.get(sid) ?? 0}`);
  if (waitKey.length === 0) {
    debugLogMainActor(resolved, `!! wait_key \u4E3A\u7A7A\uFF0C\u653E\u5F03\uFF08\u5F15\u64CE\u5C06\u7B49\u5F85\u8D85\u65F6\uFF09`);
    return;
  }
  const all = flows.get(sid) ?? [];
  const mark = waterMarks.get(sid) ?? 0;
  const delta = all.slice(mark);
  waterMarks.set(sid, all.length);
  const notice = stageNotice(sid, nodeName, actor, prompt, delta, false, fieldContext);
  debugLogMainActor(resolved, `\u6CE8\u5165\u7EC4\u88C5\u5B8C\u6210: \u589E\u91CF=${delta.length}\u6761 BC=${fieldContext.length}ch \u901A\u77E5=${notice.length}ch`);
  broker.register({
    waitKey,
    nodeName,
    kind: "main",
    jobId,
    mainSessionId: sid,
    steer: (text) => {
      queueOrDeliverMain(ctx, resolved, sid, {
        waitKey,
        nodeName,
        actor,
        soul,
        scopes: scopes ?? [],
        jobId,
        ...nodeShowprompts?.get(nodeName) !== void 0 ? { showprompt: nodeShowprompts.get(nodeName) } : {},
        text,
        via: "\u91CD\u8BD5"
      });
    }
  });
  const delivery = {
    waitKey,
    nodeName,
    actor,
    soul,
    scopes: scopes ?? [],
    jobId,
    text: notice,
    via: "\u9996\u8F6E",
    ...nodeShowprompts?.get(nodeName) !== void 0 ? { showprompt: nodeShowprompts.get(nodeName) } : {}
  };
  const answer = new Promise((resolve2) => {
    delivery.resolve = resolve2;
  });
  try {
    queueOrDeliverMain(ctx, resolved, sid, delivery);
    debugLogMainActor(resolved, `\u6CE8\u5165\u5DF2\u6295\u9012\uFF08\u82E5\u4E3B\u6A21\u578B\u5728\u98DE\u5219\u6392\u961F\uFF09\uFF0C\u7B49\u5F85\u4E3B\u6A21\u578B\u56DE\u5408...`);
    await answer;
    debugLogMainActor(resolved, `\u56DE\u5408\u7ED3\u675F\uFF0C\u4EA4\u5377\u5B8C\u6210`);
    let verdict = await broker.park(waitKey);
    while (verdict.kind === "retry") {
      debugLogMainActor(resolved, `\u505C\u9760\u91CD\u8BD5: node=${nodeName} attempt=${verdict.attempt} feedback=${verdict.feedback.length}ch`);
      broker.steerLease(waitKey, mainRetrySteerText(playNames.get(sid) ?? "FEMO\u811A\u672C", nodeName, actor, verdict.attempt, verdict.feedback));
      verdict = await broker.park(waitKey);
    }
    debugLogMainActor(resolved, `\u505C\u9760\u7ED3\u675F: node=${nodeName} verdict=${verdict.kind}`);
  } catch (error) {
    debugLogMainActor(resolved, `!! \u5F02\u5E38: ${error instanceof Error ? error.message : String(error)}`);
    takePending(sid);
    recordError(SessionId(sid), `\u4E3B\u6A21\u578B\u53C2\u4E0E\u8FD0\u884C\u6CE8\u5165\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    await sendActorFailure(
      bridge,
      jobId,
      waitKey,
      "main_executor_error",
      error instanceof Error ? error.message : String(error)
    ).catch(() => void 0);
  } finally {
    const stale = deliveries.dropWhere(sid, (d) => d.waitKey === waitKey);
    if (stale.length > 0) {
      debugLogMainActor(resolved, `\u6392\u961F\u6CE8\u5165\u968F\u8282\u70B9\u6536\u5C3E\u5254\u9664: wait_key=${waitKey} \u6761=${stale.length}`);
      for (const d of stale) d.resolve?.();
    }
    broker.unregister(waitKey);
    apiRetry2.clearChild(sid);
  }
}
function broadcastMainChunk(p, sid, step, chunk) {
  broadcastStreamChunk({ sid, node_name: p.nodeName, actor: p.actor, step, ref: p.waitKey }, chunk);
}
var mainLiveFrames = /* @__PURE__ */ new Map();
function installMainActorStreamBridge(ctx) {
  onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === void 0) return;
    const sid = String(agent?.session?.id ?? agent?.id ?? "");
    if (sid.length === 0) return;
    const p = peekPending(sid);
    if (p === void 0 || p.settled || !p.sawTurnStart) return;
    let live = mainLiveFrames.get(sid);
    if (live === void 0 || live.actor !== p.actor) {
      live = { actor: p.actor, frames: new LiveStreamFrames({ sid, node_name: p.nodeName, actor: p.actor, turn: p.turn, ref: p.waitKey }) };
      mainLiveFrames.set(sid, live);
    }
    live.frames.frame(frame);
  });
}
function mainSessionEventHook(ctx, session, event, bridge, resolved, projections) {
  const sid = String(session.id);
  if (event.type === "turn/start") {
    const turn = event.data?.turn;
    if (typeof turn === "number") deliveries.noteTurnStart(sid, turn);
  } else if (event.type === "turn/end") {
    deliveries.noteTurnEnd(sid);
  }
  const p = peekPending(sid);
  if (p === void 0 || p.settled) {
    if (event.type === "turn/end") flushNextMainDelivery(ctx, resolved, sid);
    return;
  }
  if (event.type === "turn/start") {
    p.sawTurnStart = true;
    p.buffer = [];
    p.noticeEntered = false;
    p.noticeEnteredClean = false;
    p.stepEnded = false;
    p.userMessageInTurn = false;
    p.firstAdmitted = "none";
    const turn = event.data?.turn;
    if (typeof turn === "number") p.turn = turn;
    return;
  }
  if (event.type === "user/message") {
    const text = userMessageTextOf(event);
    const ours = p.notice.length > 0 && text === p.notice;
    if (p.firstAdmitted === "none") {
      p.firstAdmitted = ours ? "ours" : "other";
      if (!ours) {
        debugLogMainActor(resolved, `\u672C\u8F6E\u975E\u6211\u4EEC\u7684\u8F6E\uFF08\u9996\u6761 admitted \u4E0D\u662F\u672C\u8282\u70B9\u901A\u77E5\uFF09: node=${p.nodeName} turn=${p.turn === void 0 ? "?" : String(p.turn)}`);
      }
    }
    if (ours) {
      p.noticeEntered = true;
      p.noticeEnteredClean = p.sawTurnStart && !p.stepEnded;
      debugLogMainActor(resolved, `\u901A\u77E5\u8FDB\u8F6E: node=${p.nodeName} clean=${p.noticeEnteredClean} first=${p.firstAdmitted} turn=${p.turn === void 0 ? "?" : String(p.turn)}`);
    } else if (isRealUserMessage(event)) {
      p.userMessageInTurn = true;
      debugLogMainActor(resolved, `\u672C\u8F6E\u6DF7\u5165\u771F\u4EBA\u6D88\u606F: node=${p.nodeName} turn=${p.turn === void 0 ? "?" : String(p.turn)}`);
    }
    return;
  }
  if (event.type === "step/end") {
    p.stepEnded = true;
    return;
  }
  if (event.type === "assistant/chunk") {
    if (!p.sawTurnStart) return;
    const raw = event.data ?? {};
    const chunk = raw.chunk;
    if (chunk === void 0) return;
    broadcastMainChunk(p, sid, typeof raw.step === "number" ? raw.step : 0, chunk);
    return;
  }
  if (event.type === "assistant/message" || event.type === "tool/call" || event.type === "tool/result") {
    if (!p.sawTurnStart) return;
    p.buffer.push(event);
    return;
  }
  if (event.type === "turn/end") {
    mainLiveFrames.get(sid)?.frames.endTurn();
    const verdict = captureVerdict(p);
    if (verdict !== "settle") {
      if (verdict === "requeue") {
        requeueSwallowedInjection(
          ctx,
          resolved,
          sid,
          p,
          p.userMessageInTurn ? "\u672C\u8F6E\u6DF7\u5165\u771F\u4EBA\u6D88\u606F" : "\u6CE8\u5165\u88AB\u6B63\u5728\u8DD1\u7684\u8F6E\u5403\u6389"
        );
        return;
      }
      p.sawTurnStart = false;
      debugLogMainActor(resolved, `turn/end \u672A\u89C1\u672C\u8282\u70B9\u901A\u77E5 \u2192 \u7EE7\u7EED\u7B49: node=${p.nodeName} turn=${p.turn === void 0 ? "?" : String(p.turn)}`);
      return;
    }
    takePending(sid);
    p.settled = true;
    p.resolve();
    void settleMainAnswer(ctx, session, p, bridge, resolved, projections).catch((error) => {
      debugLogMainActor(resolved, `!! \u4EA4\u5377\u5F02\u5E38: ${error instanceof Error ? error.message : String(error)}`);
      recordEmpty(p, bridge);
    });
    flushNextMainDelivery(ctx, resolved, sid);
  }
}
async function settleMainAnswer(ctx, session, p, bridge, resolved, projections) {
  const { output, steps } = buildTranscript(p.buffer);
  debugLogMainActor(resolved, `\u4EA4\u5377: node=${p.nodeName} output=${output.length}ch steps=${steps.length} buffer=${p.buffer.length}\u4E8B\u4EF6`);
  await bridge.send("post_speech", executorSpeechArgs({
    jobId: p.jobId,
    waitKey: p.waitKey,
    soul: p.soul,
    node: p.nodeName,
    output,
    steps
  }));
}
function recordEmpty(p, bridge) {
  void sendActorFailure(
    bridge,
    p.jobId,
    p.waitKey,
    "deliver_error",
    "\u4E3B\u6A21\u578B\u56DE\u5408\u4EA4\u5377\u5F02\u5E38\uFF08\u56DE\u4F20\u5931\u8D25\uFF09"
  ).catch(() => void 0);
}

// host/events/pre-step-gate.ts
function isActorChildNoise(message) {
  const source = message.source;
  if (source === void 0) return false;
  if (source.kind !== "subagent-settled" && source.kind !== "agent-message") return false;
  return typeof source.senderSessionId === "string" && source.senderSessionId.startsWith("femo-actor-");
}
function gatePreStep(facts) {
  const { messages, tag } = facts;
  const who = typeof tag === "string" && tag.length > 0 ? tag : "(unknown session)";
  const step = Number.isFinite(facts.step) && facts.step > 0 ? facts.step : 1;
  const admitted = messages.filter((message) => !isActorChildNoise(message));
  if (admitted.length !== messages.length) {
    console.log(`[femo-plugin] pre-step dropped ${messages.length - admitted.length} actor-child notice(s) for ${who}`);
    if (admitted.length === 0 && step === 1) return { kind: "reject" };
  }
  return { kind: "enter", messages: admitted };
}

// ../../femo2host/host/run-state-core.mjs
function jobMirrorPrearm(state, jobId, ownerSid) {
  state.jobs.set(jobId, {
    jobId,
    ownerSid,
    state: "running",
    nodeActors: /* @__PURE__ */ new Map(),
    nodeScopes: /* @__PURE__ */ new Map(),
    nodeShowprompts: /* @__PURE__ */ new Map()
  });
  state.sidIndex.set(ownerSid, jobId);
  state.activeJobId = jobId;
}
function jobMirrorCorrect(state, jobId, ownerSid) {
  const mirror = state.jobs.get(jobId);
  if (mirror !== void 0) return;
  jobMirrorPrearm(state, jobId, ownerSid);
}
function jobMirrorSetState(state, jobId, newState) {
  const mirror = state.jobs.get(jobId);
  if (mirror === void 0 || mirror.state === newState) return "unchanged";
  mirror.state = newState;
  return "changed";
}
function clearActiveIfActive(state, jobId) {
  if (state.activeJobId === jobId) {
    state.activeJobId = void 0;
    return true;
  }
  return false;
}
function isSessionRunning(state, sessionId) {
  const jobId = state.sidIndex.get(sessionId);
  if (jobId === void 0) return false;
  const mirror = state.jobs.get(jobId);
  return mirror !== void 0 && mirror.state === "running" && state.activeJobId === jobId;
}
function activeJobOf(state, sessionId) {
  const jobId = state.sidIndex.get(sessionId);
  return jobId === void 0 ? void 0 : state.jobs.get(jobId);
}
function projectionStateOf(state, mainSid) {
  const job = activeJobOf(state, mainSid);
  const running = job !== void 0 && job.state === "running" && state.activeJobId === job.jobId;
  const waiting = running && job.waitingHuman !== void 0;
  const waitScope = waiting ? job.waitingHuman?.waitScope ?? (job.waitingHuman?.nodeName !== void 0 ? job.nodeScopes.get(job.waitingHuman.nodeName) ?? [] : []) : [];
  return {
    running,
    waiting,
    waitScope,
    outVars: waiting ? job.waitingHuman?.outVars ?? [] : [],
    ...waiting ? { prompt: job.waitingHuman?.prompt } : {}
  };
}
function noteNodeScope(mirror, nodeName, scope) {
  if (nodeName !== void 0 && scope !== void 0) mirror.nodeScopes.set(nodeName, scope);
}
function noteNodeActor(mirror, nodeName, actorName) {
  if (nodeName !== void 0 && actorName !== void 0 && actorName.length > 0) {
    mirror.nodeActors.set(nodeName, actorName);
  }
}
function noteNodeShowprompt(mirror, nodeName, showprompt) {
  if (showprompt !== void 0 && nodeName !== void 0) mirror.nodeShowprompts.set(nodeName, showprompt);
}
function waitingHumanFromEvent(d) {
  d = d ?? {};
  return {
    waitKey: String(d.wait_key ?? ""),
    nodeName: typeof d.node_name === "string" ? d.node_name : void 0,
    context: typeof d.context === "string" ? d.context : "",
    memory: typeof d.memory === "string" ? d.memory : "",
    showprompt: typeof d.showprompt === "string" ? d.showprompt : void 0,
    prompt: typeof d.prompt === "string" ? d.prompt : "",
    outVars: Array.isArray(d.out_vars) ? d.out_vars.filter((x) => typeof x === "string") : [],
    waitScope: Array.isArray(d.scope) ? d.scope.filter((x) => typeof x === "string") : void 0
  };
}
function setMirrorWaitingHuman(mirror, snapshot) {
  mirror.waitingHuman = snapshot;
  return "changed";
}
function clearMirrorWaitingHuman(mirror) {
  if (mirror.waitingHuman === void 0) return "unchanged";
  mirror.waitingHuman = void 0;
  return "changed";
}
function assertRunAllowed(state, sessionId) {
  const activeId = state.activeJobId;
  if (activeId === void 0) return;
  const mirror = state.jobs.get(activeId);
  const owner = mirror?.ownerSid ?? "?";
  const where = owner === sessionId ? "\u672C\u4F1A\u8BDD" : `\u53E6\u4E00\u4F1A\u8BDD\uFF08${owner}\uFF09`;
  throw new Error(`${where}\u7684 Job ${activeId} \u6D3B\u8DC3\u4E2D\uFF0C\u53EF\u5148\u6682\u505C\u6216\u7B49\u5B83\u6302\u8D77`);
}

// host/actors/native/index.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// host/actor-usage.ts
import { join as join10 } from "node:path";
function actorUsagePath(sessionId) {
  return join10(packageRoot, "data", "actor-usage", `${sessionId}.json`);
}
async function readActorUsageFile(sessionId) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(actorUsagePath(sessionId), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.actors === "object" && parsed.actors !== null ? parsed.actors : void 0;
  } catch {
    return void 0;
  }
}
async function mergeActorUsageFile(sessionId, actorKey, record) {
  await withRecordLock(sessionId, async () => {
    const fs = await import("node:fs/promises");
    const existing = await readActorUsageFile(sessionId) ?? {};
    const actors = { ...existing, [actorKey]: record };
    await fs.mkdir(join10(packageRoot, "data", "actor-usage"), { recursive: true });
    await fs.writeFile(actorUsagePath(sessionId), JSON.stringify({ sessionId, actors }, null, 2), "utf8");
  });
}

// ../../femo2host/host/cast-core.mjs
async function castGet(femoRoot2, path, timeoutMs = 8e3) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${hubBaseUrl(femoRoot2)}${path}`, { signal: ctl.signal });
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}
async function castPost(femoRoot2, path, body, timeoutMs = 8e3) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${hubBaseUrl(femoRoot2)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}
async function readJobCast(femoRoot2, jobId) {
  try {
    const data = await castGet(femoRoot2, `/cast?job=${Number(jobId)}`);
    return data !== null && typeof data === "object" && data.cast !== null && typeof data.cast === "object" ? data.cast : {};
  } catch {
    return {};
  }
}
async function putJobCastEntry(femoRoot2, jobId, soulId, sid, host = "") {
  const out = await castPost(femoRoot2, "/cast", { job_id: Number(jobId), soul: soulId, sid, host });
  if (out === null || typeof out !== "object" || out.ok !== true) {
    throw new Error(`cast entry put failed (job=${jobId}, soul=${soulId}): ${out?.error ?? "unknown"}`);
  }
  return out;
}
async function snapshotJobCast(femoRoot2, jobId) {
  const out = await castPost(femoRoot2, "/cast", { job_id: Number(jobId), subkind: "snapshot" });
  if (out === null || typeof out !== "object" || out.ok !== true) {
    throw new Error(`cast snapshot failed (job=${jobId}): ${out?.error ?? "unknown"}`);
  }
  return Number(out.count ?? 0);
}
async function preferenceSet(femoRoot2, host, sid, soul, timeoutMs) {
  return castPost(femoRoot2, "/sessions/cast-preference", { host, sid, soul }, timeoutMs);
}
async function preferencesView(femoRoot2, scope = "all") {
  try {
    const data = await castGet(femoRoot2, scope === "online" ? "/sessions/cast-preferences?scope=online" : "/sessions/cast-preferences");
    return data !== null && typeof data === "object" && typeof data.bindings === "object" && data.bindings !== null ? data : { bindings: {}, hosts: {} };
  } catch {
    return { bindings: {}, hosts: {} };
  }
}

// host/actors/native/turn-watch.ts
function createTurnWatchState() {
  return {
    settledTurns: [],
    baselineCount: 0,
    childTurnEvents: /* @__PURE__ */ new Map(),
    allChildEvents: [],
    pendingTurn: { slot: [] },
    rescueAnchorMs: 0,
    pollAdded: /* @__PURE__ */ new Set(),
    idleTimer: void 0
  };
}
function resolvePendingTurn(tw, turn) {
  const waiter = tw.pendingTurn.slot.shift();
  if (waiter === void 0) return;
  waiter.resolve(turn);
}
function rejectPendingTurn(tw, error) {
  for (const waiter of tw.pendingTurn.slot.splice(0)) waiter.reject(error);
}
function waitTurnAfterBaseline(tw) {
  if (tw.settledTurns.length > tw.baselineCount) {
    return Promise.resolve(tw.settledTurns[tw.baselineCount]);
  }
  return new Promise((resolve2, reject) => {
    tw.pendingTurn.slot.push({ resolve: resolve2, reject });
  });
}
function eventAfterAnchor(tw, e) {
  const t = Number(e.time);
  return Number.isFinite(t) && t > tw.rescueAnchorMs;
}
function armIdleWatchdog(tw, interruptRef, controller, resolved) {
  if (tw.idleTimer !== void 0) clearTimeout(tw.idleTimer);
  tw.idleTimer = setTimeout(() => {
    interruptRef.fn?.();
    controller.abort(new Error(`\u5B50 agent \u7A7A\u95F2\u8D85\u65F6\uFF08${Math.round(resolved.subagentIdleTimeoutMs / 1e3)}s \u65E0\u8F93\u51FA\uFF09`));
  }, resolved.subagentIdleTimeoutMs);
}
function startRescuePoll(ctx, tw, childIdRef, armIdle, nodeName) {
  return setInterval(() => {
    if (childIdRef.id === "") return;
    if (tw.pendingTurn.slot.length === 0) return;
    let live;
    let events;
    try {
      live = ctx.agents.get(SessionId(childIdRef.id));
      if (live?.session === void 0) return;
      events = readSessionEvents(live.session);
    } catch {
      return;
    }
    for (const e of events) {
      if (e.type !== "turn/end") continue;
      const turn = e.data?.turn;
      if (typeof turn !== "number" || !eventAfterAnchor(tw, e) || tw.settledTurns.includes(turn)) continue;
      for (const x of events) {
        if (tw.pollAdded.has(x)) continue;
        if (tw.allChildEvents.includes(x)) {
          tw.pollAdded.add(x);
          continue;
        }
        const xt = x.data?.turn;
        if (xt !== turn) continue;
        tw.pollAdded.add(x);
        tw.allChildEvents.push(x);
        let bucket = tw.childTurnEvents.get(turn);
        if (bucket === void 0) tw.childTurnEvents.set(turn, bucket = []);
        bucket.push(x);
      }
      tw.settledTurns.push(turn);
      armIdle();
      resolvePendingTurn(tw, turn);
      console.log(`[femo-plugin][native] turn-end rescued by poll (session/event blind): child=${childIdRef.id} turn=${turn} node=${nodeName} anchorAge=${Date.now() - tw.rescueAnchorMs}ms`);
    }
  }, 2e3);
}

// host/safe-steer.ts
function safeSteer(target, message, tag) {
  const steer = target?.steer;
  if (typeof steer !== "function") return false;
  try {
    steer.call(target, message);
    return true;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.log(`[femo-plugin] steer failed (${tag}): ${text}`);
    return false;
  }
}

// host/actors/native/registry.ts
var actorChildren = /* @__PURE__ */ new Map();
function actorRegistryKey(sid, jobId, actorKey) {
  return `${sid}\0j${jobId}\0${actorKey}`;
}
var actorTurnLocks = /* @__PURE__ */ new Map();
function nativeChildId(sid, jobId, actorKey) {
  return `femo-actor-j${jobId}-${sid}-${actorKey}`;
}

// host/actors/native/child-setup.ts
function debugEffortLog(resolved, tag, detail) {
  appendDebugLog(
    resolved.femoRoot,
    "debug-effort-hook.log",
    "[" + (/* @__PURE__ */ new Date()).toISOString() + "] " + tag + " " + detail
  );
}
function setupChildAgent(ctx, childId, reasoningHolder, resolved, defaultModel, policyAppends = true) {
  const agent = ctx.agents.get(SessionId(childId));
  if (agent === void 0) {
    console.log(`[femo-plugin][native] child agent ${childId} not live after creation \u2014 delegation/reasoning setup skipped`);
    return;
  }
  if (policyAppends && agent.session !== void 0) {
    appendActorPolicyPins(agent.session);
  }
  const childSystemPrompt = agent.ctx?.systemPrompt;
  childSystemPrompt?.context({
    name: "femo:child-scope",
    order: 121,
    text: FEMO_CHILD_SCOPE_TEXT
  });
  agent.ctx?.on("agent/request", async (_payload, next) => {
    const resolvedCall = await next(_payload);
    const effort = reasoningHolder.actorThinking;
    const { reasoningEffort: _inherited, ...withoutInherited } = resolvedCall;
    return {
      ...withoutInherited,
      ...effort !== void 0 && effort.length > 0 ? { reasoningEffort: effort } : {}
    };
  });
}
function childTurnError(events) {
  for (const event of events) {
    if (event.type !== "turn/end") continue;
    const reason = event.data.reason;
    if (reason === void 0 || reason.kind !== "error") continue;
    const message = typeof reason.error?.message === "string" ? reason.error.message : "";
    const code = typeof reason.error?.code === "string" ? reason.error.code : "";
    const detail = [message, code.length > 0 ? `(${code})` : ""].filter(Boolean).join(" ");
    return { kind: "executor_error", detail: detail.length > 0 ? detail : "\u5B50\u4EE3\u7406\u56DE\u5408\u4EE5 error \u6536\u573A\uFF08\u65E0\u9519\u8BEF\u8BE6\u60C5\uFF09" };
  }
  return void 0;
}

// host/actors/native/index.ts
async function runAiSubagentNative(ctx, resolved, bridge, session, request, recordError, defaultModel, nodeActors = /* @__PURE__ */ new Map(), projections, nodeShowprompts = /* @__PURE__ */ new Map(), jobId = -1) {
  if (projections === void 0) throw new Error("projections registry unavailable");
  const waitKey = String(request.wait_key ?? "");
  if (waitKey.length === 0) return;
  const subagents = ctx.get("subagents");
  if (subagents === void 0) {
    throw new Error("subagents service unavailable (continuable subagents require the 0.1.3 subagent runtime)");
  }
  const parent = ctx.agents.get(session.id);
  if (parent === void 0) {
    throw new Error(`parent agent for ${session.id} is not live`);
  }
  const blocks = request.blocks ?? {};
  const unknownBlockKeys = Object.keys(blocks).filter((k) => !KNOWN_BLOCK_KEYS.has(k));
  if (unknownBlockKeys.length > 0) {
    console.log(`[femo-plugin][native] ai_request(node=${String(request.node_name ?? "")}) blocks \u542B\u5951\u7EA6\u5916\u8BED\u6599\u952E\uFF08\u5BBF\u4E3B\u62FC\u88C5\u5668\u4E0D\u8BC6\u522B\u5DF2\u5FFD\u7565\uFF09: ${unknownBlockKeys.join(", ")}`);
  }
  const prompt = buildSubagentPrompt(blocks);
  const actorInfo = request.actor_info ?? {};
  const soulId = typeof actorInfo.soul === "string" ? actorInfo.soul : "";
  const soulPersona = soulId.length > 0 ? await readSoulPersona(bridge, soulId) : "";
  if (soulPersona.includes("{{")) {
    console.log(`[femo-plugin][native] WARNING soul persona (soul_id=${soulId}) contains "{{" \u2014 dsh prompt assembly treats it as a template variable and will fail loud`);
  }
  const blk = (key) => typeof blocks[key] === "string" ? String(blocks[key]) : "";
  const nodeName = String(request.node_name ?? "");
  console.log(`[femo-plugin][native] ai_request node=${nodeName} scope=${String(request.scope ?? "")} soul_id=${soulId} blocks: context=${blk("context").length}ch soul=${blk("soul").length}ch memory=${blk("memory").length}ch prompt=${blk("prompt").length}ch`);
  const requestActorName = actorNameOf(request) || void 0;
  const actor = requestActorName ?? nodeActors.get(nodeName) ?? nodeName;
  const actorKey = projectionActorKey(actor);
  const castSoul = soulId.length > 0 ? soulId : actor;
  const sid = String(session.id);
  const actorThinking = typeof request.actor_thinking === "string" && request.actor_thinking.trim().length > 0 ? request.actor_thinking.trim() : void 0;
  const controller = new AbortController();
  const interruptRef = {};
  const activeEntry = {
    controller,
    node: nodeName,
    jobId,
    interrupt: () => {
      interruptRef.fn?.();
    }
  };
  activeSubagents.add(activeEntry);
  const lockKey = actorRegistryKey(sid, jobId, actorKey);
  const prevLock = actorTurnLocks.get(lockKey) ?? Promise.resolve();
  let releaseLock;
  const lockGate = new Promise((resolve2) => {
    releaseLock = resolve2;
  });
  const lockTicket = prevLock.then(() => lockGate);
  actorTurnLocks.set(lockKey, lockTicket);
  lockTicket.catch(() => void 0);
  try {
    await prevLock;
  } catch {
  }
  const baseTurn = (turnBaseBySession.get(sid) ?? TURN_BASE_EPOCH) + 1;
  turnBaseBySession.set(sid, baseTurn + 100);
  const scopeInfo = Array.isArray(request.scope_info) ? request.scope_info.filter((x) => typeof x === "string") : void 0;
  let windowsOrUndefined = projections.get(sid);
  if (windowsOrUndefined === void 0) {
    const headerCwd = session.header?.cwd;
    if (headerCwd === void 0 || headerCwd.length === 0) {
      activeSubagents.delete(activeEntry);
      releaseLock();
      throw new Error(`session ${sid} cwd missing \u2014 projection windows cannot be ensured (process.cwd() fallback forbidden)`);
    }
    windowsOrUndefined = await projections.ensure(sid, scopeInfo ?? [], headerCwd);
  }
  void windowsOrUndefined;
  const toolNamesByCallId = /* @__PURE__ */ new Map();
  const usage = createActorUsageSampler({
    onPublish: (record) => {
      let byActor = actorUsageBySession.get(sid);
      if (byActor === void 0) {
        byActor = /* @__PURE__ */ new Map();
        actorUsageBySession.set(sid, byActor);
      }
      byActor.set(actorKey, record);
      broadcastSse("femo_actor_usage", { sid, actorKey, ...record });
    },
    onPersist: (record) => {
      void mergeActorUsageFile(sid, actorKey, record).catch((error) => {
        console.log(`[femo-plugin][native] write actor-usage failed: ${String(error)}`);
      });
    }
  });
  const tw = createTurnWatchState();
  const armIdle = () => armIdleWatchdog(tw, interruptRef, controller, resolved);
  const childIdRef = { id: "" };
  const onChildEvent = (watched, watchedEvent) => {
    if (String(watched.id) !== childIdRef.id || childIdRef.id === "") return;
    armIdle();
    usage.capture(watchedEvent);
    tw.allChildEvents.push(watchedEvent);
    const rawTurn0 = watchedEvent.data ?? {};
    if (typeof rawTurn0.turn === "number") {
      let bucket = tw.childTurnEvents.get(rawTurn0.turn);
      if (bucket === void 0) {
        bucket = [];
        tw.childTurnEvents.set(rawTurn0.turn, bucket);
      }
      bucket.push(watchedEvent);
      if (watchedEvent.type === "turn/end") {
        if (!tw.settledTurns.includes(rawTurn0.turn)) {
          const evtTime = Number(watchedEvent.time);
          if (!Number.isFinite(evtTime) || evtTime > tw.rescueAnchorMs) {
            tw.settledTurns.push(rawTurn0.turn);
            resolvePendingTurn(tw, rawTurn0.turn);
          }
        }
      }
    }
    if (!FORWARD_CHILD_EVENTS.has(watchedEvent.type) && watchedEvent.type !== "assistant/chunk") return;
    const isChunk = watchedEvent.type === "assistant/chunk";
    const chunkWrap = isChunk ? watchedEvent.data : void 0;
    const chunk = chunkWrap?.chunk;
    const raw = watchedEvent.data ?? {};
    const mappedStep = typeof raw.step === "number" ? raw.step : 0;
    if (isChunk && chunk !== void 0) {
      broadcastActorStreamChunk({ sid, node_name: nodeName, actor, step: mappedStep, ref: waitKey }, chunk);
    }
    if (watchedEvent.type === "tool/call") {
      if (typeof raw.callId === "string" && typeof raw.name === "string") {
        toolNamesByCallId.set(raw.callId, raw.name);
      }
    } else if (watchedEvent.type === "tool/result") {
      const msg = watchedEvent.data.message;
      const callId = typeof msg?.source?.callId === "string" ? msg.source.callId : void 0;
      let text = "";
      for (const part of msg?.content ?? []) {
        for (const inner of part?.content ?? []) {
          if (inner?.type === "text" && typeof inner.text === "string" && inner.text.length > 0) {
            text = inner.text;
            break;
          }
        }
        if (text.length > 0) break;
      }
      const name2 = callId !== void 0 ? toolNamesByCallId.get(callId) : void 0;
    }
  };
  const disposeListener = ctx.on("session/event", onChildEvent);
  tw.rescueAnchorMs = Date.now();
  const pollTimer = startRescuePoll(ctx, tw, childIdRef, armIdle, nodeName);
  const liveFrames = new LiveStreamFrames(
    // ref=waitKey：投影中心据此把逐字流喂进桥开好的那个段（宿主不认识段键）
    { sid, node_name: nodeName, actor, turn: baseTurn, ref: waitKey },
    (chunk) => {
      if (chunk.type === "usage") usage.applyUsage(chunk.usage);
    }
  );
  const disposeFrameListener = onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === void 0 || childIdRef.id === "") return;
    if (String(agent?.id ?? agent?.session?.id ?? "") !== childIdRef.id) return;
    armIdle();
    liveFrames.frame(frame);
  });
  let entry = actorChildren.get(actorRegistryKey(sid, jobId, actorKey));
  const wasNew = entry === void 0;
  let created = false;
  try {
    if (entry !== void 0) {
      entry.reasoning.actorThinking = actorThinking;
      childIdRef.id = entry.childId;
    } else {
      const castEntry = (await readJobCast(resolved.femoRoot, jobId))[castSoul];
      const resumedSid = typeof castEntry?.sid === "string" && castEntry.sid.startsWith("femo-actor-") ? castEntry.sid : void 0;
      const childId2 = resumedSid ?? nativeChildId(sid, jobId, actorKey);
      childIdRef.id = childId2;
      const persistence = ctx.get("sessionPersistence");
      let persisted = false;
      try {
        persisted = await persistence?.stat?.(SessionId(childId2)) !== void 0;
      } catch (statError) {
        console.log(`[femo-plugin][native] persistence stat(${childId2}) failed: ${String(statError)} \u2014 treating as absent`);
      }
      const newEntry = { childId: childId2, actor, jobId, reasoning: { actorThinking }, hooked: false };
      debugEffortLog(
        resolved,
        "create",
        `child=${childId2} actor=${JSON.stringify(actor)} actor_thinking=${JSON.stringify(actorThinking)} source=${JSON.stringify(String(request.source ?? ""))}`
      );
      if (!persisted) {
        const mainModel = resolveMainModel(parent, defaultModel);
        const sourceOptions = resolveSourceModel(resolved, request.source, mainModel);
        const agentOptions = {
          ...sourceOptions.agentOptions,
          ...actorThinking !== void 0 ? { reasoningEffort: actorThinking } : {}
        };
        await subagents.startContinuable({
          provider: resolved.subagentProvider,
          label: actor,
          childId: SessionId(childId2),
          request: {
            prompt: [{ type: "text", text: prompt }],
            parent,
            persona: soulPersona,
            agentOptions,
            ...toolFilterOf(resolved, request)
          },
          signal: controller.signal
        });
        created = true;
        setupChildAgent(ctx, childId2, newEntry.reasoning, resolved, defaultModel, true);
        newEntry.hooked = true;
        void putJobCastEntry(resolved.femoRoot, jobId, castSoul, childId2, hostAddr()).catch((error) => {
          console.log(`[femo-plugin][native] cast \u767B\u8BB0 ${castSoul} \u5931\u8D25 (job=${jobId}): ${String(error)}`);
        });
        console.log(`[femo-plugin][native] actor child created: ${childId2} (${actor}, job=${jobId})`);
      } else {
        console.log(`[femo-plugin][native] actor child persisted from previous process: ${childId2} (${actor}, job=${jobId}) \u2014 will cold-resume on send`);
      }
      entry = newEntry;
      actorChildren.set(actorRegistryKey(sid, jobId, actorKey), entry);
    }
  } catch (error) {
    disposeListener();
    disposeFrameListener();
    activeSubagents.delete(activeEntry);
    releaseLock();
    throw error;
  }
  const childId = entry.childId;
  interruptRef.fn = () => {
    try {
      subagents.interrupt(SessionId(childId), { kind: "user", parentSessionId: SessionId(sid) });
    } catch {
    }
  };
  activeChildRuns.set(childId, { mainSid: sid, node: nodeName, jobId });
  const steerChild = (text) => {
    const live = ctx.agents.get(SessionId(childId));
    if (live?.steer !== void 0) {
      const delivered = safeSteer(live, {
        id: randomUUID2(),
        role: "user",
        content: [{ type: "text", text }],
        source: FEMO_PLUGIN_SOURCE
      }, `child ${childId}`);
      if (delivered) return;
    }
    void subagents.sendMessage(parent, SessionId(childId), [{ type: "text", text }], { signal: controller.signal }).catch(() => void 0);
  };
  broker.register({
    waitKey,
    nodeName,
    kind: "subagent",
    jobId,
    mainSessionId: sid,
    controller,
    steer: steerChild
  });
  const onAbortReject = () => {
    const reason = controller.signal.reason;
    rejectPendingTurn(tw, reason instanceof Error ? reason : new Error(String(reason ?? "aborted")));
  };
  controller.signal.addEventListener("abort", onAbortReject);
  try {
    armIdle();
    if (!created) {
      const live = ctx.agents.get(SessionId(childId));
      if (live?.whenIdle !== void 0) {
        await Promise.race([
          live.whenIdle(),
          new Promise((resolve2) => {
            setTimeout(resolve2, 3e4);
          }),
          new Promise((_resolve, reject) => {
            controller.signal.addEventListener("abort", () => reject(new Error("aborted while waiting for idle")), { once: true });
          })
        ]);
        armIdle();
      }
      tw.baselineCount = tw.settledTurns.length;
      await subagents.sendMessage(parent, SessionId(childId), [{ type: "text", text: prompt }], { signal: controller.signal });
      if (entry.hooked !== true) {
        setupChildAgent(ctx, childId, entry.reasoning, resolved, defaultModel, false);
        entry.hooked = true;
      }
    }
    console.log(`[femo-plugin][native] node dispatched to actor child ${childId}: node=${nodeName} created=${String(created)} reused=${String(!wasNew)}`);
    let output = "";
    let steps = [];
    const turnObserveFrom = tw.allChildEvents.length;
    const firstTurn = await waitTurnAfterBaseline(tw);
    const built = buildTranscript(tw.childTurnEvents.get(firstTurn) ?? []);
    output = built.output;
    steps = built.steps;
    if (output.length === 0) {
      const live = ctx.agents.get(SessionId(childId));
      output = live?.session !== void 0 ? buildTranscript(readSessionEvents(live.session).filter((ev) => eventAfterAnchor(tw, ev))).output : "";
    }
    if (steps.length === 0 && output.length > 0) {
      steps = [{ step: 0, cot: "", reply: output, tool_calls: [], tool_results: [] }];
    }
    const firstTurnError = childTurnError(tw.allChildEvents.slice(turnObserveFrom));
    if (firstTurnError !== void 0 && output.length === 0) {
      console.log(`[femo-plugin][native] \u5B50\u4EE3\u7406\u56DE\u5408\u4EE5 error \u6536\u573A\uFF08node=${nodeName}\uFF09\uFF1A${firstTurnError.detail}`);
      await sendActorFailure(bridge, jobId, waitKey, firstTurnError.kind, firstTurnError.detail);
      return;
    }
    await bridge.send("post_speech", executorSpeechArgs({
      jobId,
      waitKey,
      soul: actor,
      node: nodeName,
      output,
      steps,
      modelId: usage.modelIdNow()
    }));
    if (!runControlAborted.has(controller)) {
      if (tw.idleTimer !== void 0) {
        clearTimeout(tw.idleTimer);
        tw.idleTimer = void 0;
      }
      let verdict = await broker.park(waitKey);
      while (verdict.kind === "retry") {
        armIdle();
        tw.baselineCount = tw.settledTurns.length;
        tw.rescueAnchorMs = Date.now();
        const snapshotLen = tw.allChildEvents.length;
        steerChild(RETRY_STEER_TEXT(verdict.attempt, verdict.feedback));
        const retryTurn = await waitTurnAfterBaseline(tw);
        const retryEvents = tw.allChildEvents.slice(snapshotLen);
        const builtRetry = buildTranscript(retryEvents.some((e) => e.type === "turn/end") ? tw.childTurnEvents.get(retryTurn) ?? retryEvents : retryEvents);
        const retryError = childTurnError(retryEvents);
        if (retryError !== void 0 && builtRetry.output.length === 0) {
          console.log(`[femo-plugin][native] \u91CD\u8BD5\u56DE\u5408\u4EE5 error \u6536\u573A\uFF08node=${nodeName}\uFF09\uFF1A${retryError.detail}`);
          await sendActorFailure(bridge, jobId, waitKey, retryError.kind, retryError.detail).catch(() => void 0);
          break;
        }
        if (!retryEvents.some((e) => e.type === "turn/end") && builtRetry.steps.length === 0 && builtRetry.output.length === 0) {
          console.log(`[femo-plugin][native] \u8282\u70B9\u91CD\u8BD5\u56DE\u5408\u672A\u89C2\u6D4B\u5230 turn/end \u4E14\u96F6\u4EA7\u51FA\uFF08node=${nodeName}\uFF09\uFF0C\u4E0A\u62A5\u6267\u884C\u4F53\u5931\u8D25`);
          await sendActorFailure(bridge, jobId, waitKey, "turn_timeout", "\u91CD\u8BD5\u56DE\u5408\u8D85\u65F6\u4E14\u96F6\u4EA7\u51FA").catch(() => void 0);
          break;
        }
        output = builtRetry.output;
        steps = builtRetry.steps.length > 0 ? builtRetry.steps : output.length > 0 ? [{ step: 0, cot: "", reply: output, tool_calls: [], tool_results: [] }] : [];
        await bridge.send("post_speech", executorSpeechArgs({
          jobId,
          waitKey,
          soul: actor,
          node: nodeName,
          output,
          steps,
          modelId: usage.modelIdNow()
        }));
        if (tw.idleTimer !== void 0) {
          clearTimeout(tw.idleTimer);
          tw.idleTimer = void 0;
        }
        verdict = await broker.park(waitKey);
      }
      if (verdict.kind === "aborted" && !runControlAborted.has(controller)) {
        await sendActorFailure(
          bridge,
          jobId,
          waitKey,
          "park_timeout",
          "\u505C\u9760\u7B49\u5F85\u8D85\u65F6\uFF0815min\uFF09\uFF0C\u6267\u884C\u4F53\u672A\u5728\u65F6\u9650\u5185\u4EA4\u51FA\u91CD\u8BD5\u56DE\u5408"
        ).catch(() => void 0);
      }
    }
    console.log(`[femo-plugin][native] subagent node done: ${nodeName} child=${childId} output=${output.length}ch steps=${steps.length}`);
    if (output.length > 0) {
      console.log(`[femo-plugin][native] subagent output head: ${output.slice(0, 300).replace(/\n/g, "\\n")}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runControlAborted.has(controller)) {
      console.log(`[femo-plugin][native] subagent stopped by run-control: ${nodeName} ${message}`);
    } else {
      recordError(session.id, `\u5B50 agent \u4E2D\u65AD\uFF1A${message}`);
      console.log(`[femo-plugin][native] subagent interrupted: ${nodeName} ${message}`);
      await sendActorFailure(bridge, jobId, waitKey, "executor_error", message).catch((sendError) => {
        console.log(`[femo-plugin][native] \u6267\u884C\u5931\u8D25\u4FE1\u53F7\u56DE\u4F20\u5931\u8D25: ${String(sendError)}`);
      });
    }
  } finally {
    activeSubagents.delete(activeEntry);
    activeChildRuns.delete(childId);
    broker.unregister(waitKey);
    apiRetry2.clearChild(childId);
    usage.persist();
    liveFrames.endTurn();
    if (tw.idleTimer !== void 0) clearTimeout(tw.idleTimer);
    clearInterval(pollTimer);
    controller.signal.removeEventListener("abort", onAbortReject);
    disposeListener();
    disposeFrameListener();
    rejectPendingTurn(tw, new Error("node settled"));
    releaseLock();
    console.log(`[femo-plugin][native] subagent node settled (child kept alive): ${nodeName} child=${childId}`);
  }
}

// host/actors/dispatch.ts
function projectionStateOf2(runState, mainSid) {
  return projectionStateOf(runState, mainSid);
}
function broadcastProjectionState(runState, mainSid) {
  broadcastSse("projection_state", { sid: mainSid, ...projectionStateOf2(runState, mainSid) });
}
function dispatchActorTurn(ctx, resolved, bridge, session, request, recordError, defaultModel, mirror, projections, jobId) {
  const reqNode = typeof request.node_name === "string" ? request.node_name : void 0;
  const reqScope = Array.isArray(request.scope_info) ? request.scope_info.filter((x) => typeof x === "string") : void 0;
  if (reqNode !== void 0 && reqScope !== void 0) {
    mirror.nodeScopes.set(reqNode, reqScope);
  }
  void runAiSubagentNative(ctx, resolved, bridge, session, request, recordError, defaultModel, mirror.nodeActors, projections, mirror.nodeShowprompts, jobId).catch((error) => {
    recordError(session.id, `\u5B50 agent \u6267\u884C\u5931\u8D25\uFF1A${String(error)}`);
    void sendActorFailure(bridge, jobId, String(request.wait_key ?? ""), "dispatch_error", String(error)).catch(() => void 0);
  });
}
function applyHumanWait(ctx, runState, session, projections, broker2, mirror, d) {
  const sessionId = String(session.id);
  const jobId = mirror.jobId ?? -1;
  console.log(`[femo-plugin] human_wait received: job=${jobId} node=${String(d.node_name ?? "-")} wait_key=${String(d.wait_key ?? "-")} -> waitingHuman SET`);
  pushDiag("human_wait", `SET job=${jobId} node=${String(d.node_name ?? "-")} wait_key=${String(d.wait_key ?? "-")}`);
  const waitScope = Array.isArray(d.scope) ? d.scope.filter((x) => typeof x === "string") : void 0;
  mirror.waitingHuman = waitingHumanFromEvent(d);
  broadcastProjectionState(runState, sessionId);
  const prompt = typeof d.prompt === "string" ? d.prompt : "";
  const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
  const waitLineScope = waitScope ?? (nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName));
  broker2?.register({
    waitKey: String(d.wait_key ?? ""),
    nodeName: nodeName ?? "",
    kind: "human",
    jobId,
    mainSessionId: sessionId,
    // 重试提醒显示归 hub retry 槽（桥 node_retry 事件落账）；租约仍要
    // 登记（broker 裁决面），steer 显示体只剩空操作。
    steer: (_text) => {
    }
  });
}

// ../../femo2host/host/notice-core.mjs
function formatStopNotice({ jobId, outcome, detail, letters = [], tag = "[femo-plugin]", panelNote = true }) {
  const errors = [];
  const warnings = [];
  for (const x of letters) {
    if (x === null || typeof x !== "object") continue;
    if (x.kind !== "notice") continue;
    const text2 = String(x.payload ?? "").trim();
    if (text2.length === 0) continue;
    if (x.subkind === "error") errors.push(text2);
    else if (x.subkind === "warning") warnings.push(text2);
  }
  let headline;
  if (outcome === "finished") {
    headline = `\u2705 Job ${jobId} \u5DF2\u5B8C\u6574\u8DD1\u5B8C\u3002\u82E5\u8981\u91CD\u8DD1\u8BF7\u7528 fresh_start\uFF08\u4E0D\u80FD resume \u7EED\u8DD1\uFF09\u3002`;
  } else if (outcome === "failed") {
    const err = detail !== void 0 && detail.length > 0 ? detail : String(letters.find((x) => x !== null && typeof x === "object" && x.kind === "notice" && x.delivery === "urgent")?.payload ?? "unknown error");
    headline = `\u274C \u8FD0\u884C\u51FA\u9519\u3002\u9519\u8BEF\u4FE1\u606F\uFF1A${err}\u2014\u2014\u53EF\u4FEE\u590DFEMO\u811A\u672C\u540E\u518D fresh_start\u3002`;
  } else {
    headline = `\u23F8 \u5DF2\u6682\u505C\uFF08\u6302\u8D77\uFF0C\u65AD\u70B9\u4FDD\u7559\uFF09\u3002\u53EF\u7528 resume \u7EED\u8DD1\u6216 fresh_start \u91CD\u8DD1\u3002`;
  }
  let text = `${tag} FEMO \u8FD0\u884C\u7ED3\u679C\uFF1A${headline}`;
  if (errors.length > 0) {
    text += `

\u26A0\uFE0F \u4EE5\u4E0B\u8282\u70B9\u51FA\u73B0\u8FC7\u811A\u672C\u9519\u8BEF\uFF1A
- ${errors.join("\n- ")}`;
    if (panelNote) text += "\n\u5B8C\u6574\u6E05\u5355\u89C1\u9519\u8BEF\u9762\u677F\u3002";
  }
  if (warnings.length > 0) {
    text += `

\u2139\uFE0F \u4EE5\u4E0B\u8B66\u544A\u51FA\u73B0\u8FC7\uFF08\u4E0D\u963B\u65AD\uFF0C\u4F9B\u4FEEFEMO\u811A\u672C\u53C2\u8003\uFF09\uFF1A
- ${warnings.join("\n- ")}`;
  }
  return text;
}
var PLAY_BROADCAST = {
  done: "\u2705 FEMO \u5DF2\u8DD1\u5B8C",
  error: (detail) => `\u274C FEMO \u8FD0\u884C\u51FA\u9519\uFF1A${detail}`,
  paused: (detail) => `\u23F8 FEMO \u5DF2\u6682\u505C\uFF08\u53EF\u7EED\u8DD1\uFF09${detail ? `\uFF1A${detail}` : ""}`
};

// ../../femo2host/host/event-core.mjs
function createEventCore({ board, sid = "femo-main", send, dispatch = "off", log = () => {
}, store: externalStore, resolveSid, verbs: verbsOpt, skip = [] }) {
  const store = externalStore ?? { jobs: /* @__PURE__ */ new Map(), sidIndex: /* @__PURE__ */ new Map(), activeJobId: void 0 };
  const sidOf = resolveSid ?? (() => sid);
  const skipEvents = new Set(skip);
  const verbs = {
    flowStarted: (d, playName2) => chat(`\u{1F3AC} \u300A${playName2 || "\u672A\u547D\u540D\u811A\u672C"}\u300B\u542F\u52A8\u8FD0\u884C`, "sys"),
    nodePrompt: (d, prompt, scope) => chat(`\u{1F4E2} ${prompt}`, "prompt", {}, scope),
    nodeShowprompt: (d, showprompt, scope) => chat(`\u{1F4E2} ${showprompt}`, "prompt", {}, scope),
    humanWaiting: (d, snap, scope) => chat(d.prompt?.trim?.().length > 0 ? `\u{1F3AD} \u7B49\u5F85\u4F60\u7684\u56DE\u5E94\uFF1A${d.prompt}` : "\u{1F3AD} \u7B49\u5F85\u4F60\u7684\u56DE\u5E94", "human_wait", {}, scope),
    aiSpoken: (d, output, actor, scope) => chat(output, "role", { actor }, scope),
    playDone: (d, _changed) => chat(PLAY_BROADCAST.done, "sys"),
    playError: (d, detail, _changed) => chat(PLAY_BROADCAST.error(detail), "error"),
    playPaused: (d, _changed) => chat(PLAY_BROADCAST.paused, "sys"),
    authorNotice: (d, message) => chat(`\u26A0\uFE0F ${message}`, "notice"),
    ...verbsOpt ?? {}
  };
  let playName = "";
  let actors = [];
  let mainActors = [];
  const mirrorOf = (jobId) => Number.isFinite(jobId) ? store.jobs.get(jobId) : void 0;
  const scopeIn = (jobId, nodeName) => {
    if (nodeName === void 0) return void 0;
    return mirrorOf(jobId)?.nodeScopes.get(nodeName);
  };
  const directiveQueue = [];
  const directiveWaiters = [];
  function wakeOne() {
    while (directiveWaiters.length > 0 && directiveQueue.length > 0) {
      directiveWaiters.shift()(directiveQueue.shift());
    }
  }
  function pushDirective(item) {
    if (dispatch !== "queue") return;
    directiveQueue.push(item);
    wakeOne();
  }
  function terminate(kind, extra2 = {}) {
    if (dispatch !== "queue") return;
    directiveQueue.length = 0;
    pushDirective({ kind, ...extra2 });
  }
  const chat = (text, kind, opts = {}, targetActors) => board.chat(text, { kind, ...opts }, { targetActors });
  function handleEvent(eventType, d0) {
    const d = d0 ?? {};
    const jobId = Number.isFinite(d.job_id) ? d.job_id : void 0;
    if (skipEvents.has(eventType)) return { eventType, jobId };
    switch (eventType) {
      case "flow_start": {
        actors = Array.isArray(d.actors) ? d.actors.filter((x) => typeof x === "string") : [];
        mainActors = Array.isArray(d.main_actors) ? d.main_actors.filter((x) => typeof x === "string") : [];
        playName = typeof d.name === "string" ? d.name : "";
        if (jobId !== void 0) jobMirrorPrearm(store, jobId, sidOf(jobId, d));
        board.ensureWindows(actors);
        verbs.flowStarted(d, playName, actors);
        break;
      }
      case "node_start": {
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const scopeInfo = Array.isArray(d.scope) ? d.scope.filter((x) => typeof x === "string") : void 0;
        const mirror = mirrorOf(jobId);
        if (mirror !== void 0) noteNodeScope(mirror, nodeName, scopeInfo);
        if ((d.node_type === "human" || d.node_type === "notice") && typeof d.prompt === "string" && d.prompt.trim().length > 0) {
          verbs.nodePrompt(d, d.prompt, scopeIn(jobId, nodeName));
        }
        break;
      }
      case "context_ready": {
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const actorName = typeof d.actor_name === "string" && d.actor_name.length > 0 ? d.actor_name : void 0;
        const showprompt = typeof d.showprompt === "string" && d.showprompt.trim().length > 0 ? d.showprompt : void 0;
        const mirror = mirrorOf(jobId);
        if (mirror !== void 0) {
          noteNodeActor(mirror, nodeName, actorName);
          noteNodeShowprompt(mirror, nodeName, showprompt);
        }
        if (showprompt !== void 0) {
          if (nodeName === void 0) verbs.nodeShowprompt(d, showprompt, scopeIn(jobId, nodeName));
        }
        break;
      }
      case "human_wait": {
        const mirror = mirrorOf(jobId);
        const snap = waitingHumanFromEvent(d);
        if (mirror !== void 0) setMirrorWaitingHuman(mirror, snap);
        const scope = snap.waitScope ?? [];
        verbs.humanWaiting(d, snap, scope);
        pushDirective({ kind: "human_wait", job_id: jobId, wait_key: snap.waitKey, prompt: snap.prompt, scope });
        break;
      }
      case "human_done": {
        const mirror = mirrorOf(jobId);
        if (mirror !== void 0) clearMirrorWaitingHuman(mirror);
        break;
      }
      case "ai_done": {
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const output = typeof d.output === "string" && d.output.length > 0 ? d.output : void 0;
        if (output !== void 0 && nodeName !== void 0) {
          const actor = mirrorOf(jobId)?.nodeActors.get(nodeName) ?? nodeName;
          verbs.aiSpoken(d, output, actor, scopeIn(jobId, nodeName));
        }
        break;
      }
      case "ai_request": {
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const scopeInfo = Array.isArray(d.scope_info) ? d.scope_info.filter((x) => typeof x === "string") : void 0;
        const mirror = mirrorOf(jobId);
        if (mirror !== void 0) noteNodeScope(mirror, nodeName, scopeInfo);
        if (String(d.source ?? "") === "main") {
          const b = (d.blocks ?? {}) instanceof Object ? d.blocks : {};
          pushDirective({
            kind: "directive",
            node: String(d.node_name ?? ""),
            actor_name: String(d.actor_name ?? ""),
            prompt: String(b.prompt ?? ""),
            context: String(b.context ?? ""),
            memory: String(b.memory ?? ""),
            job_id: jobId,
            wait_key: String(d.wait_key ?? ""),
            scope: Array.isArray(d.scope_info) ? d.scope_info.filter((x) => typeof x === "string") : void 0
          });
        } else {
          pushDirective({
            kind: "ai_node",
            node: String(d.node_name ?? ""),
            actor_name: String(d.actor_name ?? ""),
            brief_id: String(d.wait_key ?? ""),
            job_id: jobId,
            wait_key: String(d.wait_key ?? ""),
            scope: Array.isArray(d.scope_info) ? d.scope_info.filter((x) => typeof x === "string") : void 0
          });
        }
        break;
      }
      case "flow_done": {
        const changed = jobId !== void 0 ? jobMirrorSetState(store, jobId, "finished") : void 0;
        clearActiveIfActive(store, jobId);
        verbs.playDone(d, changed === "changed");
        terminate("flow_done", { summary: typeof d.summary === "string" ? d.summary : "" });
        break;
      }
      case "flow_error": {
        const changed = jobId !== void 0 ? jobMirrorSetState(store, jobId, "failed") : void 0;
        clearActiveIfActive(store, jobId);
        verbs.playError(d, String(d.error ?? "unknown error"), changed === "changed");
        terminate("flow_error", { error: String(d.error ?? "unknown error") });
        break;
      }
      case "flow_paused": {
        const mirror = mirrorOf(jobId);
        const changed = jobId !== void 0 ? jobMirrorSetState(store, jobId, "suspended") : void 0;
        if (mirror !== void 0) clearMirrorWaitingHuman(mirror);
        clearActiveIfActive(store, jobId);
        verbs.playPaused(d, changed === "changed");
        terminate("flow_paused");
        break;
      }
      case "notify_author": {
        if (typeof d.message === "string" && d.message.length > 0) verbs.authorNotice(d, d.message);
        break;
      }
      default:
        break;
    }
    return { eventType, jobId };
  }
  function takeDirective() {
    return directiveQueue.shift();
  }
  function head() {
    return directiveQueue[0];
  }
  function takeHead() {
    return directiveQueue.shift();
  }
  function waitDirective() {
    if (directiveQueue.length > 0) return Promise.resolve(directiveQueue.shift());
    return new Promise((resolve2) => directiveWaiters.push(resolve2));
  }
  function pendingDirectiveCount() {
    return directiveQueue.filter((x) => x.kind === "directive").length;
  }
  function submitOutput(jobId, waitKey, output, steps, soul = "main", modelId) {
    return send("post_speech", executorSpeechArgs({
      jobId,
      waitKey,
      soul,
      output,
      steps,
      ...modelId === void 0 ? {} : { modelId }
    }), 3e4);
  }
  function submitHumanOutput(jobId, waitKey, output, soul, variables) {
    return send("post_speech", humanSpeechArgs({ jobId, waitKey, soul, text: output, variables }), 3e4);
  }
  function projectUserLine(actorName, text, scope) {
    chat(text, "role", { actor: actorName }, scope);
  }
  function wireWaitingHuman() {
    const mirror = activeJobOf(store, sid);
    const wh = mirror?.waitingHuman;
    if (wh === void 0) return void 0;
    return {
      job_id: mirror.jobId,
      wait_key: wh.waitKey,
      node_name: wh.nodeName,
      prompt: wh.prompt,
      scope: wh.waitScope ?? []
    };
  }
  function state() {
    const activeMirror = activeJobOf(store, sid);
    return {
      sid,
      running: activeMirror !== void 0 && activeMirror.state === "running",
      playName,
      actors,
      mainActors,
      jobId: activeMirror?.jobId,
      waitingHuman: wireWaitingHuman(),
      pendingDirectives: pendingDirectiveCount()
    };
  }
  return {
    handleEvent,
    takeDirective,
    waitDirective,
    pendingDirectiveCount,
    head,
    takeHead,
    submitOutput,
    submitHumanOutput,
    projectUserLine,
    state,
    // 供测试/诊断窥视：
    _internal: { store, running: () => state().running, waitingHuman: () => wireWaitingHuman() }
  };
}

// host/events/engine-events.ts
var variableCanvasWired = false;
var diagTs = () => (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
var MAIN_CATCHUP_NOTE_PREFIX = "\u3010\u540E\u53F0\u8865\u8BFE\u3011\u4EE5\u4E0B\u662F\u300C\u4F60\u4E0A\u6B21\u767B\u53F0\u53D1\u8A00 \u2192 \u73B0\u5728\u300D\u4F60\u9519\u8FC7\u7684\u5267\u60C5\u8FDB\u5C55\uFF08\u672C\u6750\u6599\u53EA\u6709\u4F60\u80FD\u770B\u5230\uFF09\u3002\u7528\u6237\u6B63\u5728\u548C\u4F60\u4EA4\u8C08\uFF1A\u5148\u6D88\u5316\u4E0B\u9762\u7684\u8FDB\u5C55\u518D\u56DE\u5E94\u7528\u6237\uFF0C\u4E0D\u8981\u539F\u6587\u590D\u8FF0\u8FD9\u4EFD\u6750\u6599\u3002\n\n";
function rememberEvent(eventType, data) {
  sseChannel.remember(eventType, data);
}
function jobMirrorPrearm2(runState, jobId, ownerSid) {
  jobMirrorPrearm(runState, jobId, ownerSid);
}
function jobMirrorCorrect2(runState, jobId, ownerSid) {
  jobMirrorCorrect(runState, jobId, ownerSid);
}
function jobMirrorSetState2(runState, jobId, state) {
  if (jobMirrorSetState(runState, jobId, state) === "changed") {
    const mirror = runState.jobs.get(jobId);
    if (mirror !== void 0) broadcastSse("run_state", { sid: mirror.ownerSid, job_id: jobId, state });
  }
}
function isSessionRunning2(runState, sessionId) {
  return isSessionRunning(runState, sessionId);
}
function activeJobOfSession(runState, sessionId) {
  return activeJobOf(runState, sessionId);
}
function registerEngineEventHandlers(ctx, deps) {
  const { resolved, bridge, runState, sessionsStore, projections, godMirror, recordError, broker: broker2 } = deps;
  const broadcastRunStateChange = (jobId, changed, state) => {
    if (!changed || jobId === void 0) return;
    const mirror = runState.jobs.get(jobId);
    if (mirror !== void 0) broadcastSse("run_state", { sid: mirror.ownerSid, job_id: jobId, state });
  };
  const triage = createEventCore({
    store: runState,
    resolveSid: (jobId) => {
      const mirror = runState.jobs.get(jobId);
      return mirror !== void 0 ? String(mirror.ownerSid) : "";
    },
    board: { ensureWindows: () => {
    }, chat: () => {
    } },
    verbs: {
      playDone: (d, changed) => broadcastRunStateChange(typeof d.job_id === "number" ? d.job_id : void 0, changed, "finished"),
      playError: (d, _detail, changed) => broadcastRunStateChange(typeof d.job_id === "number" ? d.job_id : void 0, changed, "failed"),
      playPaused: (d, changed) => broadcastRunStateChange(typeof d.job_id === "number" ? d.job_id : void 0, changed, "suspended")
    },
    skip: [
      "flow_start",
      "human_wait",
      "ai_done",
      "checkpoint",
      "bridge_run_ended",
      "node_retry",
      "node_settled",
      "notify_author"
    ]
  });
  if (!variableCanvasWired) {
    variableCanvasWired = true;
    variableApi.subscribe("full", (record) => {
      const out = record.kind === "checkpoint" ? variableApi.toView(record, "brief") : record;
      const mirror = typeof out.jobId === "number" ? runState.jobs.get(out.jobId) : void 0;
      const envelope = {
        ...out,
        job_id: out.jobId,
        ...mirror !== void 0 ? { sid: mirror.ownerSid } : {}
      };
      broadcastSse("variable_record", envelope);
      rememberEvent("variable_record", envelope);
    });
  }
  ctx.on("agent/pre-step", async ({ agent, messages, step, signal }, next) => {
    const decision = await next();
    if (decision === void 0 || signal.aborted) return decision;
    if (decision.kind !== "enter") return decision;
    if (!isFemoAgent(agent) && !isSessionRunning2(runState, String(agent.session.id))) return decision;
    const sid = String(agent.session.id);
    const gated = gatePreStep({
      messages: decision.messages,
      step,
      mainAnswerPending: isMainAnswerPending(sid),
      running: isSessionRunning2(runState, sid),
      tag: sid
    });
    if (gated.kind !== "enter") return gated;
    if (step === 1 && isSessionRunning2(runState, sid) && gated.messages.some((m) => m.source?.kind === "user")) {
      const jobId = runState.sidIndex.get(sid) ?? runState.activeJobId;
      if (jobId !== void 0) {
        try {
          const res = await bridge.send("mail_catchup", { job_id: jobId }, 15e3);
          const text = typeof res?.text === "string" ? res.text.trim() : "";
          if (text.length > 0) {
            const note = {
              id: randomUUID3(),
              role: "user",
              content: [{ type: "text", text: MAIN_CATCHUP_NOTE_PREFIX + text }],
              source: FEMO_PLUGIN_SOURCE
            };
            const admitted = gated.messages.slice();
            admitted.splice(Math.max(admitted.length - 1, 0), 0, note);
            console.log(`[femo-plugin] main catchup injected: job=${jobId} ctx=${text.length}ch`);
            return { kind: "enter", messages: admitted };
          }
        } catch (error) {
          console.log(`[femo-plugin] main catchup skipped: ${String(error instanceof Error ? error.message : error)}`);
        }
      }
    }
    return gated;
  });
  ctx.on("session/event", (session, event) => {
    if (presetOf(session) !== FEMO_PRESET && !isSessionRunning2(runState, String(session.id)) && !isMainAnswerPending(String(session.id))) return;
    if (session.header.parentSession !== void 0) return;
    mainSessionEventHook(ctx, session, event, bridge, resolved, projections);
  });
  godMirror.registerRealtimeListener(ctx);
  ctx.on("session/event", (session, event) => {
    if (session.header.parentSession !== void 0) return;
    if (event.type === "turn/end") directorLive.get(String(session.id))?.frames.endTurn();
  });
  const directorLive = /* @__PURE__ */ new Map();
  onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === void 0) return;
    if (agent?.session?.header?.parentSession !== void 0) return;
    const sid0 = String(agent?.session?.id ?? agent?.id ?? "");
    if (sid0.length === 0) return;
    const seg = hubHostSegCurrent(sid0);
    if (seg === void 0) return;
    const turn = typeof frame.turn === "number" ? frame.turn : void 0;
    let live = directorLive.get(sid0);
    if (live === void 0 || turn !== void 0 && live.turn !== turn || live.seg !== seg) {
      live = {
        turn,
        seg,
        frames: new LiveStreamFrames({
          // 主Agent流喂的是**宿主自造的整键**（h:<sid>:<seq>）——必须走 segRef：
          // 塞进 ref 会被 hub 当成引擎令牌再套一层 'w:'，字就落进幻影段了
          // （2026-09-19：ref=令牌 / segRef=整键 两个字段语义互斥，见 hub-feed.ts）。
          sid: sid0,
          node_name: "",
          actor: "\u4E3BAgent",
          segRef: seg,
          ...turn !== void 0 ? { turn } : {}
        })
      };
      directorLive.set(sid0, live);
    }
    live.frames.frame(frame);
  });
  installMainActorStreamBridge(ctx);
  ctx.on("femo-plugin/event", (eventType, data) => {
    if (eventType === "flow_start") console.log(`[femo-plugin][diag] flow_start event received; activeJobId=${String(runState.activeJobId ?? "-")}`);
    const d0 = data ?? {};
    const onVariableBus = variableApi.handles(eventType);
    if (onVariableBus) variableApi.ingest(eventType, d0);
    const jobId = typeof d0.job_id === "number" ? d0.job_id : void 0;
    hubFeedSetJob(jobId ?? null);
    const mirror = jobId !== void 0 ? runState.jobs.get(jobId) : void 0;
    if (jobId === void 0 || mirror === void 0) {
      pushDiag("ev-in", `${eventType} DROPPED(no-mirror) job=${String(d0.job_id ?? "-")}`);
      if (eventType === "flow_start") console.log("[femo-plugin][diag] flow_start without mirror: broadcast only");
      console.log(`[femo-plugin] event ${eventType} without mirror (job_id=${String(d0.job_id ?? "-")}); broadcast only`);
      if (!onVariableBus) {
        broadcastSse(eventType, data);
        rememberEvent(eventType, data);
      }
      return;
    }
    const sessionId = SessionId(mirror.ownerSid);
    const envelope = { ...d0, sid: mirror.ownerSid, job_id: jobId };
    if (!onVariableBus) {
      broadcastSse(eventType, envelope);
      rememberEvent(eventType, envelope);
    }
    const session = sessionsStore?.get(sessionId);
    if (session === void 0) {
      pushDiag("ev-in", `${eventType} DROPPED(no-session) job=${jobId} sid=${String(sessionId)}`);
      if (eventType === "flow_start") console.log(`[femo-plugin][diag] flow_start broadcast done but DROPPED before sessionActors.set: session ${String(sessionId)} not in store`);
      return;
    }
    if (eventType === "human_wait" || eventType === "human_done") {
      pushDiag("ev-in", `${eventType} dispatched job=${jobId} wait_key=${String(d0.wait_key ?? "-")}`);
    }
    triage.handleEvent(eventType, eventType === "context_ready" ? { ...d0, actor_name: actorNameOf(d0) } : d0);
    const d = d0;
    switch (eventType) {
      case "flow_start": {
        const actors = Array.isArray(d.actors) ? d.actors.filter((x) => typeof x === "string") : [];
        runState.sessionActors.set(String(sessionId), actors);
        clearMainPlayState(
          String(sessionId),
          typeof d.name === "string" ? d.name : "",
          Array.isArray(d.main_actors) ? d.main_actors.filter((x) => typeof x === "string") : []
        );
        clearGuestActors([...runState.jobs.values()].map((m) => m.ownerSid));
        console.log(`[femo-plugin][diag] flow_start processed: sessionActors[${String(sessionId)}]=${JSON.stringify(actors)} (femoSession=${String(d.session_id)})`);
        jobMirrorCorrect2(runState, jobId, String(sessionId));
        if (typeof d.session_id === "number") {
          void appendFemoSession(resolved.femoRoot, String(sessionId), d.session_id).catch((error) => console.log(`[femo-plugin] femoSessions append failed: ${String(error)}`));
        }
        const header = session.header;
        debugLogMainActor(resolved, `[\u5BBF\u4E3B] flow_start \u5EFA\u7A97\u68C0\u67E5: cwd=${header?.cwd ?? "\u65E0"} actors=${JSON.stringify(actors)}`);
        if (header?.cwd === void 0 || header.cwd.length === 0) {
          console.log(`[femo-plugin] flow_start ${String(sessionId)}: session cwd missing \u2014 projection windows NOT ensured (process.cwd() fallback forbidden)`);
          break;
        }
        void projections.ensure(String(sessionId), actors, header.cwd).then(() => {
          debugLogMainActor(resolved, `[\u5BBF\u4E3B] flow_start ensure \u5B8C\u6210: ${JSON.stringify(actors)}`);
        }).catch((error) => {
          debugLogMainActor(resolved, `!! flow_start ensure \u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`);
          console.log(`[femo-plugin] flow_start ensure projection windows failed: ${String(error)}`);
        });
        break;
      }
      case "node_start": {
        break;
      }
      case "context_ready": {
        break;
      }
      case "human_wait": {
        console.log(`[femo-plugin] human_wait received (bookkeeping; apply via mailbox-push): job=${jobId} node=${String(d.node_name ?? "-")} wait_key=${String(d.wait_key ?? "-")}`);
        pushDiag("human_wait", `ARRIVE job=${jobId} node=${String(d.node_name ?? "-")} wait_key=${String(d.wait_key ?? "-")}`);
        break;
      }
      case "human_done": {
        console.log(`[femo-plugin] human_done received: job=${jobId} -> waitingHuman CLEARED`);
        pushDiag("human_done", `CLEARED job=${jobId} (\u8F93\u5165\u88AB\u5F15\u64CE\u6D88\u8D39\uFF1A\u6B63\u5E38\u8F93\u5165/\u7A7A\u8F93\u5165\u8D85\u65F6\u653E\u884C\u5747\u8D70\u6B64\u4FE1\u53F7)`);
        broadcastProjectionState(runState, String(sessionId));
        break;
      }
      case "checkpoint": {
        const cp = d.checkpoints ?? {};
        console.log(`[femo-cp-diag ${diagTs()}] checkpoint ARRIVE sid=${String(sessionId)} job=${jobId} cps=${JSON.stringify(cp)} femoSession=${String(d.session_id ?? "-")} \u65AD\u70B9\u5DF2\u7531\u5F15\u64CE\u843D\u76D8`);
        break;
      }
      case "ai_done": {
        {
          const doneNode = typeof d.node_name === "string" ? d.node_name : void 0;
          const doneOutput = typeof d.output === "string" ? d.output : "";
          if (doneNode !== void 0) {
            const doneActor = mirror.nodeActors.get(doneNode) ?? doneNode;
            const doneScopes = mirror.nodeScopes.get(doneNode);
            const counted = noteFlowLineAll(doneActor, doneOutput, doneScopes);
            debugLogMainActor(resolved, `[\u5BBF\u4E3B] ai_done \u8BB0\u8D26: node=${doneNode} actor=${doneActor} out=${doneOutput.length}ch scopes=${JSON.stringify(doneScopes ?? null)} \u2192 \u4F1A\u8BDD\u89D2\u8272\u5165\u8D26=${counted}`);
          }
        }
        if (resolved.hostAiBackend) break;
        const output = typeof d.output === "string" && d.output.length > 0 ? d.output : void 0;
        if (output !== void 0) {
          const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
          const actor = nodeName === void 0 ? void 0 : mirror.nodeActors.get(nodeName) ?? nodeName;
          projectedCompat(ctx, session, projections, output, "role", actor, nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName), true);
        }
        break;
      }
      case "ai_request": {
        console.log(`[femo-plugin] ai_request received (bookkeeping; dispatch via mailbox-push) node=${String(d.node_name ?? "")} source=${String(d.source ?? "-")} wait_key=${String(d.wait_key ?? "")} job=${jobId}`);
        break;
      }
      case "flow_done": {
        console.log(`[femo-cp-diag ${diagTs()}] flow_done ARRIVE sid=${String(sessionId)} job=${jobId} \u2192 Job finished\uFF08\u65AD\u70B9\u4F5C\u5E9F\u7531\u5F15\u64CE finalize \u627F\u62C5\uFF09`);
        broadcastProjectionState(runState, String(sessionId));
        broadcastCompat(ctx, session, projections, PLAY_BROADCAST.done);
        flushMainFinalDelta(ctx, sessionId, resolved);
        break;
      }
      case "flow_error": {
        const abortedOnError = abortJobSubagents(jobId, "FEMO \u8FD0\u884C\u51FA\u9519\uFF1A\u4E2D\u65AD\u5728\u98DE AI \u89D2\u8272");
        if (abortedOnError > 0) console.log(`[femo-plugin] flow_error: aborted ${abortedOnError} in-flight subagent(s) of job ${jobId}`);
        abandonMainAnswer(String(sessionId), "FEMO \u8FD0\u884C\u51FA\u9519\uFF0C\u5728\u98DE\u6CE8\u5165\u4F5C\u5E9F", projections);
        broker2?.abortJob(jobId, "flow error");
        broadcastProjectionState(runState, String(sessionId));
        const detail = String(d.error ?? "unknown error");
        const text = `FEMO \u8FD0\u884C\u51FA\u9519\uFF1A${detail}`;
        recordError(session.id, text);
        broadcastCompat(ctx, session, projections, PLAY_BROADCAST.error(detail));
        break;
      }
      case "flow_paused": {
        const abortedOnPause = abortJobSubagents(jobId, "FEMO\u811A\u672C\u6682\u505C\uFF1A\u4E2D\u65AD\u5728\u98DE AI \u89D2\u8272");
        if (abortedOnPause > 0) console.log(`[femo-plugin] flow_paused: aborted ${abortedOnPause} in-flight subagent(s) of job ${jobId}`);
        abandonMainAnswer(String(sessionId), "FEMO\u811A\u672C\u6682\u505C\uFF0C\u5728\u98DE\u6CE8\u5165\u4F5C\u5E9F", projections);
        broker2?.abortJob(jobId, "flow paused");
        pushDiag("flow_paused", `suspended + waitingHuman CLEARED job=${jobId}`);
        broadcastProjectionState(runState, String(sessionId));
        broadcastCompat(ctx, session, projections, PLAY_BROADCAST.paused(String(d.error ?? "")));
        break;
      }
      case "bridge_run_ended": {
        broker2?.abortJob(jobId, "bridge run ended");
        hubFeedSetJob(null);
        clearMirrorWaitingHuman(mirror);
        pushDiag("bridge_run_ended", `waitingHuman CLEARED job=${jobId} ok=${String(d.ok ?? "-")}`);
        if (mirror.state === "running") {
          jobMirrorSetState2(runState, jobId, "failed");
        }
        clearActiveIfActive(runState, jobId);
        break;
      }
      case "node_retry": {
        break;
      }
      case "notify_author": {
        const severity = String(d.severity ?? "");
        const message = String(d.message ?? "");
        if (severity === "fatal") {
          console.log(`[femo-plugin] notify_author(fatal) node=${String(d.node_name ?? "")}: ${message}`);
          break;
        }
        if (severity === "warning") {
          recordError(session.id, message);
          broadcastCompat(ctx, session, projections, `\u2139\uFE0F ${message}`);
          break;
        }
        recordError(session.id, message);
        broadcastCompat(ctx, session, projections, `\u26A0\uFE0F ${message}`);
        break;
      }
      case "node_settled": {
        broker2?.markSettled(String(d.wait_key ?? ""));
        break;
      }
      default:
        break;
    }
  });
}

// host/diag/host-log.ts
import { dirname as dirname5 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
var SELF_DIR = dirname5(fileURLToPath3(import.meta.url)).replace(/\\/g, "/");
var LEVELS = ["log", "info", "warn", "error"];
var TEXT_MAX = 400;
function fmtArg(a) {
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.message;
  if (a === null) return "null";
  if (a === void 0) return "undefined";
  try {
    const s = JSON.stringify(a);
    return s === void 0 ? String(a) : s;
  } catch {
    return String(a);
  }
}
function isCalledFromSelf(stack) {
  if (stack === void 0) return false;
  const frames = stack.split("\n");
  for (let i = 2; i < frames.length; i += 1) {
    if (frames[i].replace(/\\/g, "/").includes(SELF_DIR)) return true;
  }
  return false;
}
var installed = false;
function installHostLogCapture(sink) {
  if (installed) return;
  installed = true;
  const emit = sink ?? ((level, text) => pushDiag("host", text));
  for (const name2 of LEVELS) {
    const orig = console[name2];
    if (typeof orig !== "function") continue;
    console[name2] = (...args) => {
      try {
        if (isCalledFromSelf(new Error().stack)) {
          const body = args.map(fmtArg).join(" ").slice(0, TEXT_MAX);
          emit(name2, name2 === "log" ? body : `[${name2}] ${body}`);
        }
      } catch {
      }
      orig.apply(console, args);
    };
  }
  emit("log", "Host \u65E5\u5FD7\u91C7\u96C6\u5DF2\u542F\u52A8\uFF1A\u6295\u5F71\u7A97\u3001\u4F1A\u8BDD\u7B49\u5BBF\u4E3B\u4FA7\u65E5\u5FD7\u5C06\u5B9E\u65F6\u663E\u793A\u5728\u8FD9\u91CC");
}

// ../../femo2host/host/tools-core.mjs
import { existsSync as existsSync5, mkdtempSync, readFileSync as readFileSync5, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import { join as join13 } from "node:path";

// ../../femo2host/host/debug-run-core.mjs
import { basename, dirname as dirname6, join as join11 } from "node:path";
import { mkdir as mkdir2, open, readFile as readFile2, stat as stat2, writeFile } from "node:fs/promises";
import { readdir as readdir2, unlink } from "node:fs/promises";
var DEBUG_TIMEOUT_MS = 18e4;
var TRANSCRIPT_MAX_LINES = 1500;
var TRANSCRIPT_HEAD_LINES = 600;
var STDERR_MAX_CHARS = 2e3;
var REPORT_SNAPSHOT_MAX = 40;
var REPORT_WARNING_MAX = 20;
function clampRuns(value) {
  return Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), 20);
}
function normalizeSeed(value) {
  return value !== void 0 && value !== null && Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : void 0;
}
function normalizeModule(value) {
  const s = typeof value === "string" ? value.trim().replace(/^&+/, "") : "";
  return s.length > 0 ? s : void 0;
}
var inFlight = false;
function acquireDebugRun() {
  if (inFlight) return false;
  inFlight = true;
  return true;
}
function releaseDebugRun() {
  inFlight = false;
}
async function sweepDebugSandbox(sandboxDir, keepHours = 24) {
  try {
    const cutoff = Date.now() - keepHours * 36e5;
    for (const name2 of await readdir2(sandboxDir)) {
      const fp = join11(sandboxDir, name2);
      try {
        const st = await stat2(fp);
        if (st.isFile() && st.mtimeMs < cutoff) await unlink(fp);
      } catch {
      }
    }
  } catch {
  }
}
async function prepareDebugSandbox(femoRoot2, req) {
  const sandboxDir = join11(femoRoot2, "cache", "debug-sandbox");
  await mkdir2(sandboxDir, { recursive: true });
  void sweepDebugSandbox(sandboxDir);
  const stamp = Date.now();
  const sandboxScript = join11(sandboxDir, `web-${stamp}.femo`);
  const logPath = join11(sandboxDir, `web-${stamp}.jsonl`);
  const reportPath = join11(sandboxDir, `web-${stamp}.report.json`);
  await writeFile(sandboxScript, req.femo, "utf8");
  return { sandboxScript, logPath, reportPath };
}
async function buildDebuggerArgv({ femoRoot: femoRoot2, sandbox, req, runs, seed, module }) {
  const argv = [
    join11(femoRoot2, "femo2host", "femoToolcall", "femo_debugger.py"),
    "run",
    sandbox.sandboxScript,
    "--quiet",
    "--log-jsonl",
    sandbox.logPath,
    // 终报 JSON：工具路径的唯一权威汇总（人读版 print_report 只进 stdout）。
    "--report",
    sandbox.reportPath,
    "--runs",
    String(clampRuns(runs))
  ];
  let note;
  const savedScriptPath = req.scriptPath?.trim() ?? "";
  if (savedScriptPath.length > 0) {
    const dir = dirname6(savedScriptPath);
    try {
      await stat2(dir);
      argv.push("--base-dir", dir);
    } catch {
      note = `scriptPath \u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u56DE\u9000\u6C99\u76D2\u89E3\u6790: ${dir}`;
    }
  }
  const seedNorm = normalizeSeed(seed);
  if (seedNorm !== void 0) argv.push("--seed", String(seedNorm));
  const debugModule = normalizeModule(module);
  if (debugModule !== void 0) argv.push("--module", debugModule);
  return { argv, note };
}
async function collectDebugRun({ femoRoot: femoRoot2, spawnProc, req, signal, onProgress, timeoutMs }) {
  const runs = clampRuns(req.runs);
  const seed = normalizeSeed(req.seed);
  const budget = timeoutMs ?? DEBUG_TIMEOUT_MS;
  if (signal?.aborted === true) {
    return emptyCollect(runs, seed);
  }
  if (!acquireDebugRun()) {
    throw new Error("\u5DF2\u6709\u8C03\u8BD5\u5E72\u8DD1\u5728\u8FDB\u884C\u4E2D\uFF08\u8C03\u8BD5\u7A97\u6216\u53E6\u4E00\u6B21 femo-debug \u8C03\u7528\uFF09\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u518D\u8BD5");
  }
  const startedAt = Date.now();
  let timedOut = false;
  let aborted = false;
  let proc;
  const onAbort = () => {
    aborted = true;
    try {
      proc?.terminate();
    } catch {
    }
  };
  try {
    const sandbox = await prepareDebugSandbox(femoRoot2, req);
    const { argv, note } = await buildDebuggerArgv({ femoRoot: femoRoot2, sandbox, req, runs, seed, module: req.module });
    if (note !== void 0) onProgress?.(note);
    const err = [];
    const out = [];
    try {
      proc = spawnProc({
        argv,
        cwd: femoRoot2,
        env: { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
        onStderrLine: (line) => err.push(line),
        onStdoutChunk: (text) => out.push(text)
      });
    } catch (error) {
      throw new Error(`\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\u542F\u52A8\u5931\u8D25: ${String(error)}`);
    }
    if (signal !== void 0) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    onProgress?.(`\u5E72\u8DD1\u542F\u52A8\uFF1A${runs} \u8F6E${seed !== void 0 ? `\uFF0Cseed=${seed}` : ""}\uFF08\u6C99\u76D2\u811A\u672C ${basename(sandbox.sandboxScript)}\uFF09`);
    const done = proc.done.then((outcome2) => outcome2, () => void 0);
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.terminate();
      } catch {
      }
    }, budget);
    let outcome;
    try {
      outcome = await done;
    } finally {
      clearTimeout(timer);
    }
    const exitCode = outcome?.exitCode ?? -1;
    const rawLog = await readFile2(sandbox.logPath, "utf8").catch(() => "");
    const records = [];
    for (const line of rawLog.split(/\r?\n/)) {
      if (line.trim().length === 0) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
      }
    }
    let report;
    try {
      report = JSON.parse(await readFile2(sandbox.reportPath, "utf8"));
    } catch {
      report = void 0;
    }
    const { lines, dropped } = debugTranscriptLines(records);
    const stderr = err.join("\n");
    const elapsedMs = Date.now() - startedAt;
    let partialPath;
    if ((aborted || timedOut) && lines.length > 0) {
      partialPath = sandbox.logPath.replace(/\.jsonl$/, ".partial.md");
      const header = `# \u5E72\u8DD1\u88AB\u4E2D\u65AD\u65F6\u7684\u90E8\u5206\u4FE1\u606F\uFF08${aborted ? "\u8C03\u7528\u65B9\u64A4\u9500\uFF08\u56DE\u5408\u88AB\u4E2D\u65AD/\u7528\u6237\u505C\u6B62\uFF09" : "\u770B\u95E8\u72D7\u8D85\u65F6\u5F3A\u5236\u7EC8\u6B62"}\uFF09

- \u6C99\u76D2FEMO\u811A\u672C\uFF1A${sandbox.sandboxScript}
- \u539F\u59CB\u6D41\u6C34(JSONL)\uFF1A${sandbox.logPath}
- \u7528\u65F6\uFF1A${(elapsedMs / 1e3).toFixed(1)}s\u3000\u6D41\u6C34\uFF1A${records.length} \u6761
- \u7EC8\u62A5\uFF1A\u672A\u751F\u6210\uFF08\u5F15\u64CE\u672A\u8DD1\u5B8C\uFF0C\u6CA1\u6709 --report \u4EA7\u51FA\uFF09

## \u6D41\u6C34\uFF08\u4E0E\u8C03\u8BD5\u7A97\u540C\u6B3E\u6E32\u67D3\uFF09

`;
      try {
        await writeFile(partialPath, header + lines.join("\n") + "\n", "utf8");
      } catch {
        partialPath = void 0;
      }
    }
    onProgress?.(`\u5E72\u8DD1\u7ED3\u675F\uFF1Aexit=${exitCode} \u6D41\u6C34 ${records.length} \u6761 \u7EC8\u62A5${report === void 0 ? "\u65E0" : "\u6709"}${timedOut ? "\uFF08\u770B\u95E8\u72D7\u8D85\u65F6\uFF09" : ""}${aborted ? "\uFF08\u88AB\u64A4\u9500\uFF09" : ""} \u7528\u65F6 ${(elapsedMs / 1e3).toFixed(1)}s${partialPath !== void 0 ? `\u3000\u90E8\u5206\u4FE1\u606F\u7559\u6863\uFF1A${partialPath}` : ""}`);
    return {
      exitCode,
      timedOut,
      aborted,
      runs,
      ...seed !== void 0 ? { seed } : {},
      elapsedMs,
      records,
      ...report !== void 0 ? { report } : {},
      transcript: lines.join("\n"),
      transcriptDropped: dropped,
      ...partialPath !== void 0 ? { partialPath } : {},
      stderr: stderr.length > STDERR_MAX_CHARS ? stderr.slice(-STDERR_MAX_CHARS) : stderr,
      sandboxScript: sandbox.sandboxScript,
      logPath: sandbox.logPath,
      reportPath: sandbox.reportPath
    };
  } finally {
    releaseDebugRun();
    if (signal !== void 0) signal.removeEventListener("abort", onAbort);
  }
}
function emptyCollect(runs, seed) {
  return {
    exitCode: -1,
    timedOut: false,
    aborted: true,
    runs,
    ...seed !== void 0 ? { seed } : {},
    elapsedMs: 0,
    records: [],
    transcript: "",
    transcriptDropped: 0,
    stderr: "",
    sandboxScript: "",
    logPath: "",
    reportPath: ""
  };
}
function formatDebugRecordLine(rec) {
  const s = (value) => value === void 0 || value === null ? "" : String(value);
  switch (rec.kind) {
    case "run_start":
      return `\u25B6 \u7B2C ${s(rec.run) || "-"} \u8F6E\u5E72\u8DD1\u5F00\u59CB\uFF1A${s(rec.script) || "\uFF08\u672A\u547D\u540D\uFF09"}${rec.module ? `\uFF08module ${s(rec.module)}\uFF09` : ""}\uFF08seed=${s(rec.seed) || "-"}\uFF09`;
    case "node_start":
      return `\u2192 ${s(rec.node)}${rec.node_type ? `\uFF08${s(rec.node_type)}\uFF09` : ""}`;
    case "action_outs": {
      const exprs = Array.isArray(rec.exprs) ? rec.exprs.map(String).join("\uFF0C") : "";
      if (exprs.length === 0) return null;
      return rec.node_type === "func" ? `\u{1F527} ${s(rec.node)} \u5199\u56DE\uFF1A${exprs}` : `\u{1F4DD} ${s(rec.node)} \u8D4B\u503C\uFF1A${exprs}`;
    }
    case "func_result": {
      const out = rec.output === null || rec.output === void 0 ? "" : typeof rec.output === "object" ? JSON.stringify(rec.output) : String(rec.output);
      if (out.length === 0) return null;
      let ins = "";
      const input = rec.func_input;
      if (input !== null && typeof input === "object") {
        const keys = Object.keys(input);
        if (keys.length > 0) ins = `\uFF08\u5165\u53C2 ${keys.map((k) => `${k}=${JSON.stringify(input[k])}`).join("\uFF0C")}\uFF09`;
      }
      return `\u{1F527} ${s(rec.node)} \u51FD\u6570\u8FD4\u56DE\uFF1A${out.slice(0, 300)}${ins}`;
    }
    case "assign":
      return `${s(rec.node)}  ${s(rec.var)}: ${s(rec.old)} \u2192 ${s(rec.new)}`;
    case "ai_reply": {
      const values = rec.values ?? {};
      const entries = Object.entries(values);
      if (entries.length === 0) return null;
      return `\u{1F916} ${s(rec.node)} \u5408\u6210\u8D4B\u503C\uFF1A${entries.map(([k, v]) => `${k}=${s(v?.value)}\uFF08${s(v?.source)}\uFF09`).join("\uFF0C")}`;
    }
    case "human_input": {
      const parts = Object.entries(rec.variables ?? {}).map(([k, v]) => `${k}=${s(v)}`);
      if (parts.length === 0) return null;
      return `\u{1F464} ${s(rec.node)} \u5408\u6210\u8F93\u5165\uFF1A${parts.join("\uFF0C")}`;
    }
    case "retry":
      return `\u{1F501} ${s(rec.node)} \u91CD\u8BD5\u6362\u503C\uFF1A${s(rec.feedback).slice(0, 160)}`;
    case "silence":
      return `\u{1F3B2} ${s(rec.node)} \u6982\u7387\u6C89\u9ED8\uFF08\u4E0D\u8D4B\u503C ${s(rec.var)}\uFF09`;
    case "flaky":
      return `\u{1F4A5} ${s(rec.node)} \u6CE8\u5165\u65E0\u6548\u8D4B\u503C\uFF08\u6D4B\u91CD\u8BD5\u94FE\u8DEF\uFF09`;
    case "warning":
      return `\u26A0 ${s(rec.msg)}`;
    case "flow_outcome":
      return null;
    // run_end 已带结局，不重复
    case "run_end":
      return `${rec.outcome === "completed" ? "\u25A0" : "\u274C"} \u7B2C ${s(rec.run) || "-"} \u8F6E\u7ED3\u675F\uFF1A${s(rec.outcome)}${rec.error ? ` \u2014 ${String(rec.error).slice(0, 200)}` : ""}\uFF08${s(rec.elapsed) || "?"}s\uFF09`;
    case "debug_done":
      return null;
    // 退出码语义见终报尾部说明；真崩溃经 stderr/退出码表达
    case "debug_error":
      return `\u274C ${s(rec.error)}`;
    default:
      return null;
  }
}
function debugTranscriptLines(records) {
  const all = [];
  for (const rec of records) {
    const line = formatDebugRecordLine(rec);
    if (line !== null) all.push(line);
  }
  if (all.length <= TRANSCRIPT_MAX_LINES) return { lines: all, dropped: 0 };
  const tailCount = TRANSCRIPT_MAX_LINES - TRANSCRIPT_HEAD_LINES;
  const dropped = all.length - TRANSCRIPT_MAX_LINES;
  return {
    lines: [
      ...all.slice(0, TRANSCRIPT_HEAD_LINES),
      `\u2026\uFF08\u4E2D\u6BB5 ${dropped} \u884C\u5DF2\u7701\u7565\u2014\u2014\u5B8C\u6574\u6D41\u6C34\u89C1 jsonl \u843D\u76D8\u8DEF\u5F84\uFF09\u2026`,
      ...all.slice(all.length - tailCount)
    ],
    dropped
  };
}
function exitCodeNote(exitCode) {
  return exitCode === 0 ? "0\uFF08\u5168\u90E8\u8F6E\u6B21 completed\uFF0C\u6216 max_steps=\u53EF\u80FD\u662F\u65E0\u9650\u5FAA\u73AF\uFF09" : exitCode === 2 ? "2\uFF08\u90E8\u5206\u8F6E\u6B21 completed/max_steps\uFF09" : exitCode === 1 ? "1\uFF08\u65E0\u4E00\u8F6E\u53EF\u63A5\u53D7\u7ED3\u5C40 / \u7F16\u8BD1\u6216\u88C5\u914D\u5931\u8D25\uFF09" : `${exitCode}\uFF08\u975E\u6B63\u5E38\u9000\u51FA\uFF09`;
}
function formatReport(report, timeoutNote) {
  const lines = [];
  const okRuns = report.runs.filter((r) => r.outcome === "completed").length;
  const loopRuns = report.runs.filter((r) => r.outcome === "max_steps").length;
  const sumElapsed = report.runs.reduce((sum, r) => sum + (Number.isFinite(r.elapsed) ? r.elapsed : 0), 0);
  lines.push(`\u7ED3\u5C40\uFF1A${okRuns}/${report.runs.length} \u8F6E completed\uFF08\u5404\u8F6E\u5408\u8BA1 ${sumElapsed.toFixed(1)}s\uFF09` + (loopRuns > 0 ? `\uFF0C${loopRuns} \u8F6E max_steps\uFF08\u8DD1\u6EE1\u6B65\u6570\u9884\u7B97\u672A\u505C\u2014\u2014\u53EF\u80FD\u662F\u65E0\u9650\u5FAA\u73AF\uFF0C\u975E\u9519\u8BEF\uFF09` : "") + `${timeoutNote !== void 0 ? `\u3000${timeoutNote}` : ""}`);
  if (report.module_mode) {
    lines.push(`\u8303\u56F4\uFF1Amodule ${report.module_mode}` + (report.module_has_out === false ? "\uFF08\u65E0 [OUT]/[BREAK] \u51FA\u53E3\u2014\u2014\u6301\u7EED\u5FAA\u73AF\u578B\u8BBE\u8BA1\uFF0Cmax_steps \u5C5E\u9884\u671F\uFF09" : ""));
  }
  for (const r of report.runs) {
    lines.push(`  seed=${r.seed}: ${r.outcome === "max_steps" ? "max_steps\uFF08\u53EF\u80FD\u662F\u65E0\u9650\u5FAA\u73AF\uFF0C\u975E\u9519\u8BEF\uFF09" : r.outcome}` + (r.error ? ` \u2014 ${String(r.error).slice(0, 300)}` : "") + `\uFF08${r.elapsed}s\uFF09`);
  }
  if (report.node_order.length > 0) {
    lines.push(`\u8282\u70B9\u6267\u884C\uFF08${report.node_order.length} \u6B65\uFF09\uFF1A${report.node_order.slice(0, 60).join(" \u2192 ")}` + (report.node_order.length > 60 ? " \u2026" : ""));
  } else {
    lines.push("\u8282\u70B9\u6267\u884C\uFF1A\uFF08\u65E0\u2014\u2014\u4E00\u4E2A\u8282\u70B9\u90FD\u6CA1\u8DD1\u5230\uFF09");
  }
  const coverage = report.total_edges > 0 ? `${report.edges_taken.length}/${report.total_edges} (${Math.round(report.edges_taken.length / report.total_edges * 100)}%)` : "0/0";
  lines.push(`\u8FB9\u8986\u76D6\uFF1A${coverage}`);
  if (report.edges_taken.length > 0) {
    lines.push(`  \u8D70\u8FC7\u7684\u8FB9\uFF1A${report.edges_taken.slice(0, 40).join("\uFF0C")}` + (report.edges_taken.length > 40 ? ` \u2026\u5171 ${report.edges_taken.length} \u6761` : ""));
  }
  if (report.var_snapshots.length > 0) {
    lines.push(`\u53D8\u91CF\u5FEB\u7167\uFF08${report.var_snapshots.length} \u6761\uFF09\uFF1A`);
    for (const s of report.var_snapshots.slice(0, REPORT_SNAPSHOT_MAX)) {
      lines.push(`  ${String(s.node)}  ${String(s.var)}: ${String(s.old)} \u2192 ${String(s.new)}`);
    }
    if (report.var_snapshots.length > REPORT_SNAPSHOT_MAX) {
      lines.push(`  \u2026\uFF08\u8FD8\u6709 ${report.var_snapshots.length - REPORT_SNAPSHOT_MAX} \u6761\uFF09`);
    }
  }
  const warnings = [
    ...report.guess_warnings,
    ...report.silences.map((s) => `\u6982\u7387\u6C89\u9ED8: ${s}`),
    ...report.flaky_fired.map((s) => `flaky \u65E0\u6548\u8D4B\u503C: ${s}`)
  ];
  if (warnings.length > 0) {
    lines.push(`\u26A0 \u63D0\u793A ${warnings.length} \u6761\uFF08\u8C03\u8BD5\u5668\u731C\u503C\u964D\u7EA7/\u515C\u5E95/\u6982\u7387\u6C89\u9ED8\u7B49\uFF09\uFF1A`);
    for (const w of warnings.slice(0, REPORT_WARNING_MAX)) lines.push(`  \u2022 ${w}`);
    if (warnings.length > REPORT_WARNING_MAX) lines.push(`  \u2026\uFF08\u8FD8\u6709 ${warnings.length - REPORT_WARNING_MAX} \u6761\uFF09`);
  }
  const unreached = report.unreached_nodes ?? [];
  if (unreached.length > 0) {
    lines.push(`\u672A\u8FBE\u8282\u70B9\uFF08\u672C\u6B21\u4E00\u6B21\u6CA1\u8D70\u5230\u2014\u2014\u6B7B\u5206\u652F/\u6F0F\u63A5\u7EBF/\u6761\u4EF6\u6C38\u8FDC\u4E3A\u5047\uFF09\uFF1A${unreached.join("\uFF0C")}`);
  }
  return lines;
}
function debugRunToolOutcome(result) {
  const stderrTail = result.stderr.trim();
  if (result.records.length === 0 && result.report === void 0 && result.exitCode !== 0) {
    if (result.aborted) {
      return {
        ok: false,
        error: "\u672C\u6B21\u5E72\u8DD1\u5728\u4EA7\u51FA\u4EFB\u4F55\u6D41\u6C34\u4E4B\u524D\u5C31\u88AB\u64A4\u9500\uFF08\u56DE\u5408\u88AB\u4E2D\u65AD/\u7528\u6237\u505C\u6B62\uFF1B\u4E5F\u53EF\u80FD\u5361\u5728\u8D77\u8DD1\u9636\u6BB5\u2014\u2014\u770B\u8BCA\u65AD\u6D41\u7684\u300C\u5E72\u8DD1\u542F\u52A8\u300D\u90A3\u884C\u6709\u6CA1\u6709\u51FA\u73B0\uFF09\u3002\u9700\u8981\u7ED3\u679C\u7684\u8BDD\u91CD\u65B0\u8C03\u7528\u4E00\u6B21\uFF08\u8F6E\u6570\u522B\u5F00\u592A\u5927\uFF1Aruns \u662F\u7EBF\u6027\u8017\u65F6\uFF0C\u6BCF\u8F6E\u2248\u4E00\u6B21\u8C03\u8BD5\u7A97\u8C03\u8BD5\uFF09\u3002"
      };
    }
    const errorLine = stderrTail.split("\n").reverse().find((line) => /^[A-Za-z_][\w.]*(Error|Exception|Warning)?:\s/.test(line.trim()))?.trim();
    return {
      ok: false,
      error: `\u5E72\u8DD1\u672A\u80FD\u8DD1\u8D77\u6765\uFF08\u9000\u51FA\u7801 ${result.exitCode}\uFF09\u2014\u2014${result.timedOut ? "\u770B\u95E8\u72D7\u8D85\u65F6\u5F3A\u5236\u7EC8\u6B62" : "\u7F16\u8BD1/\u88C5\u914D\u9519\u8BEF\u539F\u8BDD"}\uFF1A
` + (errorLine !== void 0 ? `${errorLine}

` : "") + (stderrTail.length > 0 ? stderrTail : "\uFF08stderr \u4E3A\u7A7A\u2014\u2014\u53EF\u76F4\u63A5\u8DD1\u300C\u7F16\u8BD1\u300D\u770B\u62A5\u9519\uFF09")
    };
  }
  const parts = [];
  parts.push("\u{1F4CB} FEMO\u811A\u672C\u5E72\u8DD1\uFF08\u96F6 token \u7A7A\u8DD1\uFF1AAI/\u4EBA\u7C7B\u8282\u70B9\u5168\u90E8\u7531\u8C03\u8BD5\u5668\u5408\u6210\u66FF\u7B54\uFF0C\u672A\u8C03\u7528\u4EFB\u4F55\u6A21\u578B\uFF09");
  parts.push("");
  if (result.aborted) {
    parts.push('\u23F9 \u672C\u6B21\u5E72\u8DD1\u88AB\u8C03\u7528\u65B9\u64A4\u9500\uFF08\u56DE\u5408\u88AB\u4E2D\u65AD/\u7528\u6237\u505C\u6B62\uFF09\uFF1B**\u5DF2\u5B9E\u65F6\u4EA7\u51FA\u7684\u6D41\u6C34\u7167\u5E38\u56DE\u4F20\u5728\u4E0B\u65B9**\u2014\u2014\u6CE8\u610F\uFF1A\u6846\u67B6\u4F1A\u628A aborted \u7684\u5DE5\u5177\u7ED3\u679C\u6574\u6761\u66FF\u6362\u6210 "tool call aborted"\uFF0C\u8FD9\u79CD\u65F6\u5019\u8FD9\u4EFD\u6570\u636E\u5230\u4F60\u624B\u91CC\u53EF\u80FD\u5DF2\u7ECF\u4E22\u4E86\uFF0C' + (result.partialPath !== void 0 ? `\u53EF\u8BA9\u7528\u6237\u6309\u7559\u6863\u8DEF\u5F84\u76F4\u63A5\u8BFB\uFF1A${result.partialPath}` : "\u6C99\u76D2\u91CC\u7684\u539F\u59CB JSONL \u4ECD\u5728\u3002"));
    parts.push("");
  }
  if (result.timedOut) {
    parts.push(`\u23F1 \u5E72\u8DD1\u8D85\u65F6\uFF08${DEBUG_TIMEOUT_MS / 1e3}s \u770B\u95E8\u72D7\uFF09\u5DF2\u5F3A\u5236\u7EC8\u6B62\u2014\u2014\u7591\u4F3C\u6B7B\u5FAA\u73AF\uFF0C\u6216 par/fork \u91CD\u8BD5\u94FE\u592A\u6162\uFF1B\u4EE5\u4E0B\u662F\u7EC8\u6B62\u524D\u8DD1\u51FA\u7684\u90E8\u5206\u4FE1\u606F\u3002`);
    parts.push("");
  }
  if (result.report !== void 0) {
    parts.push(...formatReport(result.report, void 0));
  } else {
    const ends = result.records.filter((r) => r.kind === "run_end");
    parts.push(`\u7ED3\u5C40\uFF1A\u7EC8\u62A5\u672A\u751F\u6210\uFF08\u5E72\u8DD1\u672A\u6B63\u5E38\u8DD1\u5B8C\uFF09${ends.length > 0 ? "\uFF1B\u5DF2\u8DD1\u5B8C\u7684\u8F6E\u6B21\uFF1A" : ""}`);
    for (const e of ends) {
      parts.push(`  \u7B2C ${String(e.run ?? "-")} \u8F6E\uFF1A${String(e.outcome ?? "?")}` + (e.error ? ` \u2014 ${String(e.error).slice(0, 300)}` : "") + `\uFF08${String(e.elapsed ?? "?")}s\uFF09`);
    }
  }
  parts.push("");
  const transcriptLines = result.transcript.length > 0 ? result.transcript.split("\n").length : 0;
  parts.push(`\u2500\u2500\u2500\u2500 \u8C03\u8BD5\u6D41\u6C34\uFF08${transcriptLines} \u884C${result.transcriptDropped > 0 ? `\uFF0C\u4E2D\u6BB5\u7701\u7565 ${result.transcriptDropped} \u884C` : ""}\uFF09\u2500\u2500\u2500\u2500`);
  parts.push(result.transcript.length > 0 ? result.transcript : "\uFF08\u65E0\u6D41\u6C34\u8BB0\u5F55\u2014\u2014\u5148\u770B\u4E0A\u9762\u7684\u7ED3\u5C40/\u62A5\u9519\uFF09");
  parts.push("");
  parts.push(`\u9000\u51FA\u7801 ${exitCodeNote(result.exitCode)}\u3000\xB7\u3000\u7528\u65F6 ${(result.elapsedMs / 1e3).toFixed(1)}s\u3000\xB7\u3000\u6C99\u76D2FEMO\u811A\u672C\uFF1A${result.sandboxScript}\u3000\xB7\u3000\u5B8C\u6574\u6D41\u6C34(JSONL)\uFF1A${result.logPath}` + (result.partialPath !== void 0 ? `\u3000\xB7\u3000\u90E8\u5206\u4FE1\u606F\u7559\u6863\uFF1A${result.partialPath}` : "") + (result.report !== void 0 ? `\u3000\xB7\u3000\u7EC8\u62A5(JSON)\uFF1A${result.reportPath}` : ""));
  if (result.stderr.trim().length > 0 && result.report === void 0) {
    parts.push("");
    parts.push(`\u5F15\u64CE stderr \u5C3E\u90E8\uFF08\u8BCA\u65AD\u7528\uFF09\uFF1A
${result.stderr.trim().slice(-800)}`);
  }
  return { ok: true, text: parts.join("\n") };
}

// ../../femo2host/host/run-control-core.mjs
var PAUSE_SEND_TIMEOUT_MS = 15e3;
async function resolveAndPauseJob(opts) {
  const { send, hostKey, ownerRef, jobId, findMirrorTarget, timeoutMs = PAUSE_SEND_TIMEOUT_MS } = opts;
  const ownerOf = (j) => j?.host_refs?.[hostKey] ?? j?.host_ref;
  if (jobId !== void 0) {
    const st = await send("get_job_state", { job_id: jobId }, timeoutMs);
    if (st === void 0 || st.state === void 0) {
      return { kind: "no-such-job", jobId };
    }
    if (ownerOf(st) !== ownerRef) {
      return { kind: "not-owner", ownerShow: JSON.stringify(st.host_refs ?? st.host_ref ?? "?") };
    }
    if (st.state !== "running") {
      return { kind: "idle", state: st.state, jobId };
    }
    const result2 = await send("job_pause", { job_id: jobId }, timeoutMs);
    return { kind: "paused", jobId, paused: result2?.paused === true, state: result2?.state };
  }
  let target = findMirrorTarget?.();
  if (target === void 0) {
    const listed = await send("list_jobs", {}, timeoutMs);
    const engineRunning = listed?.jobs?.find((j) => j.state === "running" && ownerOf(j) === ownerRef);
    target = engineRunning?.job_id;
  }
  if (target === void 0) return { kind: "none" };
  const result = await send("job_pause", { job_id: target }, timeoutMs);
  return { kind: "paused", jobId: target, paused: result?.paused === true, state: result?.state };
}

// ../../femo2host/host/mount-registry.mjs
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync4, renameSync as renameSync2, writeFileSync } from "node:fs";
import { dirname as dirname7, join as join12 } from "node:path";
function mountLedgerPath(femoRoot2) {
  return join12(dataRootOf(femoRoot2), "mounts.json");
}
function freshLedger() {
  return { version: 1, mounts: [] };
}
function keyOf(rec) {
  return `${rec?.host ?? ""}|${rec?.session ?? ""}`;
}
function readMountLedger(ledgerPath2) {
  let raw;
  try {
    raw = readFileSync4(ledgerPath2, "utf8");
  } catch {
    return freshLedger();
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.mounts)) return { version: 1, mounts: parsed.mounts };
  } catch {
  }
  try {
    renameSync2(ledgerPath2, `${ledgerPath2}.corrupt-${Date.now()}`);
  } catch {
  }
  return freshLedger();
}
function writeLedger(ledgerPath2, ledger) {
  mkdirSync3(dirname7(ledgerPath2), { recursive: true });
  const tmp = `${ledgerPath2}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(ledger, null, 1), "utf8");
  renameSync2(tmp, ledgerPath2);
}
function upsertMountRecord(entry, ledgerPath2) {
  if (typeof entry?.host !== "string" || !entry.host.trim()) {
    throw new Error("\u6302\u8D26\u9700\u8981 host");
  }
  const rec = { host: entry.host, session: entry.session ?? null, time: (/* @__PURE__ */ new Date()).toISOString() };
  if (typeof entry.sessionName === "string" && entry.sessionName.trim()) rec.session_name = entry.sessionName.trim();
  if (typeof entry.femoText === "string" && entry.femoText) rec.femo_text = entry.femoText;
  else if (typeof entry.scriptPath === "string" && entry.scriptPath) rec.script_path = entry.scriptPath;
  else throw new Error("\u6302\u8D26\u9700\u8981 scriptPath \u6216 femoText \u4E4B\u4E00");
  const ledger = readMountLedger(ledgerPath2);
  const idx = ledger.mounts.findIndex((r) => keyOf(r) === keyOf(rec));
  if (idx >= 0) ledger.mounts[idx] = rec;
  else ledger.mounts.push(rec);
  writeLedger(ledgerPath2, ledger);
}
function removeMountRecord(host, session, ledgerPath2) {
  const ledger = readMountLedger(ledgerPath2);
  const key = `${host ?? ""}|${session ?? ""}`;
  const next = ledger.mounts.filter((r) => keyOf(r) !== key);
  if (next.length === ledger.mounts.length) return;
  ledger.mounts = next;
  writeLedger(ledgerPath2, ledger);
}
function findMountRecord(host, session, ledgerPath2) {
  const key = `${host ?? ""}|${session ?? ""}`;
  return readMountLedger(ledgerPath2).mounts.find((r) => keyOf(r) === key);
}

// ../../femo2host/host/tools-core.mjs
function buildToolSpecs({ host, possess = false }) {
  const dsh = host === "dsh";
  const specs = [
    {
      name: "femo_mount",
      description: dsh ? "\u628A\u811A\u672C\u6587\u4EF6\u6302\u8F7D\u5230\u5F53\u524D Femo \u4F1A\u8BDD\uFF1A\u7528\u6237\u4F1A\u5728 femogen \u7F16\u8F91\u5668\u91CC\u7ACB\u523B\u770B\u5230\u8FD9\u4E2AFEMO\u811A\u672C\uFF0C\u53EF\u4EE5\u67E5\u770B/\u7F16\u8F91\u3002\u5199\u811A\u672C\u65F6\u7528\u6587\u4EF6\u5DE5\u5177\u628A .femo \u5199\u5230 user_data/projects/ \u4E0B\uFF0C\u7136\u540E\u8C03\u7528\u672C\u5DE5\u5177\u6302\u8F7D\u3002\u53C2\u6570 script_path \u662F\u811A\u672C\u6587\u4EF6\u7684\u5B8C\u6574\u8DEF\u5F84\u3002" : "\u628AFEMO\u811A\u672C\u6302\u8F7D\u5230\u5F53\u524D Femo \u8FD0\u884C\u65F6\uFF08\u7F16\u8BD1\u6821\u9A8C\uFF09\u3002\u5199\u811A\u672C\u65F6\u7528\u6587\u4EF6\u5DE5\u5177\u628A .femo \u5199\u5230 user_data/projects/ \u4E0B\uFF0C\u7136\u540E\u8C03\u7528\u672C\u5DE5\u5177\u6302\u8F7D\uFF1B\u672A\u4FDD\u5B58\u7684\u811A\u672C\u6587\u672C\u4E5F\u53EF\u7528 femo_text \u76F4\u63A5\u4F20\u3002\u6302\u8F7D\u540E\u7528 femo_run \u542F\u52A8\u8FD0\u884C\u3002",
      parameters: {
        type: "object",
        properties: {
          script_path: { type: "string", description: "\u811A\u672C\u6587\u4EF6\u5B8C\u6574\u8DEF\u5F84\uFF08.femo\uFF09" },
          ...dsh ? {} : {
            femo_text: { type: "string", description: "\u811A\u672C\u6587\u672C\uFF08\u672A\u4FDD\u5B58\u65F6\u7528\uFF1B\u4E0E script_path \u4E8C\u9009\u4E00\uFF09" }
          }
        }
      },
      required: dsh ? ["script_path"] : void 0
    },
    {
      name: "femo_run",
      description: "\u63A7\u5236\u5F53\u524D\u8FD0\u884C\u65F6\u7684FEMO \u8FD0\u884C\u3002action \u5FC5\u586B\uFF0C\u56DB\u9009\u4E00\uFF1A\n- fresh_start\uFF1A\u4ECE\u5934\u8FD0\u884C\u5DF2\u6302\u8F7D\u7684\u811A\u672C\uFF08\u4E0A\u4E00\u6B21\u82E5\u6302\u8D77\u4F1A\u81EA\u52A8\u5B58\u6863\uFF0C\u53EF\u7EED\u8DD1\u627E\u56DE\uFF09\uFF1B\u8FD4\u56DE\u503C\u5E26\u672C\u6B21\u542F\u52A8\u8FD0\u884C\u7684 job_id\n- pause\uFF1A\u6682\u505C\u5E76\u6302\u8D77\u6B63\u5728\u8FD0\u884C\u7684\u811A\u672C\uFF08\u65AD\u70B9\u4FDD\u7559\uFF0C\u53EF resume \u7EED\u8DD1\uFF09\uFF1B\u7F3A\u7701\u81EA\u52A8\u505C\u672C\u5BBF\u4E3B\u6B63\u5728\u8DD1\u7684 Job\uFF0C\u4E5F\u53EF\u5E26 job_id \u5F3A\u5236\u6682\u505C\u6307\u5B9A Job\uFF08\u524D\u540E\u7AEF\u72B6\u6001\u6DF7\u4E71\u65F6\u7684\u5F3A\u505C\u5165\u53E3\uFF1Blist_jobs \u53EF\u67E5 job_id\uFF09\n- resume\uFF1A\u4ECE\u6302\u8D77\u5904\u7EED\u8DD1\uFF0C\u5FC5\u987B\u5E26 job_id \u6307\u540D\u8981\u7EED\u8DD1\u54EA\u4E2A Job\uFF08\u516D\u5173\u88C1\u51B3\uFF0C\u6539\u4E86FEMO\u811A\u672C/\u65E0\u65AD\u70B9\u4F1A\u660E\u786E\u62A5\u9519\uFF09\n- list_jobs\uFF1A\u5217\u51FA\u5168\u90E8 Job\uFF08\u72B6\u6001/\u573A\u6B21\u2014\u2014\u67E5\u627E\u6302\u8D77 Job \u7684 job_id \u7528\uFF09\n" + (dsh ? "\u8FD0\u884C\u540EFEMO \u7531\u5F15\u64CE\u9A71\u52A8\uFF0C\u89D2\u8272\u53D1\u8A00\u663E\u793A\u5728\u6295\u5F71\u7A97\uFF0C\u4E0D\u8FDB\u5165\u4F60\u7684\u4E0A\u4E0B\u6587\uFF1B\u7F16\u8BD1\u9519\u8BEF\u968F\u672C\u5DE5\u5177\u8FD4\u56DE\u503C\u7ED9\u51FA\uFF1B\u8DD1\u5230\u4E00\u534A\u62A5\u9519\u6216\u5168\u90E8\u8DD1\u5B8C\u65F6\uFF0C\u4F1A\u6709\u4E00\u6761 [femo-plugin] \u5F00\u5934\u7684\u63D2\u4EF6\u6D88\u606F\u76F4\u63A5\u53D1\u8FDB\u4F60\u7684\u5BF9\u8BDD\u6D41\u3002" : "\u8FD0\u884C\u7531\u5F15\u64CE\u9A71\u52A8\uFF1B\u542F\u52A8\u540E\u6309\u672C\u5BBF\u4E3B\u7684\u8FD0\u884C\u5FAA\u73AF\u63A8\u8FDB\u6F14\u51FA\uFF08\u8F6E\u5230\u89D2\u8272\u53D1\u8A00\u65F6\uFF0C\u4FE1\u4F1A\u7ECF\u9A7F\u7AD9\u9001\u8FBE\u672C\u4F1A\u8BDD\uFF09\uFF0C\u8BE6\u89C1 skills/femo/SKILL.md\u3002"),
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["fresh_start", "pause", "resume", "list_jobs"],
            description: "\u5BF9FEMO \u8FD0\u884C\u7684\u63A7\u5236\u52A8\u4F5C\uFF1Afresh_start=\u4ECE\u5934\u8FD0\u884C / pause=\u6682\u505C\u5E76\u6302\u8D77 / resume=\u4ECE\u6302\u8D77\u5904\u7EED\u8DD1 / list_jobs=\u5217\u51FA\u5168\u90E8 Job"
          },
          job_id: {
            type: "number",
            description: "resume \u5FC5\u586B\uFF1A\u8981\u7EED\u8DD1\u7684 Job \u7F16\u53F7\uFF08\u5148 list_jobs \u67E5\u8BE2\uFF09\u3002pause \u53EF\u9009\uFF1A\u5F3A\u5236\u6682\u505C\u6307\u5B9A Job\u3002fresh_start / list_jobs \u4E0D\u9700\u8981\u4F20\u672C\u53C2\u6570"
          },
          session: {
            type: "string",
            description: "\uFF08\u62C9\u53D6\u5BBF\u4E3B\u5EFA\u8BAE\u643A\u5E26\uFF0Cdsh \u4E0D\u9700\u8981\uFF09\u5F00\u6F14/\u7EED\u8DD1\u65B9\u4F1A\u8BDD\u53F7\uFF1A\u7EC8\u7AEF `echo $CLAUDE_SESSION_ID` \u53D6\u503C\u539F\u6837\u5E26\u56DE\u3002\u4FE1\u5C01\u6309\uFF08\u5BBF\u4E3B,\u4F1A\u8BDD\u53F7\uFF09\u53CC\u8BCD\u5BF9\u53F7\u6295\u9012\u2014\u2014\u4E0D\u5E26\u53F7\u7684\u4F1A\u8BDD\u9886\u4E0D\u5230\u5E26\u53F7\u4FE1\uFF0C\u7EED\u8DD1\u65F6\u4E5F\u662F\u6536\u517B\u6539\u8D34\u53F7\u7684\u51ED\u8BC1"
          }
        },
        required: ["action"]
      }
    },
    {
      name: "femo_debug",
      description: "\u96F6 token \u7A7A\u8DD1\uFF08\u5E72\u8DD1\uFF09\u5F53\u524D\u6302\u8F7D\u7684\u811A\u672C\uFF1A\u4E0D\u8C03\u7528\u4EFB\u4F55 AI/\u4EBA\u7C7B\u2014\u2014\u6240\u6709 AI \u52A8\u4F5C\u4E0E\u4EBA\u7C7B\u8F93\u5165\u7531\u8C03\u8BD5\u5668\u5408\u6210\u66FF\u7B54\uFF0C\u5F15\u64CE\u6309\u771F\u5B9E\u7BA1\u7EBF\uFF08\u8D4B\u503C\u6821\u9A8C/\u6761\u4EF6\u8FB9/\u5FAA\u73AF/\u5E76\u884C/\u6A21\u5757/@func\uFF09\u8DD1\u5B8C\u6574\u6D41\u7A0B\u3002\n\u7528\u9014\uFF1A\u6B63\u5F0F\u8FD0\u884C\u524D\u81EA\u68C0FEMO\u811A\u672C\u2014\u2014\u8BED\u6CD5\u4E0E\u63A5\u7EBF\u3001\u5206\u652F\u8D70\u5411\u3001\u53D8\u91CF\u8D4B\u503C\u3001\u5FAA\u73AF\u80FD\u4E0D\u80FD\u9000\u51FA\u3001\u6B7B\u5FAA\u73AF\u3001\u4E00\u6B21\u90FD\u6CA1\u8D70\u5230\u7684\u8282\u70B9\uFF0C\u90FD\u80FD\u4ECE\u8FD4\u56DE\u91CC\u770B\u51FA\u6765\u3002\u5199\u5B8C\u6216\u6539\u5B8CFEMO\u811A\u672C\u5148\u5E72\u8DD1\u4E00\u904D\uFF0C\u6709\u95EE\u9898\u7167\u7740\u6D41\u6C34\u6539\uFF0C\u6539\u5B8C\u518D\u8DD1\uFF0C\u76F4\u5230\u5E72\u8DD1\u5E72\u51C0\u518D femo_run\u3002\n\u811A\u672C\u5206\u6A21\u5757\u65F6\uFF0C\u53EF\u7528 module \u53C2\u6570\u53EA\u5E72\u8DD1\u67D0\u4E2A\u6A21\u5757\uFF08\u6A21\u5757\u5355\u6D4B\uFF0C\u5D4C\u5957\u7528\u70B9\u8DEF\u5F84 \u5916\u5C42.\u5185\u5C42\uFF09\u2014\u2014\u6539\u4E86\u54EA\u4E2A\u6A21\u5757\u5C31\u5148\u5355\u6D4B\u54EA\u4E2A\uFF0C\u518D\u8DD1\u6574\u4E2AFEMO\u811A\u672C\u3002\n\u8FD4\u56DE\uFF1A\u2460\u9010\u6761\u8C03\u8BD5\u6D41\u6C34\uFF08\u8282\u70B9\u8FDB\u51FA\u3001\u53D8\u91CF old\u2192new\u3001\u5408\u6210\u8D4B\u503C\u4E0E\u6765\u6E90\u3001\u91CD\u8BD5\u3001\u544A\u8B66\uFF09\uFF1B\u2461\u7EC8\u62A5\uFF08\u6BCF\u8F6E\u7ED3\u5C40\u4E0E\u62A5\u9519\u3001\u8282\u70B9\u6267\u884C\u987A\u5E8F\u3001\u8FB9\u8986\u76D6\u3001\u53D8\u91CF\u5FEB\u7167 diff\u3001\u672A\u8FBE\u8282\u70B9\uFF09\u3002\u7F16\u8BD1\u5931\u8D25\u65F6\u628A\u7F16\u8BD1\u5668\u62A5\u9519\u539F\u8BDD\u8FD4\u56DE\u3002\n\u7279\u6027\uFF1A\u4E0D\u5360 Job\u3001\u4E0D\u5199\u751F\u4EA7\u53F0\u8D26\uFF08\u72EC\u7ACB DB \u6C99\u76D2\uFF09" + (dsh ? "\u3001\u53EF\u4E0E\u6B63\u5F0F\u8FD0\u884C\u5E76\u884C\u3001\u540C\u4E00\u65F6\u523B\u53EA\u5141\u8BB8\u4E00\u6761\u5E72\u8DD1\uFF08\u8C03\u8BD5\u7A97\u6B63\u5728\u8DD1\u65F6\u4F1A\u660E\u786E\u62A5\u9519\uFF09" : "\u3001\u53EF\u53CD\u590D\u8C03\u7528") + "\uFF1B\u8017\u65F6\uFF1A\u5C0F\u811A\u672C\u51E0\u79D2\uFF0C\u5927\u811A\u672C\u6BCF\u8F6E\u53EF\u80FD\u5341\u51E0\u79D2\uFF0Cruns \u7EBF\u6027\u53E0\u52A0\u2014\u2014\u5148\u5355\u8F6E\u8DD1\u901A\uFF0C\u786E\u8981\u649E\u968F\u673A\u5206\u652F\u518D\u52A0\u8F6E\u6570\u3002" + (dsh ? "\u8DD1\u7684\u662F\u300C\u5F53\u524D\u6302\u8F7D\u7684\u811A\u672C\u300D\uFF08\u6302\u8F7D\u540E\u6539\u52A8\u8981\u91CD\u65B0\u6302\u8F7D\uFF09\uFF1B\u5408\u6210\u8F93\u5165\u662F\u8C03\u8BD5\u5668\u6309\u58F0\u660E\u731C\u7684\uFF0C\u53EA\u9A8C\u8BC1\u6D41\u7A0B\u4E0D\u4EE3\u8868\u5185\u5BB9\u8D28\u91CF\u3002" : ""),
      parameters: {
        type: "object",
        properties: {
          runs: { type: "number", description: "\u8DD1\u51E0\u8F6E\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4 1\uFF0C\u4E0A\u9650 20\uFF09\u3002\u6BCF\u8F6E\u6362\u79CD\u5B50\u2014\u2014\u591A\u8DD1\u51E0\u8F6E\u80FD\u649E\u51FA\u6982\u7387\u578B\u5206\u652F/\u968F\u673A\u6C89\u9ED8\u7684\u8DEF\u5F84\u3002\u6CE8\u610F\u8017\u65F6\u7EBF\u6027\u53E0\u52A0" },
          seed: { type: "number", description: "\u8D77\u59CB\u968F\u673A\u79CD\u5B50\uFF08\u53EF\u9009\uFF1B\u540C\u4E00\u4E2A seed \u53EF\u590D\u73B0\u540C\u4E00\u6B21\u5E72\u8DD1\uFF0C\u6392\u67E5\u968F\u673A\u5206\u652F\u65F6\u7528\uFF09" },
          module: {
            type: "string",
            description: "\u53EA\u5E72\u8DD1\u67D0\u4E2A module\uFF08\u53EF\u9009\uFF1B\u6A21\u5757\u5355\u6D4B\uFF09\u3002\u4F20\u811A\u672C\u91CC\u7684\u6A21\u5757\u540D\uFF0C\u5D4C\u5957\u6A21\u5757\u7528\u70B9\u8DEF\u5F84\u5982 \u5916\u5C42.\u5185\u5C42\u3002" + (dsh ? "\u53EA\u8DD1\u8BE5\u6A21\u5757\u81EA\u5DF1\u7684\u6D41\u7A0B\uFF08\u5408\u6210 wrapper \u76F4\u8FDB\uFF0C\u6BCD\u94FE\u53D8\u91CF\u4E0E\u5168\u5C40\u53D8\u91CF\u7167\u5E38\u53EF\u89C1\uFF09\uFF0C\u7EC8\u62A5\u7684\u8FB9\u8986\u76D6/\u672A\u8FBE\u8282\u70B9\u4E5F\u6309\u8BE5\u6A21\u5757\u81EA\u5DF1\u7684 flow \u7B97\u3002\u6301\u7EED\u5FAA\u73AF\u578B\u6A21\u5757\uFF08\u65E0 [OUT]/[BREAK] \u51FA\u53E3\uFF09\u8DD1\u6EE1\u6B65\u6570\u9884\u7B97\u5373\u505C\uFF0Cmax_steps \u7ED3\u5C40\u4E0D\u7B97\u9519\u8BEF\u3002" : "") + "\u7F3A\u7701=\u8DD1\u6574\u4E2AFEMO\u811A\u672C"
          }
        }
      }
    },
    {
      name: "femo_script",
      description: "\u67E5\u770B\u5F53\u524D\u8FD0\u884C\u65F6\u6302\u8F7D\u7684\u811A\u672C\u5B8C\u6574\u5185\u5BB9\uFF08\u6700\u7EC8\u751F\u6548\u7248\u672C\uFF09\u3002\u8FD4\u56DE\u811A\u672C\u5168\u6587\u4E0E\u6765\u6E90\u3002\u5199\u811A\u672C/\u6539\u811A\u672C\u524D\u5148\u8C03\u7528\u672C\u5DE5\u5177\uFF0C\u4E86\u89E3\u5F53\u524D\u6302\u8F7D\u7684\u811A\u672C\u662F\u4EC0\u4E48\uFF1B" + (dsh ? "\u4F1A\u8BDD\u672A\u6302\u8F7DFEMO\u811A\u672C\u65F6\u4F1A\u660E\u786E\u62A5\u9519\u3002" : "\u672A\u6302\u8F7DFEMO\u811A\u672C\u65F6\u4F1A\u660E\u786E\u62A5\u9519\u3002"),
      parameters: { type: "object", properties: {} }
    },
    {
      name: "femo_soul",
      description: "\u7BA1\u7406\u89D2\u8272\u5E93\uFF08souls\uFF09\uFF1A\n- list\uFF1A\u67E5\u770B\u5E93\u4E2D\u5168\u90E8\u89D2\u8272\uFF08soul_id + \u540D\u5B57\uFF09\u3002\u5199\u811A\u672C\u6311\u89D2\u8272\u524D\u5148\u8C03\u7528\u672C\u5DE5\u5177\u67E5\u5E93\uFF1B\n- create\uFF1A\u65B0\u5EFA\u89D2\u8272\u3002\u53C2\u6570 soul_id\uFF08\u811A\u672C\u91CC\u7528 soul:xxx \u5F15\u7528\uFF0C\u4E0D\u80FD\u542B\u7A7A\u683C/\u9017\u53F7\uFF09\u3001soul_name\uFF08\u663E\u793A\u540D\uFF09\uFF1Bdescription\uFF08\u89D2\u8272\u7684\u7075\u9B42\u8BBE\u5B9A\uFF0C\u6CE8\u5165\u7ED9\u8FD0\u884C\u8BE5\u89D2\u8272\u7684 AI\uFF09\u53EF\u7A7A\u2014\u2014\u65E0\u8BBE\u5B9A\u7684\u7075\u9B42\u76F4\u63A5\u4E0D\u4F20\u3002\n\u89D2\u8272\u662F\u5168\u5C40\u7684\uFF08\u6240\u6709FEMO\u811A\u672C\u53EF\u7528\uFF09\u3002soul \u975E\u5FC5\u987B\uFF1A\u65E0\u89D2\u8272\u8BBE\u5B9A\u7684\u7B80\u5355FEMO\u811A\u672C\u53EF\u4EE5\u4E0D\u5199 soul\uFF1B\u9700\u8981\u89D2\u8272\u8BBE\u5B9A\u7684\u811A\u672C\uFF0C\u5E93\u91CC\u6CA1\u6709\u7684\u89D2\u8272\u5148\u7528\u672C\u5DE5\u5177 create \u65B0\u5EFA\uFF0C\u518D\u5728\u811A\u672C\u91CC\u5F15\u7528\u3002",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create"], description: "list=\u67E5\u770B\u5168\u90E8\u89D2\u8272 / create=\u65B0\u5EFA\u89D2\u8272" },
          soul_id: { type: "string", description: "create \u5FC5\u586B\uFF1A\u89D2\u8272\u552F\u4E00\u6807\u8BC6\uFF08\u811A\u672C\u91CC soul:xxx \u5F15\u7528\uFF1B\u4E0D\u80FD\u542B\u7A7A\u683C/\u9017\u53F7\uFF09" },
          soul_name: { type: "string", description: "create \u5FC5\u586B\uFF1A\u89D2\u8272\u663E\u793A\u540D" },
          description: { type: "string", description: "create \u53EF\u7A7A\uFF1A\u89D2\u8272\u7684\u7075\u9B42\u8BBE\u5B9A\uFF08system prompt \u7247\u6BB5\uFF0C\u51FA\u6F14\u8BE5\u89D2\u8272\u7684 AI \u4F1A\u770B\u5230\uFF09\uFF1B\u4E0D\u4F20=\u65E0\u8BBE\u5B9A\u7A7A\u7075\u9B42" }
        },
        required: ["action"]
      }
    },
    {
      name: "femo_chronica",
      description: "\u67E5\u8BE2 Femo \u8FD0\u884C\u53F0\u8D26\uFF08Chronica.wor \u7F16\u5E74\u53F2\uFF09\uFF1A\u8FD4\u56DE\u6307\u5B9A\u573A\u6B21\u7684\u3010\u5BF9\u8BDD\u6D41\u3011\uFF08showprompt \u65C1\u767D + AI \u53D1\u8A00 + \u4EBA\u7C7B\u8F93\u5165\uFF0C\u6309\u65F6\u95F4\u4EA4\u7EC7\uFF09\u4E0E\u3010\u5E55\u540E\u6307\u4EE4\u3011\u9644\u5F55\uFF08\u8282\u70B9 prompt\uFF0C\u4E0D\u5C5E\u5BF9\u8BDD\u6D41\uFF09\u3002\n- \u65E0\u53C2\u6570 = \u6700\u65B0\u4E00\u6B21\u7684\u4E24\u5927\u6BB5\u5168\u6587\u2014\u2014\u811A\u672C\u8DD1\u5B8C\u540E\u770B\u7ED3\u679C\u3001\u590D\u76D8\u90FD\u7528\u8FD9\u4E2A\uFF1B\n- list=\u53EA\u5217\u6700\u8FD1 N \u573A\u4E00\u89C8\uFF08\u573A\u6B21\u53F7/\u5267\u540D/\u53D1\u8A00\u6570\uFF0C\u4F18\u5148\u4E8E show\uFF09\uFF1B\n- show=\u6307\u5B9A\u573A\u6B21\u53F7\uFF1Bscope=\u6BCF\u884C\u9644\u5E26\u53EF\u89C1\u7528\u6237/\u53EF\u89C1\u89D2\u8272\uFF08\u6392\u67E5\u89C6\u91CE\u7C7B\u95EE\u9898\u7528\uFF09\uFF1B\n- full=\u53D1\u8A00\u5168\u6587\u4E0D\u622A\u65AD\uFF08\u9ED8\u8BA4\u5BF9\u8BDD\u6D41\u884C\u622A 110 \u5B57\u3001\u6307\u4EE4 90 \u5B57\uFF1B\u7EC6\u8BFB\u8BD7\u4F5C/\u957F\u53F0\u8BCD\u65F6\u5F00\uFF09\u3002",
      parameters: {
        type: "object",
        properties: {
          show: { type: "number", description: "\u573A\u6B21\u53F7\uFF08\u53EF\u9009\uFF1B\u7F3A\u7701=\u6700\u65B0\u4E00\u6B21\uFF09" },
          list: { type: "number", description: "\u53EA\u5217\u6700\u8FD1 N \u573A\u4E00\u89C8\uFF08\u53EF\u9009\uFF1B\u7ED9\u4E86\u5C31\u5FFD\u7565 show\uFF09" },
          scope: { type: "boolean", description: "\u6BCF\u884C\u9644\u5E26\u53EF\u89C1\u6027\u4FE1\u606F\uFF08\u53EF\u9009\uFF1B\u6392\u67E5\u89C6\u91CE\u7C7B\u95EE\u9898\u7528\uFF09" },
          full: { type: "boolean", description: "\u53D1\u8A00\u5168\u6587\u4E0D\u622A\u65AD\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4\u622A\u65AD\uFF09" }
        }
      }
    }
  ];
  if (possess) {
    specs.push({
      name: "femo_possess",
      description: "\u9644\u8EAB/\u89E3\u9644\u8EAB\uFF08\u591A\u4E3B\u4F1A\u8BDD\u53C2\u4E0E\u8FD0\u884C\uFF09\uFF1A\u628A\u4E00\u4E2A\u4F1A\u8BDD\u6CE8\u518C\u4E3A\u67D0\u4E2A\u7075\u9B42\uFF08soul\uFF09\u7684\u51FA\u6F14\u8005\u2014\u2014\u90A3\u4E2A\u4F1A\u8BDD\u4ECE\u6B64\u5C31\u662F\u8BE5\u89D2\u8272\u672C\u4EBA\u3002\n- possess\uFF1A\u9644\u8EAB\u3002soul_id \u5FC5\u586B\uFF08\u5148 femo_soul list \u67E5\u89D2\u8272\u5E93\uFF09\u3002\u5F00\u6F14\u5B9A\u683C\u540E\uFF1A\u811A\u672C\u91CC\u8BE5 soul \u7684 AI \u89D2\u8272\u8F6E\u5230\u53D1\u8A00\u65F6\uFF0C\u6599\u5305\u4FE1\u76F4\u63A5\u9001\u5230\u90A3\u4E2A\u4F1A\u8BDD\uFF08\u7531\u5B83\u672C\u5C0A\u51FA\u6F14\u8BE5\u89D2\u8272\uFF0C\u4FDD\u7559\u5176\u5168\u90E8\u4F1A\u8BDD\u4E0A\u4E0B\u6587\uFF09\uFF0C\u4E3BAgent\u4E0D\u518D\u4E3A\u5B83\u62C9\u5B50\u4EE3\u7406\uFF1B\u8F6E\u5230\u53D1\u8A00\u65F6\u6B63\u5E38\u4F5C\u7B54\u5373\u53EF\uFF0C\u6240\u5728\u5BBF\u4E3B\u81EA\u52A8\u6536\u5377\u4EA4\u56DE\u5F15\u64CE\uFF08\u65E0\u9700\u8C03\u7528\u4EFB\u4F55\u5DE5\u5177\u6216\u547D\u4EE4\u4EA4\u5377\uFF09\u3002\n- release\uFF1A\u89E3\u9644\u8EAB\u3002\u9000\u6389\u76EE\u6807\u4F1A\u8BDD\u7684\u8FD9\u4E00\u7968\uFF08\u53EF\u5E26 soul_id \u6838\u5BF9\uFF09\u3002\n- session_id\uFF1A\u53EF\u9009\uFF0C\u7F3A\u7701=\u672C\u4F1A\u8BDD\uFF1B\u5199\u522B\u7684\u4F1A\u8BDD id \u5373\u66FF\u5B83\u5206\u914D\u89D2\u8272\uFF08\u4E3BAgent\u5206\u914D\u89D2\u8272\uFF09\u3002\n- host\uFF1A\u53EF\u9009\uFF0C\u7F3A\u7701=\u672C\u5BBF\u4E3B\uFF1B\u5199\u522B\u7684\u5BBF\u4E3B\u540D\u5373\u53EF\u8DE8\u5BBF\u4E3B\u5206\u914D\u89D2\u8272\uFF08\u524D\u63D0\uFF1A\u76EE\u6807\u5BBF\u4E3B\u5DF2\u63A5\u5165\u7ED1\u5B9A\u8D26\u5206\u6D41\uFF09\u3002\n\u89C4\u5219\uFF1A\u63D0\u540D\u5236\u2014\u2014\u540C\u4E00\u89D2\u8272\u5141\u8BB8\u591A\u4E2A\u4F1A\u8BDD\u5148\u540E\u63D0\u540D\uFF0C\u6700\u540E\u4E00\u6B21\u6307\u6D3E\u7B97\u6570\uFF0C\u81EA\u4E0B\u4E00\u6B21\u5F00\u6F14\u5B9A\u683C\u8D77\u751F\u6548\uFF08\u6F14\u51FA\u4E2D\u6539\u63D0\u540D\u4E0D\u5F71\u54CD\u5728\u8DD1\u7684\u620F\uFF0C\u672C\u4F1A\u8BDD\u6F14\u51FA\u4E2D\u4E0D\u8BB8\u6539\uFF09\uFF1Bhuman \u89D2\u8272\u4E0D\u53EF\u9644\u8EAB\u3002",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["possess", "release"], description: "possess=\u9644\u8EAB\uFF08\u4F1A\u8BDD\u6210\u4E3A\u8BE5 soul \u7684\u51FA\u6F14\u8005\uFF09/ release=\u89E3\u9644\u8EAB" },
          soul_id: { type: "string", description: "possess \u5FC5\u586B\uFF1A\u8981\u9644\u8EAB\u7684\u7075\u9B42 id\uFF08femo_soul list \u67E5\u5F97\uFF09\uFF1Brelease \u53EF\u9009\uFF08\u6838\u5BF9\u8BE5\u4F1A\u8BDD\u5F53\u524D\u7ED1\u5B9A\uFF09" },
          session_id: { type: "string", description: "\u53EF\u9009\uFF1A\u76EE\u6807\u4F1A\u8BDD id\u3002\u7F3A\u7701=\u672C\u4F1A\u8BDD\uFF1B\u5199\u522B\u7684\u4F1A\u8BDD id \u5373\u66FF\u5B83\u9644\u8EAB/\u89E3\u9644\u8EAB\uFF08\u4E3BAgent\u5206\u914D\u89D2\u8272\uFF09" },
          host: { type: "string", description: "\u53EF\u9009\uFF1A\u76EE\u6807\u4F1A\u8BDD\u6240\u5728\u5BBF\u4E3B\u3002\u7F3A\u7701=\u672C\u5BBF\u4E3B\uFF1B\u5199\u522B\u7684\u5BBF\u4E3B\u540D\u5373\u53EF\u8DE8\u5BBF\u4E3B\u5206\u914D\u89D2\u8272" }
        },
        required: ["action"]
      }
    });
  }
  return specs;
}
function normalizeChronicaOpts(args) {
  const opts = {};
  if (typeof args.show === "number" && Number.isFinite(args.show)) opts.show = Math.trunc(args.show);
  if (typeof args.list === "number" && Number.isFinite(args.list) && args.list > 0) opts.list = Math.trunc(args.list);
  if (args.scope === true) opts.scope = true;
  if (args.full === true) opts.full = true;
  return opts;
}
function chronicaCliArgs(opts) {
  const cli = [];
  if (opts.list !== void 0) cli.push("--list", String(opts.list));
  else if (opts.show !== void 0) cli.push(String(opts.show));
  if (opts.scope === true) cli.push("--scope");
  if (opts.full === true) cli.push("--full");
  return cli;
}
function validateSoulCreate(args) {
  const soulId = typeof args.soul_id === "string" ? args.soul_id.trim() : "";
  const soulName = typeof args.soul_name === "string" ? args.soul_name.trim() : "";
  const description = typeof args.description === "string" ? args.description : "";
  if (soulId.length === 0 || soulName.length === 0) {
    return "create \u9700\u8981 soul_id / soul_name \u4E24\u4E2A\u53C2\u6570\uFF08\u5168\u90E8\u5FC5\u586B\uFF1Bdescription \u53EF\u7A7A\uFF09";
  }
  if (/[\s,，]/.test(soulId)) {
    return `soul_id "${soulId}" \u4E0D\u80FD\u542B\u7A7A\u683C\u6216\u9017\u53F7\uFF08\u811A\u672C\u91CC soul:xxx \u5F15\u7528\u7528\uFF09`;
  }
  return null;
}
function scriptActorSouls(femoText) {
  const out = [];
  let inActors = false;
  for (const line of String(femoText ?? "").split(/\r?\n/)) {
    if (/^\s*(meta|actors|vars|code|mainflow|module|action)\s*:/.test(line) || /^action\s/.test(line)) {
      inActors = /^\s*actors\s*:/.test(line);
      continue;
    }
    if (!inActors) continue;
    const actor = line.match(/^\s*ai\s+@(\S+?)\s*=/);
    if (!actor) continue;
    if (/\bsource:\s*main\b/.test(line)) continue;
    out.push({ actor: actor[1], soul: line.match(/\bsoul:\s*([^\s,，]+)/)?.[1] ?? null });
  }
  return out;
}
function unboundActorSouls(femoText, nominatedSouls) {
  const bound = new Set(nominatedSouls);
  return scriptActorSouls(femoText).flatMap(({ actor, soul }) => {
    if (!soul) return [`\u89D2\u8272@${actor} \u5728\u5267\u672C\u91CC\u6CA1\u6709\u6307\u5B9A\u7075\u9B42\uFF08soul\uFF09\uFF0C\u65E0\u6CD5\u7ED1\u5B9A\u7A97\u53E3`];
    return bound.has(soul) ? [] : [`\u7075\u9B42\uFF1A${soul} \uFF08\u4ED6\u5728femo\u5267\u672C\u4E2D\u7684\u89D2\u8272\u540D\u4E3A@${actor}\uFF09`];
  });
}
function createMountState(opts = {}) {
  const host = typeof opts.host === "string" && opts.host.trim() ? opts.host.trim() : void 0;
  const session = opts.session === void 0 ? null : opts.session;
  const sessionName = typeof opts.sessionName === "string" && opts.sessionName.trim() ? opts.sessionName.trim() : void 0;
  if (host && !opts.registryPath && !opts.femoRoot) {
    throw new Error("createMountState\uFF1A\u4F20\u4E86 host \u5C31\u5FC5\u987B\u7ED9 femoRoot \u6216 registryPath\uFF08\u6302\u8F7D\u8D26\u672C\u8981\u843D\u4F4D\uFF09\uFF0C\u7F3A\u4E86\u54CD\u4EAE\u62A5\u9519");
  }
  const ledgerPath2 = host ? opts.registryPath ?? mountLedgerPath(opts.femoRoot) : void 0;
  function mountedFromPath(p) {
    return {
      femoText: readFileSync5(p, "utf8"),
      scriptPath: p,
      baseDir: join13(p, ".."),
      scriptName: p.split(/[\\/]/).pop()
    };
  }
  function toLedger(entry) {
    if (!ledgerPath2) return;
    try {
      upsertMountRecord({ host, session, sessionName, ...entry }, ledgerPath2);
    } catch {
    }
  }
  function dropLedger() {
    if (!ledgerPath2) return;
    try {
      removeMountRecord(host, session, ledgerPath2);
    } catch {
    }
  }
  function restoreFromLedger() {
    if (!ledgerPath2) return void 0;
    let rec;
    try {
      rec = findMountRecord(host, session, ledgerPath2);
    } catch {
      return void 0;
    }
    if (!rec) return void 0;
    if (typeof rec.femo_text === "string" && rec.femo_text) return void 0;
    const p = rec.script_path;
    if (typeof p !== "string" || !p || !existsSync5(p)) {
      dropLedger();
      return void 0;
    }
    return mountedFromPath(p);
  }
  let mounted = restoreFromLedger();
  return {
    get: () => mounted,
    /** 读文件挂载（文件不存在返回错误对象；调用方直接回传）。 */
    mountFromPath(scriptPath) {
      const p = typeof scriptPath === "string" ? scriptPath : "";
      if (!p || !existsSync5(p)) return { error: `\u811A\u672C\u6587\u4EF6\u4E0D\u5B58\u5728\uFF1A${p || "(\u672A\u63D0\u4F9B)"}` };
      mounted = mountedFromPath(p);
      toLedger({ scriptPath: p });
      return null;
    },
    mountFromText(femoText) {
      mounted = { femoText, scriptPath: void 0, baseDir: void 0, scriptName: "unsaved" };
      toLedger({ femoText });
    },
    /** 跑前对盘（2026-10-01 用户拍板「缓存的是 path」）：有 path 的挂载在用之前
     *  重读文件现稿——挂载之后改了剧本，运行跑的就是改后版，不必重新挂载。
     *  path 是事实源：文件没了响亮报错，不许拿旧稿假装没事。femo_text 挂载
     *  没有 path，保持原稿（调用方原地改 mounted.femoText，拿到的引用仍是
     *  新稿）。返回 null=已对齐；{error}=响亮报错对象。 */
    freshen() {
      if (!mounted?.scriptPath) return null;
      const p = mounted.scriptPath;
      if (!existsSync5(p)) return { error: `\u811A\u672C\u6587\u4EF6\u8BFB\u4E0D\u5230\u4E86\uFF1A${p}\uFF08\u6302\u8F7D\u4E4B\u540E\u88AB\u5220\u9664\u6216\u79FB\u52A8\u4E86\uFF1F\uFF09` };
      mounted.femoText = readFileSync5(p, "utf8");
      return null;
    },
    clear() {
      mounted = void 0;
      dropLedger();
    }
  };
}
function createBridgeToolImpls(opts) {
  const { ensureBridge, send, femoRoot: femoRoot2, host, hostRef, spawnPython, debugSpawnProc, onProgress, possess } = opts;
  const actorAdmission = opts.actorAdmission === "auto-seat" ? "auto-seat" : "nominated";
  const castView = opts.castView ?? preferencesView;
  const mounts = opts.mounts ?? createMountState();
  const state = { lastJobId: void 0 };
  const runNextHint = opts.runNextHint;
  async function requireMounted() {
    const m = mounts.get();
    if (!m) return [null, { error: "\u5C1A\u672A\u6302\u8F7DFEMO\u811A\u672C\uFF1A\u5148\u8C03 femo_mount\u3002" }];
    return [m, null];
  }
  const impls = {
    mounts,
    async femo_mount(args) {
      const femoText = typeof args.femo_text === "string" ? args.femo_text : "";
      try {
        if (!femoText) {
          const err = mounts.mountFromPath(args.script_path);
          if (err) return err;
        } else {
          mounts.mountFromText(femoText);
        }
        const m = mounts.get();
        const check = await ensureBridge().then(() => send("check", { femo: m.femoText, base_dir: m.baseDir ?? null }, 2e4));
        return { mounted: true, script: m.scriptName, path: m.scriptPath ?? void 0, compile: check ?? "ok" };
      } catch (e) {
        mounts.clear();
        return { error: `\u7F16\u8BD1\u5931\u8D25\uFF1A${String(e).slice(0, 400)}` };
      }
    },
    async femo_run(args) {
      await ensureBridge();
      switch (args.action) {
        case "fresh_start": {
          const [m, err] = await requireMounted();
          if (err) return err;
          const fr = mounts.freshen();
          if (fr) return fr;
          if (actorAdmission === "nominated") try {
            const view = await castView(femoRoot2);
            const nominated = Object.keys(view.bindings ?? {});
            const missing = unboundActorSouls(m.femoText, nominated);
            if (missing.length > 0) {
              const empty = Object.keys(view.hosts ?? {}).length === 0 ? "\uFF08\u63D0\u540D\u8D26\u4E3A\u7A7A\u6216\u6295\u5F71\u4E2D\u5FC3\u4E0D\u53EF\u8FBE\uFF09" : "";
              return {
                error: `\u5F00\u6F14\u6821\u9A8C\u5931\u8D25\uFF1A\u8FD8\u6709\u51E0\u4E2A\u7075\u9B42\u6CA1\u6709\u7ED1\u5B9A\u7A97\u53E3\uFF01${empty}
\u8BF7\u518D\u5F00\u51E0\u4E2A\u4F1A\u8BDD\uFF0C\u7ED1\u5B9A\u4EE5\u4E0B\u8FD9\u4E9B\u7075\u9B42\uFF1A
${missing.join("\n")}
\u5267\u672C\u4E2D\u6240\u6709\u7075\u9B42\uFF0C\u90FD\u5FC5\u987B\u7ED1\u5B9A\u7A97\u53E3\uFF0C\u624D\u80FD\u5F00\u59CB\u8FD0\u884C\u3002`
              };
            }
          } catch (e) {
            return { error: `\u5F00\u6F14\u6821\u9A8C\u65E0\u6CD5\u5B8C\u6210\uFF08\u9009\u89D2\u8D26\u4E0D\u53EF\u8FBE\uFF09\uFF1A${String(e).slice(0, 200)}` };
          }
          const sessionTag = typeof args.session === "string" ? args.session.trim() : "";
          const r = await send("job_start", {
            femo: m.femoText,
            base_dir: m.baseDir ?? null,
            script_path: m.scriptPath ?? "",
            script_name: m.scriptName,
            host_ref: sessionTag || hostRef,
            ...sessionTag ? { host_refs: { [host]: sessionTag } } : {},
            host_ai_backend: true
            // AI 节点交宿主执行（子代理/主Agent），引擎不发直连
          }, 3e4);
          state.lastJobId = r.job_id;
          return { started: true, job_id: r.job_id, state: r.state, warnings: r.warnings, ...runNextHint !== void 0 ? { next: runNextHint } : {} };
        }
        case "pause": {
          const outcome = await resolveAndPauseJob({
            send,
            hostKey: host,
            ownerRef: hostRef,
            jobId: typeof args.job_id === "number" ? args.job_id : void 0
          });
          if (outcome.kind === "no-such-job") {
            return { paused: false, job_id: outcome.jobId, note: `Job ${String(outcome.jobId)} \u4E0D\u5B58\u5728\uFF08no_such_job\uFF09` };
          }
          if (outcome.kind === "not-owner") {
            return { error: `Job ${String(args.job_id)} \u4E0D\u5C5E\u4E8E\u672C\u5BBF\u4E3B\uFF08\u5F52\u5C5E ${outcome.ownerShow}\uFF09\uFF0C\u62D2\u7EDD\u6682\u505C` };
          }
          if (outcome.kind === "idle") {
            return { paused: false, job_id: outcome.jobId, state: outcome.state, note: `Job \u672A\u5728\u8FD0\u884C\uFF08state=${outcome.state}\uFF09` };
          }
          if (outcome.kind === "none") {
            return { paused: false, note: "\u6CA1\u6709\u6B63\u5728\u8FD0\u884C\u7684 Job\uFF08\u5F15\u64CE\u6863\u6848\u4EA6\u65E0 running\uFF1Blist_jobs \u53EF\u67E5\u6302\u8D77\u573A\uFF09" };
          }
          state.lastJobId = outcome.jobId;
          return { paused: outcome.paused, job_id: outcome.jobId, ...outcome.state !== void 0 ? { state: outcome.state } : {} };
        }
        case "resume": {
          const [m, err] = await requireMounted();
          if (err) return err;
          if (typeof args.job_id !== "number") return { error: "resume \u9700\u8981 job_id\uFF08list_jobs \u91CC\u627E\uFF09\u3002" };
          const sessionTagResume = typeof args.session === "string" ? args.session.trim() : "";
          const r = await send("job_resume", {
            femo: m.femoText,
            job_id: args.job_id,
            host_ai_backend: true,
            ...sessionTagResume ? { host_ref: sessionTagResume, host_refs: { [host]: sessionTagResume } } : {}
          }, 3e4);
          state.lastJobId = args.job_id;
          return { resumed: true, job_id: args.job_id, result: r, ...runNextHint !== void 0 ? { next: runNextHint } : {} };
        }
        case "list_jobs":
          return { jobs: await send("list_jobs", {}, 15e3) };
        default:
          return { error: `\u672A\u77E5 action\uFF1A${args.action}` };
      }
    },
    async femo_script() {
      const [m, err] = await requireMounted();
      if (err) return err;
      return { script: m.scriptName, text: m.femoText };
    },
    async femo_soul(args) {
      try {
        await ensureBridge();
        if (args.action === "list") return { result: await send("list_souls", {}, 15e3) };
        const invalid = validateSoulCreate(args);
        if (invalid) return { error: invalid };
        return {
          result: await send("create_soul", {
            soul_id: args.soul_id.trim(),
            soul_name: args.soul_name.trim(),
            description: typeof args.description === "string" ? args.description : ""
          }, 15e3),
          note: `\u5DF2\u521B\u5EFA\u89D2\u8272 ${String(args.soul_name).trim()}\uFF08soul_id=${String(args.soul_id).trim()}\uFF0C\u811A\u672C\u91CC\u7528 soul:${String(args.soul_id).trim()} \u5F15\u7528\uFF09`
        };
      } catch (e) {
        return { error: String(e).slice(0, 300) };
      }
    },
    async femo_chronica(args) {
      const cliArgs = [join13(femoRoot2, "femo2host", "femoToolcall", "chronica.py"), ...chronicaCliArgs(normalizeChronicaOpts(args))];
      try {
        const { output, exitCode } = await spawnPython(cliArgs, 3e4);
        return { chronica: output.slice(-6e3), exit_code: exitCode };
      } catch (e) {
        return { error: String(e).slice(0, 300) };
      }
    },
    async femo_debug(args) {
      const [m, err] = await requireMounted();
      if (err) return err;
      let tmpDir;
      let scriptPath = m.scriptPath;
      if (!scriptPath) {
        tmpDir = mkdtempSync(join13(tmpdir(), "femo-debug-"));
        scriptPath = join13(tmpDir, "script.femo");
        writeFileSync2(scriptPath, m.femoText, "utf8");
      }
      try {
        const result = await collectDebugRun({
          femoRoot: femoRoot2,
          spawnProc: debugSpawnProc,
          req: {
            femo: m.femoText,
            scriptPath,
            ...typeof args.runs === "number" ? { runs: args.runs } : {},
            ...typeof args.seed === "number" ? { seed: args.seed } : {},
            ...normalizeModule(args.module) !== void 0 ? { module: args.module } : {}
          },
          onProgress
        });
        const verdict = debugRunToolOutcome(result);
        if (verdict.ok !== true) return { error: verdict.error };
        return {
          ok: true,
          runs: result.runs,
          ...result.seed !== void 0 ? { seed: result.seed } : {},
          exit_code: result.exitCode,
          timed_out: result.timedOut,
          elapsed_ms: result.elapsedMs,
          log_path: result.logPath,
          ...result.partialPath !== void 0 ? { partial_path: result.partialPath } : {},
          text: verdict.text
        };
      } finally {
        if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  };
  if (possess) {
    impls.femo_possess = async (args) => {
      const explicitSid = String(args.session_id ?? "").trim();
      const targetSid = explicitSid || possess.selfSid?.() || "";
      const targetHost = String(args.host ?? "").trim() || host;
      if (possess.running()) {
        return { error: "FEMO\u811A\u672C\u6B63\u5728\u8FD0\u884C\u4E2D\u2014\u2014\u542F\u52A8\u8FD0\u884C\u540E\u7ED1\u5B9A\u9501\u5B9A\uFF0C\u7B49\u672C\u6B21\u8DD1\u5B8C\uFF08\u6216\u6682\u505C\uFF09\u518D\u6539\u3002" };
      }
      if (!targetSid && args.action === "release") {
        return { error: "\u89E3\u9644\u8EAB\u9700\u8981\u5B9A\u4F4D\u300C\u672C\u4F1A\u8BDD\u300D\u2014\u2014\u672C\u5BBF\u4E3B\u62FF\u4E0D\u5230\u4F1A\u8BDD\u8EAB\u4EFD\uFF0C\u8BF7\u5E26 session_id\u3002" };
      }
      if (args.action === "release") {
        if (args.soul_id !== void 0 && args.soul_id !== "") {
          const view = await preferencesView(femoRoot2);
          const current = view.hosts?.[targetHost]?.[targetSid]?.soul;
          if (current !== void 0 && current !== args.soul_id) {
            return { error: `${targetHost} \u7684\u4F1A\u8BDD ${targetSid} \u9644\u8EAB\u7684\u662F ${current}\uFF0C\u4E0D\u662F ${args.soul_id}\u2014\u2014\u6838\u5BF9\u540E\u518D\u89E3` };
          }
        }
        try {
          const r = await preferenceSet(femoRoot2, targetHost, targetSid, null);
          if (r?.ok === false) return { error: r.error ?? "\u6295\u5F71\u4E2D\u5FC3\u62D2\u7EDD\u4E86\u89E3\u9644\u8EAB\u3002" };
        } catch (e) {
          return { error: `\u6295\u5F71\u4E2D\u5FC3\u4E0D\u53EF\u8FBE\uFF0C\u89E3\u9644\u8EAB\u672A\u751F\u6548\uFF1A${String(e).slice(0, 200)}` };
        }
        return {
          result: { released: args.soul_id ?? null, session: targetSid, host: targetHost },
          note: "\u5DF2\u89E3\u9644\u8EAB\uFF08\u9000\u6389\u8BE5\u4F1A\u8BDD\u7684\u63D0\u540D\uFF09\u2014\u2014\u672C\u4F1A\u8BDD\u4E0D\u518D\u51FA\u6F14\u8BE5\u89D2\u8272\uFF1B\u82E5\u522B\u7684\u4F1A\u8BDD\u4ECD\u63D0\u540D\u6B64\u89D2\u8272\uFF0C\u4E0B\u4E00\u573A\u5F52\u5B83\uFF0C\u5426\u5219\u4E3BAgent\u542F\u52A8\u8FD0\u884C\u65F6\u4F1A\u4E3A\u5B83\u62C9\u5B50\u4EE3\u7406\u3002"
        };
      }
      const soulId = String(args.soul_id ?? "").trim();
      if (soulId.length === 0) return { error: "possess \u9700\u8981 soul_id\uFF08\u5148 femo_soul list \u67E5\u89D2\u8272\u5E93\uFF09\u3002" };
      if (soulId === "human") {
        return { error: "human \u89D2\u8272\u4E0D\u53C2\u4E0E\u9644\u8EAB\u3002" };
      }
      let souls = [];
      try {
        await ensureBridge();
        const listed = await send("list_souls", {}, 15e3);
        souls = Array.isArray(listed?.souls) ? listed.souls : Array.isArray(listed) ? listed : [];
      } catch (e) {
        return { error: `\u6838\u5BF9\u89D2\u8272\u5E93\u5931\u8D25\uFF08\u6865\u672A\u5C31\u7EEA\uFF1F\uFF09\uFF1A${String(e).slice(0, 200)}` };
      }
      const soulCard = souls.find((s) => String(s?.soul_id ?? s?.id ?? "") === soulId);
      if (souls.length > 0 && soulCard === void 0) {
        return { error: `\u89D2\u8272\u5E93\u91CC\u6CA1\u6709 soul_id=${soulId}\u2014\u2014\u5148 femo_soul list \u6838\u5BF9\uFF0C\u6216 femo_soul create \u65B0\u5EFA\u3002` };
      }
      if (!targetSid) {
        return { error: "\u65E0\u6CD5\u5B9A\u4F4D\u300C\u672C\u4F1A\u8BDD\u300D\u2014\u2014\u8BF7\u663E\u5F0F\u5E26 session_id\uFF08\u5BBF\u4E3B\u672A\u6CE8\u5165\u4F1A\u8BDD\u8EAB\u4EFD\u65F6\u5FC5\u5E26\uFF09\u3002" };
      }
      try {
        const r = await preferenceSet(femoRoot2, targetHost, targetSid, soulId);
        if (r?.ok === false) return { error: r.error ?? "\u6295\u5F71\u4E2D\u5FC3\u62D2\u7EDD\u4E86\u8FD9\u6B21\u9644\u8EAB\u3002" };
      } catch (e) {
        return { error: `\u6295\u5F71\u4E2D\u5FC3\u4E0D\u53EF\u8FBE\uFF0C\u9644\u8EAB\u672A\u751F\u6548\uFF1A${String(e).slice(0, 200)}` };
      }
      const soulName = String(soulCard?.soul_name ?? soulCard?.name ?? soulId);
      possess.announce?.(targetSid, soulName);
      return {
        result: { possessed: soulId, session: targetSid, host: targetHost },
        note: `\u5DF2\u9644\u8EAB ${soulName}\uFF08soul_id=${soulId}\uFF09\u2014\u2014\u81EA\u4E0B\u4E00\u6B21\u5F00\u6F14\u5B9A\u683C\u8D77\uFF0C\u8BE5\u89D2\u8272\u7684\u53F0\u8BCD\u9001\u5230\u4F1A\u8BDD ${targetSid}\uFF0C\u7531\u5B83\u672C\u5C0A\u51FA\u6F14\uFF08\u8F6E\u5230\u53D1\u8A00\u65F6\u6B63\u5E38\u4F5C\u7B54\u5373\u53EF\uFF0C\u6240\u5728\u5BBF\u4E3B\u81EA\u52A8\u6536\u5377\u4EA4\u56DE\u5F15\u64CE\uFF09\u3002\u82E5\u6B64\u524D\u522B\u7684\u4F1A\u8BDD\u4E5F\u63D0\u540D\u8FC7\u6B64\u89D2\u8272\uFF0C\u4EE5\u672C\u6B21\u6700\u65B0\u6307\u6D3E\u4E3A\u51C6\uFF1B\u5728\u8DD1\u7684\u620F\u4E0D\u53D7\u5F71\u54CD\u3002\u89E3\u9644\u8EAB\u7528 action=release\u3002`
      };
    };
  }
  return impls;
}

// host/run-control.ts
import { join as join15 } from "node:path";

// ../../femo2host/femoGenConnector/femogen-files.mjs
import { basename as basename2, join as join14 } from "node:path";
var MAX_ENTRIES = 200;
function normKey(path) {
  const unified = path.trim().replace(/\//g, "\\");
  const isUnc = unified.startsWith("\\\\");
  const body = unified.replace(/\\{2,}/g, "\\").replace(/^\\/, "");
  return (isUnc ? `\\\\${body}` : body).toLowerCase();
}
function ledgerPath(femoRoot2) {
  return join14(dataRootOf(femoRoot2), "femo_files.json");
}
async function readLedger(femoRoot2) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(ledgerPath(femoRoot2), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return { version: 1, files: {} };
    const files = parsed.files;
    if (files === null || typeof files !== "object" || Array.isArray(files)) return { version: 1, files: {} };
    return { version: 1, files };
  } catch {
    return { version: 1, files: {} };
  }
}
async function writeLedger2(femoRoot2, ledger) {
  const { mkdir: mkdir3, rename, writeFile: writeFile2 } = await import("node:fs/promises");
  await mkdir3(dataRootOf(femoRoot2), { recursive: true });
  const target = ledgerPath(femoRoot2);
  const tmp = `${target}.tmp`;
  await writeFile2(tmp, JSON.stringify(ledger, null, 2), "utf8");
  await rename(tmp, target);
}
var writeChains = /* @__PURE__ */ new Map();
function withLedgerLock(femoRoot2, fn) {
  const prev = writeChains.get(femoRoot2) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeChains.set(femoRoot2, next.then(
    () => void 0,
    () => void 0
  ));
  return next;
}
async function rememberFemoFile(femoRoot2, path, source) {
  const trimmed = path.trim();
  if (trimmed.length === 0) return;
  try {
    await withLedgerLock(femoRoot2, async () => {
      const ledger = await readLedger(femoRoot2);
      const key = normKey(trimmed);
      const now = Date.now();
      const prev = ledger.files[key];
      ledger.files[key] = {
        path: trimmed,
        name: basename2(trimmed),
        source,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastUsedAt: now
      };
      const keys = Object.keys(ledger.files);
      if (keys.length > MAX_ENTRIES) {
        keys.sort((a, b) => ledger.files[a].lastUsedAt - ledger.files[b].lastUsedAt);
        for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) delete ledger.files[stale];
      }
      await writeLedger2(femoRoot2, ledger);
    });
  } catch (error) {
    console.log(`[femo-plugin] \u26A0\uFE0F femoGen \u6587\u4EF6\u8D26\u672C\u5199\u5165\u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u672C\u6B21\u5BFC\u5165/\u5BFC\u51FA\uFF09: ${String(error)}`);
  }
}
async function listFemoFiles(femoRoot2) {
  const { stat: stat3 } = await import("node:fs/promises");
  const ledger = await readLedger(femoRoot2);
  const entries = await Promise.all(
    Object.values(ledger.files).map(async (record) => {
      try {
        const info = await stat3(record.path);
        return { ...record, exists: info.isFile(), size: info.size, mtimeMs: info.mtimeMs };
      } catch {
        return { ...record, exists: false };
      }
    })
  );
  entries.sort((a, b) => {
    if (a.exists !== b.exists) return a.exists ? -1 : 1;
    return b.lastUsedAt - a.lastUsedAt;
  });
  return entries;
}
async function forgetFemoFile(femoRoot2, path) {
  const trimmed = path.trim();
  if (trimmed.length === 0) throw new Error("path is required");
  return await withLedgerLock(femoRoot2, async () => {
    const ledger = await readLedger(femoRoot2);
    const key = normKey(trimmed);
    if (ledger.files[key] === void 0) return false;
    delete ledger.files[key];
    await writeLedger2(femoRoot2, ledger);
    return true;
  });
}
async function readLedgerFemoFile(femoRoot2, path) {
  const trimmed = path.trim();
  if (trimmed.length === 0) throw new Error("path is required");
  const ledger = await readLedger(femoRoot2);
  const record = ledger.files[normKey(trimmed)];
  if (record === void 0) {
    throw new Error(`\u4E0D\u5728\u5BFC\u5165/\u5BFC\u51FA\u8BB0\u5F55\u4E2D\uFF1A${trimmed}`);
  }
  const { readFile: readFile3 } = await import("node:fs/promises");
  return await readFile3(record.path, "utf8");
}

// host/run-control.ts
async function resolveApiKey(ctx, resolved) {
  const credentials = ctx.get("credentials");
  if (credentials === void 0) return void 0;
  const cred = await credentials.resolve(resolved.apiKeyRef);
  return cred !== void 0 ? cred.value : void 0;
}
async function collectLlmModels(ctx, resolved) {
  const fallback = {
    defaultProvider: resolved.dshProvider,
    providers: [{ id: resolved.dshProvider, models: [{ id: resolved.model }] }]
  };
  const llm = ctx.get("llm");
  if (llm === void 0 || typeof llm.listProviders !== "function" || typeof llm.listModels !== "function") {
    return fallback;
  }
  let providers;
  try {
    providers = [];
    for (const info of llm.listProviders()) {
      try {
        const models = await llm.listModels(info.id);
        providers.push({ id: info.id, name: info.name, models: models.map((m) => ({ id: m.id, name: m.name })) });
      } catch (error) {
        console.log(`[femo-plugin] listModels(${info.id}) failed: ${String(error)}`);
      }
    }
  } catch (error) {
    console.log(`[femo-plugin] listProviders failed: ${String(error)}`);
    return fallback;
  }
  if (providers.length === 0) return fallback;
  return { defaultProvider: resolved.dshProvider, providers };
}
var runDiagSeq = 0;
var diagTs2 = () => (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
async function startJobOnSession(ctx, resolved, bridge, runState, sessionId, scriptText, scriptPath, reset = false, jobId, projections) {
  console.log(`[femo-run-diag ${diagTs2()}] startJob begin sid=${String(sessionId)} reset=${reset}${jobId !== void 0 ? ` jobId=${jobId}` : ""}`);
  const apiKey = await resolveApiKey(ctx, resolved);
  if (apiKey === void 0) {
    console.log(`[femo-plugin] credential ${resolved.apiKeyRef} not resolved; AI nodes will fail`);
  }
  const sid = String(sessionId);
  const prev = await readSessionScript(resolved.femoRoot, sid);
  const effectivePath = scriptPath ?? prev?.path;
  try {
    if (effectivePath !== void 0) {
      const { readFile: readFile3 } = await import("node:fs/promises");
      let fileText;
      try {
        fileText = await readFile3(effectivePath, "utf8");
      } catch {
        fileText = void 0;
      }
      const same = fileText !== void 0 && fileText.replace(/\r\n/g, "\n") === scriptText.replace(/\r\n/g, "\n");
      await writeSessionScript(resolved.femoRoot, sid, same ? { path: effectivePath } : { path: effectivePath, text: scriptText });
    } else {
      await writeSessionScript(resolved.femoRoot, sid, { text: scriptText });
    }
  } catch (error) {
    console.log(`[femo-plugin] session script record failed: ${String(error)}`);
  }
  broadcastSse("script_changed", { sessionId });
  if (runState.activeJobId === void 0) {
    const killed = abortAllSubagents("\u65B0\u811A\u672C\u5F00\u8DD1\uFF1A\u6E05\u7406\u4E0A\u4E00\u6B21\u6B8B\u7559\u5B50\u4EE3\u7406");
    if (killed > 0) console.log(`[femo-plugin] new run: cleaned ${killed} leftover subagent(s)`);
  }
  let startedWarnings = [];
  try {
    const baseDir = effectivePath !== void 0 ? effectivePath.replace(/[\\/][^\\/]*$/, "") : "";
    const scriptName = effectivePath !== void 0 ? effectivePath.split(/[\\/]/).pop() || "inline" : "inline";
    if (reset) {
      console.log(`[femo-run-diag ${diagTs2()}] job_start SEND sid=${sid}`);
      const res = await bridge.send("job_start", {
        femo: scriptText,
        base_dir: baseDir,
        user_api_key: apiKey,
        user_api_provider: resolved.provider,
        user_api_url: resolved.apiUrl,
        user_api_model: resolved.model,
        host_ai_backend: resolved.hostAiBackend,
        // source 编译期校验白名单：引擎 parse_script 时校验 actors 的 source 字段
        models: await collectLlmModels(ctx, resolved),
        host_ref: sid,
        // 多宿主归属账（2026-09-21 账本多宿主化）：{宿主名: 会话id} 一格一
        // 宿主；host_ref 单值保留（兼容回退读法）。
        host_refs: { [hostAddr()]: sid },
        script_name: scriptName,
        // FEMO脚本快照随 Job 档案落盘（引擎侧 get_job_state 带出——femoGen 凭
        // job_id 渲染/续跑的数据源）。未保存=''（引擎缺省，纯文本次无地址可存）。
        script_path: effectivePath ?? ""
      }, 3e4);
      const newJobId = res?.job_id;
      if (typeof newJobId !== "number") {
        throw new Error(`job_start \u56DE\u6267\u7F3A job_id: ${JSON.stringify(res)}`);
      }
      const compileWarnings = Array.isArray(res?.warnings) ? res.warnings : [];
      startedWarnings = compileWarnings;
      if (compileWarnings.length > 0) {
        console.log(`[femo-plugin] job_start warnings: ${compileWarnings.length} item(s)`);
        broadcastSse("compile_warnings", { sid, job_id: newJobId, warnings: compileWarnings });
      }
      await setSessionCurrentJob(resolved.femoRoot, sid, newJobId);
      await appendSessionJob(resolved.femoRoot, sid, newJobId);
      void snapshotJobCast(resolved.femoRoot, newJobId).catch((error) => {
        console.log(`[femo-plugin] cast snapshot failed (job=${newJobId}): ${String(error)}`);
      });
      jobMirrorPrearm2(runState, newJobId, sid);
      pushDiag("run", `job_start OK prearm job=${newJobId} sid=${sid.slice(-12)}\uFF08activeJobId \u5DF2\u6307\u5411\u672C Job\uFF09`);
      broadcastProjectionState(runState, sid);
      if (projections !== void 0) {
        const session = ctx.get("sessions")?.get(SessionId(sid));
        if (session !== void 0) {
          broadcastCompat(ctx, session, projections, "\u{1F3AC} FEMO \u5DF2\u5F00\u59CB\uFF08\u5728\u4E0A\u5E1D\u89C6\u89D2\u7A97\u53E3\u67E5\u770B\uFF09");
          for (const w of compileWarnings) {
            broadcastCompat(
              ctx,
              session,
              projections,
              `\u2139\uFE0F \u7F16\u8BD1\u8B66\u544A${w.where ? `\uFF08${w.where}\uFF09` : ""}\uFF1A${w.message}`
            );
          }
        }
      }
      console.log(`[femo-run-diag ${diagTs2()}] job_start OK job=${newJobId} sid=${sid} (prearm: guard window closed)`);
    } else {
      const targetJobId = jobId ?? await readSessionCurrentJob(resolved.femoRoot, sid);
      if (targetJobId === void 0) {
        throw new Error("\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7EED\u8DD1\u7684 Job\uFF08\u672A\u8FD0\u884C\u8FC7\u6216\u5DF2\u5B8C\u6574\u8DD1\u5B8C\uFF09\uFF0C\u8BF7 fresh_start");
      }
      console.log(`[femo-run-diag ${diagTs2()}] job_resume SEND job=${targetJobId} sid=${sid}`);
      const res = await bridge.send("job_resume", {
        job_id: targetJobId,
        femo: scriptText,
        base_dir: baseDir,
        user_api_key: apiKey,
        user_api_provider: resolved.provider,
        user_api_url: resolved.apiUrl,
        user_api_model: resolved.model,
        host_ai_backend: resolved.hostAiBackend,
        // source 编译期校验白名单（与 job_start 同款；resume 也要校验——
        // 改了 source 的脚本续跑同样该在编译期报错）
        models: await collectLlmModels(ctx, resolved),
        host_ref: sid,
        // 多宿主归属账（同 fresh 分支；resume 合并语义——只动自己格）。
        host_refs: { [hostAddr()]: sid }
      }, 3e4);
      const resumeWarnings = Array.isArray(res?.warnings) ? res.warnings : [];
      startedWarnings = resumeWarnings;
      if (resumeWarnings.length > 0) {
        console.log(`[femo-plugin] job_resume warnings: ${resumeWarnings.length} item(s)`);
        broadcastSse("compile_warnings", { sid, job_id: targetJobId, warnings: resumeWarnings });
      }
      await setSessionCurrentJob(resolved.femoRoot, sid, targetJobId);
      await appendSessionJob(resolved.femoRoot, sid, targetJobId);
      void snapshotJobCast(resolved.femoRoot, targetJobId).catch((error) => {
        console.log(`[femo-plugin] cast snapshot failed (job=${targetJobId}): ${String(error)}`);
      });
      jobMirrorPrearm2(runState, targetJobId, sid);
      pushDiag("run", `job_resume OK prearm job=${targetJobId} sid=${sid.slice(-12)}`);
      broadcastProjectionState(runState, sid);
      if (projections !== void 0) {
        const session = ctx.get("sessions")?.get(SessionId(sid));
        if (session !== void 0) {
          broadcastCompat(ctx, session, projections, "\u25B6\uFE0F FEMO \u5DF2\u7EE7\u7EED\uFF08\u5728\u4E0A\u5E1D\u89C6\u89D2\u7A97\u53E3\u67E5\u770B\uFF09");
          for (const w of resumeWarnings) {
            broadcastCompat(
              ctx,
              session,
              projections,
              `\u2139\uFE0F \u7F16\u8BD1\u8B66\u544A${w.where ? `\uFF08${w.where}\uFF09` : ""}\uFF1A${w.message}`
            );
          }
        }
      }
      console.log(`[femo-run-diag ${diagTs2()}] job_resume OK job=${targetJobId} sid=${sid} (prearm: guard window closed)`);
    }
  } catch (error) {
    throw error;
  }
  console.log(`[femo-plugin] started script on ${sessionId}${scriptPath !== void 0 ? ` (${scriptPath})` : ""}`);
  return startedWarnings;
}
async function pauseJobResolved(bridge, runState, sessionId, jobId) {
  const job = activeJobOfSession(runState, sessionId);
  const mirrorTarget = job?.state === "running" && runState.activeJobId === job.jobId ? job.jobId : void 0;
  const out = await resolveAndPauseJob({
    send: (cmd, args, timeoutMs) => bridge.send(cmd, args, timeoutMs),
    hostKey: hostAddr(),
    ownerRef: sessionId,
    jobId,
    findMirrorTarget: () => mirrorTarget
  });
  if (out.kind === "none") {
    return { kind: "none", mirrorJobId: job?.jobId, activeJobId: runState.activeJobId ?? null };
  }
  return out;
}
async function readScriptText(femo, scriptPath) {
  if (femo !== void 0) return femo;
  const { readFileSync: readFileSync8 } = await import("node:fs");
  return readFileSync8(scriptPath, "utf8");
}
async function handleSaveScript(req, res, resolved) {
  if (req.method !== "POST") {
    writeJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    writeJson(res, 400, { ok: false, error: "invalid json body" });
    return;
  }
  const name2 = typeof body.name === "string" ? body.name.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const sessionId = typeof body.sessionId === "string" && body.sessionId.trim().length > 0 ? body.sessionId.trim() : "";
  const rawPath = typeof body.path === "string" && body.path.trim().length > 0 ? body.path.trim() : "";
  if (rawPath.length === 0 && name2.length === 0) {
    writeJson(res, 400, { ok: false, error: "name is required" });
    return;
  }
  if (content.trim().length === 0) {
    writeJson(res, 400, { ok: false, error: "content is required" });
    return;
  }
  const saveRecord = async (savedPath) => {
    const result = await writeSessionScript(resolved.femoRoot, sessionId, { path: savedPath, text: content });
    broadcastSse("script_changed", { sessionId });
    console.log(`[femo-plugin] session record updated: ${sessionId} <- ${savedPath} (rev ${result.ok ? String(result.rev) : "conflict"})`);
  };
  const { mkdirSync: mkdirSync5, writeFileSync: writeFileSync4 } = await import("node:fs");
  if (rawPath.length > 0) {
    const path2 = rawPath.toLowerCase().endsWith(".femo") ? rawPath : `${rawPath}.femo`;
    writeFileSync4(path2, content, "utf8");
    console.log(`[femo-plugin] saved script to ${path2}`);
    if (sessionId.length > 0) await saveRecord(path2);
    await rememberFemoFile(resolved.femoRoot, path2, "export");
    writeJson(res, 200, { ok: true, path: path2 });
    return;
  }
  const safe = name2.replace(/[\\/:*?"<>|]/g, "_").replace(/\.femo$/i, "");
  const projectsDir = join15(dataRootOf(resolved.femoRoot), "projects");
  mkdirSync5(projectsDir, { recursive: true });
  const path = `${projectsDir}\\${safe}.femo`;
  writeFileSync4(path, content, "utf8");
  console.log(`[femo-plugin] saved script to ${path}`);
  if (sessionId.length > 0) await saveRecord(path);
  await rememberFemoFile(resolved.femoRoot, path, "export");
  writeJson(res, 200, { ok: true, path });
}
async function handleReadScript(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.searchParams.get("path");
  if (path === null || path.trim().length === 0) {
    writeJson(res, 400, { ok: false, error: "path is required" });
    return;
  }
  const { readFileSync: readFileSync8 } = await import("node:fs");
  try {
    const content = readFileSync8(path, "utf8");
    writeJson(res, 200, { ok: true, content });
  } catch (error) {
    writeJson(res, 404, { ok: false, error: `cannot read ${path}: ${String(error)}` });
  }
}
async function ensureSessionLive(ctx, sessionId, tag, sessionsStore) {
  const agents = ctx.get("agents");
  if (agents?.resume === void 0) return void 0;
  const defaultModelSvc = ctx.agentDefaultModel;
  const sel = defaultModelSvc?.currentSelection?.();
  const agentOptions = sel?.provider !== void 0 && sel.provider.length > 0 && sel.model !== void 0 && sel.model.length > 0 ? {
    provider: sel.provider,
    model: sel.model,
    ...sel.reasoningEffort !== void 0 && sel.reasoningEffort.length > 0 ? { reasoningEffort: sel.reasoningEffort } : {}
  } : void 0;
  if (agentOptions === void 0) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} agentDefaultModel unavailable; resuming without agentOptions`);
    pushDiag("run", `${tag} \u51B7\u88C5\u8F7D\u65E0\u9ED8\u8BA4\u6A21\u578B\u670D\u52A1\uFF08agentDefaultModel \u7F3A\u5E2D\uFF09\uFF0C\u88F8 resume\u2014\u2014followup \u53EF\u80FD\u62A5 no provider/model`);
  } else {
    pushDiag("run", `${tag} \u51B7\u88C5\u8F7D\u5E26\u6A21\u578B\u8DEF\u7531 provider=${agentOptions.provider} model=${agentOptions.model}`);
  }
  try {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} store miss \u2192 agents.resume (0.1.3 native reload)${agentOptions !== void 0 ? ` model=${agentOptions.model}` : ""}`);
    await agents.resume({
      resumeSessionId: sessionId,
      ...agentOptions !== void 0 ? { agentOptions } : {},
      setup: async (agentCtx) => {
        const presets = agentCtx.get("agentPresets");
        if (presets?.mount !== void 0) {
          try {
            await presets.mount(agentCtx, FEMO_PRESET);
            const dispose = injectFemoRoot(agentCtx);
            if (dispose !== void 0) femoRootSections.set(String(sessionId), dispose);
          } catch (error) {
            console.log(`[femo-plugin] preset mount failed: ${String(error)}`);
          }
        }
      }
    });
  } catch (error) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} agents.resume FAILED: ${String(error instanceof Error ? error.message : error).slice(0, 200)}`);
    return void 0;
  }
  return sessionsStore?.get(sessionId);
}
async function handleRunOnSession(req, res, ctx, resolved, bridge, runState, projections) {
  if (req.method !== "POST") {
    writeJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const body = await readBody(req);
  const seq = ++runDiagSeq;
  const tag = `#${seq}`;
  const sessionId0 = typeof body.sessionId === "string" && body.sessionId.trim().length > 0 ? body.sessionId : "-";
  const reqJobId = typeof body.jobId === "number" && Number.isFinite(body.jobId) ? Math.trunc(body.jobId) : void 0;
  const sidNormalized = mainSessionIdOf(sessionId0);
  console.log(`[femo-run-diag ${diagTs2()}] ${tag} === POST /run arrive === sid=${sessionId0}${sidNormalized !== sessionId0 ? ` \u2192 main=${sidNormalized}` : ""} reset=${String(body.reset === true)}${reqJobId !== void 0 ? ` jobId=${reqJobId}` : ""} activeJobId=${String(runState.activeJobId ?? "-")}`);
  const sessionId = sidNormalized.trim().length > 0 ? SessionId(sidNormalized) : void 0;
  if (sessionId === void 0) {
    writeJson(res, 400, { ok: false, error: "sessionId is required" });
    return;
  }
  const sessionsStore = ctx.get("sessions");
  let session = sessionsStore?.get(sessionId);
  if (session === void 0) {
    session = await ensureSessionLive(ctx, sessionId, tag, sessionsStore);
  }
  if (session === void 0) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} REJECT-404 (session not in store)`);
    writeJson(res, 404, { ok: false, error: `session ${sessionId} not found` });
    return;
  }
  if (presetOf(session) !== FEMO_PRESET) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} NOTE (non-femo preset='${presetOf(session) ?? "-"}' allowed to run)`);
  }
  try {
    assertRunAllowed(runState, String(sessionId));
  } catch (error) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} GUARD-REJECT-409 (${String(error instanceof Error ? error.message : error)})`);
    writeJson(res, 409, { ok: false, error: String(error instanceof Error ? error.message : error) });
    return;
  }
  console.log(`[femo-run-diag ${diagTs2()}] ${tag} GUARD-PASS (no active job)`);
  const femo = typeof body.femo === "string" && body.femo.trim().length > 0 ? body.femo : void 0;
  const scriptPath = typeof body.scriptPath === "string" && body.scriptPath.trim().length > 0 ? body.scriptPath : void 0;
  if (femo === void 0 && scriptPath === void 0) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} REJECT-400 (no femo/scriptPath)`);
    writeJson(res, 400, { ok: false, error: "femo or scriptPath is required" });
    return;
  }
  const reset = body.reset === true;
  try {
    const scriptText = await readScriptText(femo, scriptPath);
    const baseDir = scriptPath !== void 0 ? scriptPath.replace(/[\\/][^\\/]*$/, "") : "";
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} check start (bridge compile, guard slot NOT yet occupied by startJob)`);
    try {
      const checkRes = await bridge.send("check", { femo: scriptText, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 3e4);
      const checkWarnings = Array.isArray(checkRes?.warnings) ? checkRes.warnings : [];
      if (checkWarnings.length > 0) {
        console.log(`[femo-plugin] check warnings: ${checkWarnings.map((w) => `[${w.where ?? ""}] ${w.message ?? ""}`).join(" | ")}`);
      }
      console.log(`[femo-run-diag ${diagTs2()}] ${tag} check OK`);
    } catch (error) {
      console.log(`[femo-run-diag ${diagTs2()}] ${tag} check FAILED: ${String(error instanceof Error ? error.message : error)}`);
      writeJson(res, 400, { ok: false, error: `FEMO\u811A\u672C\u7F16\u8BD1\u5931\u8D25\uFF1A${String(error instanceof Error ? error.message : error)}` });
      return;
    }
    await startJobOnSession(ctx, resolved, bridge, runState, sessionId, scriptText, scriptPath, reset, reqJobId, projections);
    writeJson(res, 200, { ok: true, sessionId: String(sessionId) });
  } catch (error) {
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} run-on-session FAILED: ${String(error)}`);
    writeJson(res, 400, { ok: false, error: String(error instanceof Error ? error.message : error) });
  }
}
async function handleCreateSession(req, res, ctx, resolved, bridge, runState, projections) {
  if (req.method !== "POST") {
    writeJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const body = await readBody(req);
  const cwd = typeof body.cwd === "string" && body.cwd.trim().length > 0 ? body.cwd : process.cwd();
  const defaultModel = ctx.get("agentDefaultModel");
  const sel = defaultModel?.currentSelection?.();
  const agentOptions = typeof sel?.provider === "string" && sel.provider.length > 0 && typeof sel.model === "string" && sel.model.length > 0 ? { provider: sel.provider, model: sel.model } : void 0;
  const id = SessionId(`femo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  try {
    const handle = await ctx.agents.create({
      sessionId: id,
      meta: {
        cwd,
        agentPreset: FEMO_PRESET
      },
      ...agentOptions !== void 0 ? { agentOptions } : {},
      // Mount the preset composition (persona + tools) so subagents spawned
      // under this session join it — without this the child sees no preset
      // tools and no persona (the RPC create path does this in its setup).
      setup: async (agentCtx) => {
        const presets = ctx.get("agentPresets");
        if (presets?.mount === void 0) return;
        try {
          await presets.mount(agentCtx, FEMO_PRESET);
          const dispose = injectFemoRoot(agentCtx);
          if (dispose !== void 0) femoRootSections.set(String(id), dispose);
        } catch (error) {
          console.log(`[femo-plugin] preset mount failed: ${String(error)}`);
        }
      }
    });
    console.log(`[femo-plugin] created femo session ${handle.agent.id} (cwd=${cwd})`);
    const femo = typeof body.femo === "string" && body.femo.trim().length > 0 ? body.femo : void 0;
    const scriptPath = typeof body.scriptPath === "string" && body.scriptPath.trim().length > 0 ? body.scriptPath : void 0;
    if (femo !== void 0 || scriptPath !== void 0) {
      const scriptText = await readScriptText(femo, scriptPath);
      try {
        assertRunAllowed(runState, String(id));
        await startJobOnSession(ctx, resolved, bridge, runState, id, scriptText, scriptPath, true, void 0, projections);
      } catch (error) {
        const runError = String(error instanceof Error ? error.message : error);
        console.log(`[femo-plugin] create-session auto-run skipped: ${runError}`);
        writeJson(res, 200, { ok: true, sessionId: String(id), run_started: false, run_error: runError });
        return;
      }
    }
    writeJson(res, 200, { ok: true, sessionId: String(id) });
  } catch (error) {
    console.log(`[femo-plugin] create-session FAILED: ${String(error)}`);
    writeJson(res, 500, { ok: false, error: String(error) });
  }
}

// host/hub/hub-proxy.ts
async function hubFetch(path, timeoutMs = 4e3) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${hubBaseUrl()}${path}`, { signal: ctl.signal });
    return { ok: resp.ok, data: await resp.json() };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}
async function resolveFemoJobId(resolved, runState, mainSid) {
  const memJob = runState.sidIndex.get(mainSid);
  if (memJob !== void 0 && runState.jobs.get(memJob) !== void 0) return memJob;
  return await readSessionCurrentJob(resolved.femoRoot, mainSid).catch(() => void 0);
}
async function fetchHubRoster(jobId) {
  const q = jobId !== void 0 ? `?job=${jobId}` : "";
  const { ok, data } = await hubFetch(`/views${q}`);
  if (!ok || typeof data !== "object" || data === null) return [];
  const views = data.views;
  if (!Array.isArray(views)) return [];
  return views.filter((v) => typeof v === "object" && v !== null && typeof v.id === "string" && String(v.id).startsWith("actor:"));
}
async function hubActorNames(jobId) {
  const roster = await fetchHubRoster(jobId);
  return [...new Set(roster.map((v) => v.base ?? v.name).filter((n) => n.length > 0))];
}
function rosterBareName(roster, actorKey) {
  for (const v of roster) {
    if (projectionActorKey(v.base ?? v.name) === actorKey || projectionActorKey(v.name) === actorKey) {
      return v.base ?? v.name;
    }
  }
  return void 0;
}
async function resolveActorName(runState, mainSid, actorKey, jobId) {
  const mem = runState.sessionActors.get(mainSid);
  const hit = mem?.find((name2) => projectionActorKey(name2) === actorKey);
  if (hit !== void 0) return hit;
  return rosterBareName(await fetchHubRoster(jobId), actorKey);
}
async function viewOf(runState, mainSid, win, jobId) {
  if (win === "god") return "god";
  if (win === "stage") return "stage";
  const actor = await resolveActorName(runState, mainSid, win, jobId);
  return `actor:${actor ?? win}`;
}
function mainSidOf(url) {
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const parsed = parseProjectionWindowId(sessionId);
  return parsed !== void 0 && parsed.mainSid.length > 0 ? parsed.mainSid : void 0;
}
var proxyLastSig = /* @__PURE__ */ new Map();
function registerHubProxy(resolved, runState, register) {
  register({
    kind: "exact",
    path: "/femo-plugin/hub-view",
    handler: (req, res) => {
      void (async () => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const mainSid = mainSidOf(url);
        if (mainSid === void 0) {
          writeJson(res, 200, { ok: false, error: "sessionId (femo-proj-*) required", live: false, rows: [], next: 0 });
          return;
        }
        const win = url.searchParams.get("win") ?? "god";
        const after = Math.max(0, Number(url.searchParams.get("after") ?? "0") || 0);
        const jobParam = Number(url.searchParams.get("job"));
        const explicitJob = Number.isFinite(jobParam) && jobParam > 0 ? jobParam : void 0;
        if (win === "god" && explicitJob === void 0) {
          const session = `${hostAddr()}:${mainSid}`;
          const sigS = `${mainSid}|god|session`;
          if (proxyLastSig.get(`${mainSid}|god`) !== sigS) {
            proxyLastSig.set(`${mainSid}|god`, sigS);
            console.log(`[femo-hub][proxy] god(session): mainSid=${mainSid.slice(-12)} session=${session} after=${after}`);
          }
          const { ok: ok2, data: data2 } = await hubFetch(`/view?session=${encodeURIComponent(session)}&view=god&after=${after}`);
          if (!ok2 || typeof data2 !== "object" || data2 === null) {
            console.log(`[femo-hub][proxy] hub fetch failed: session=${session}\uFF08hub \u4E0D\u5728\u7EBF\u6216\u8D85\u65F6\uFF09`);
            writeJson(res, 200, { ok: false, live: false, job: null, view: "god", rows: [], next: after });
            return;
          }
          const bodyS = data2;
          writeJson(res, 200, { ok: true, live: true, job: null, view: "god", rows: bodyS.rows ?? [], next: bodyS.next ?? after });
          return;
        }
        const jobId = explicitJob ?? await resolveFemoJobId(resolved, runState, mainSid);
        if (jobId === void 0) {
          writeJson(res, 200, { ok: true, live: false, job: null, view: win, rows: [], next: 0 });
          return;
        }
        const view = await viewOf(runState, mainSid, win, jobId);
        const sig = `${mainSid}|${win}|${jobId}|${view}`;
        if (proxyLastSig.get(`${mainSid}|${win}`) !== sig) {
          proxyLastSig.set(`${mainSid}|${win}`, sig);
          console.log(`[femo-hub][proxy] ${win}: mainSid=${mainSid.slice(-12)} job=${jobId} view=${view} after=${after}`);
        }
        const { ok, data } = await hubFetch(`/view?job=${jobId}&view=${encodeURIComponent(view)}&after=${after}`);
        if (!ok || typeof data !== "object" || data === null) {
          console.log(`[femo-hub][proxy] hub fetch failed: job=${jobId} view=${view}\uFF08hub \u4E0D\u5728\u7EBF\u6216\u8D85\u65F6\uFF09`);
          writeJson(res, 200, { ok: false, live: false, job: jobId, view, rows: [], next: after });
          return;
        }
        const body = data;
        writeJson(res, 200, { ok: true, live: true, job: jobId, view, rows: body.rows ?? [], next: body.next ?? after });
      })().catch(() => {
        writeJson(res, 200, { ok: false, live: false, rows: [], next: 0 });
      });
    }
  });
}

// host/routes/projection-input.ts
async function handleProjectionInput(ctx, deps, req, res) {
  const { resolved, runState, bridge } = deps;
  const debugLog = (line) => {
    appendDebugLog(
      resolved.femoRoot,
      "debug-projection-input.log",
      "[" + (/* @__PURE__ */ new Date()).toISOString() + "] " + line
    );
  };
  debugLog(`=== invoke ===`);
  const raw = await readBody(req);
  const sessionId = typeof raw.sessionId === "string" && raw.sessionId.trim().length > 0 ? raw.sessionId : "";
  const text = typeof raw.text === "string" && raw.text.trim().length > 0 ? raw.text.trim() : "";
  const rawVars = typeof raw.variables === "object" && raw.variables !== null ? raw.variables : {};
  const variables = {};
  for (const [key, value] of Object.entries(rawVars)) {
    if (typeof value === "string" && value.trim().length > 0) variables[key] = value.trim();
  }
  debugLog(`payload: sessionId=${sessionId} textLen=${text.length} variables=${JSON.stringify(variables)}`);
  if (sessionId.length === 0 || text.length === 0 && Object.keys(variables).length === 0) {
    writeJson(res, 400, { ok: false, error: "sessionId and text (or variables) are required" });
    return;
  }
  const sessions = ctx.get("sessions");
  let win = sessions?.get(SessionId(sessionId));
  if (win === void 0 && sessionId.startsWith("femo-proj-")) {
    const mainSid0 = parseProjectionWindowId(sessionId)?.mainSid ?? "";
    let mainSession = mainSid0.length > 0 ? sessions?.get(SessionId(mainSid0)) : void 0;
    if (mainSession === void 0 && mainSid0.length > 0 && deps.ensureMainLive !== void 0) {
      debugLog(`ensure \u515C\u5E95\uFF1A\u4E3B\u4F1A\u8BDD\u4E0D\u5728 store\uFF0C\u5148\u62C9\u6D3B sid=${mainSid0}`);
      try {
        mainSession = await deps.ensureMainLive(mainSid0);
        debugLog(`ensure \u515C\u5E95\uFF1A\u4E3B\u4F1A\u8BDD\u62C9\u6D3B\u7ED3\u679C=${mainSession === void 0 ? "\u5931\u8D25" : "\u6210\u529F"}`);
      } catch (error) {
        debugLog(`ensure \u515C\u5E95\uFF1A\u4E3B\u4F1A\u8BDD\u62C9\u6D3B\u5F02\u5E38 ${String(error instanceof Error ? error.message : error)}`);
      }
    }
    const cwd = mainSession?.header?.cwd;
    if (mainSid0.length > 0 && typeof cwd === "string" && cwd.length > 0) {
      debugLog(`ensure \u515C\u5E95\uFF1A\u7A97\u4E0D\u5728 store\uFF0C\u51B7\u88C5\u8F7D\u4E3B\u4F1A\u8BDD\u7684\u6295\u5F71\u7A97 sid=${mainSid0}`);
      try {
        const jobId = await resolveFemoJobId(resolved, runState, mainSid0);
        const scopeActors = await hubActorNames(jobId);
        await deps.projections.ensure(mainSid0, scopeActors, cwd);
        win = sessions?.get(SessionId(sessionId));
        debugLog(`ensure \u515C\u5E95\u7ED3\u679C\uFF1A${win === void 0 ? "\u4ECD\u672A\u88C5\u8F7D\uFF08\u7A97\u53EF\u80FD\u4E0D\u5B58\u5728\uFF09" : "\u5DF2\u88C5\u8F7D"}`);
      } catch (error) {
        debugLog(`ensure \u515C\u5E95\u5931\u8D25: ${String(error instanceof Error ? error.message : error)}`);
      }
    } else {
      debugLog(`ensure \u515C\u5E95\u8DF3\u8FC7\uFF1A\u4E3B\u4F1A\u8BDD\u4E0D\u5728 store \u6216\u7F3A cwd\uFF08mainSid=${mainSid0 || "-"}\uFF09`);
    }
  }
  if (win === void 0) {
    debugLog(`result: 404 window not found in store\uFF08ensure \u515C\u5E95\u540E\u4ECD\u672A\u88C5\u8F7D\uFF09`);
    pushDiag("proj-input", `404 \u7A97\u4E0D\u5728 store\uFF1Asid=${sessionId.slice(-16)}\uFF08\u5BBF\u4E3B\u91CD\u542F\u540E\u6295\u5F71\u7A97\u672A\u88C5\u8F7D\uFF1B\u5DF2\u5C1D\u8BD5\u51B7\u88C5\u8F7D\uFF09`);
    writeJson(res, 404, { ok: false, error: `session ${sessionId} not found` });
    return;
  }
  const parentHeader = win.header?.parentSession;
  const mainSid = typeof parentHeader === "string" && parentHeader.length > 0 ? parentHeader : parseProjectionWindowId(sessionId)?.mainSid ?? "";
  const job = activeJobOfSession(runState, mainSid);
  const waiting = job !== void 0 && job.state === "running" && runState.activeJobId === job.jobId && job.waitingHuman !== void 0;
  const idle = job === void 0 || job.state !== "running" || runState.activeJobId !== job.jobId;
  const isGodWindow = parseProjectionWindowId(sessionId)?.win === GOD_ACTOR;
  debugLog(`judge: isGod=${isGodWindow} job=${job === void 0 ? "-" : String(job.jobId)} state=${job?.state ?? "-"} active=${String(runState.activeJobId ?? "-")} waitHuman=${job?.waitingHuman === void 0 ? "-" : JSON.stringify(job.waitingHuman)} => idle=${idle} waiting=${waiting}`);
  pushDiag("proj-input", `judge isGod=${isGodWindow} job=${job === void 0 ? "-" : String(job.jobId)} state=${job?.state ?? "-"} active=${String(runState.activeJobId ?? "-")} waitHuman=${job?.waitingHuman === void 0 ? "NONE" : JSON.stringify(job.waitingHuman)} => waiting=${waiting}`);
  if (idle && isGodWindow) {
    if (deps.mailboxPushUp === true) {
      try {
        const posted = await bridge.send("mailbox_post", {
          letter: {
            soul: "main",
            kind: "notice",
            payload: text,
            subkind: "user_interjection",
            delivery: "urgent"
          },
          push_extra: { mainSid }
        }, 1e4);
        if (posted?.ok === true) {
          debugLog(`branch\u2460 letter posted delivered=${posted.delivered === true} mainSid=${mainSid}`);
          console.log(`[femo-plugin] projection input -> main via mailbox: sid=${mainSid} len=${text.length} delivered=${posted.delivered === true}`);
          writeJson(res, 200, { ok: true, routed: "main", accepted: true, via: "mailbox" });
          return;
        }
        debugLog("branch\u2460 mailbox_post not ok \u2192 \u964D\u7EA7\u76F4\u63A8");
      } catch (error) {
        debugLog(`branch\u2460 mailbox_post failed: ${String(error instanceof Error ? error.message : error)} \u2192 \u964D\u7EA7\u76F4\u63A8`);
      }
    }
    debugLog(`branch\u2460 idle -> followup (direct) mainSid=${mainSid}`);
    followupMain(ctx, mainSid, text);
    console.log(`[femo-plugin] projection input -> main followup: sid=${mainSid} len=${text.length}`);
    writeJson(res, 200, { ok: true, routed: "main", accepted: true, via: "direct" });
    return;
  }
  if (waiting) {
    await feedHumanNode(ctx, deps, mainSid, job, text, variables, debugLog);
    writeJson(res, 200, { ok: true, routed: "human-node" });
    return;
  }
  appendEvent(win, "user/message", {
    content: [{ type: "text", text }],
    source: { kind: "user" }
  }, { surfaceOp: "append" });
  pushDiag("proj-input", `branch\u2462 kept-local sid=${sessionId.slice(-12)} waiting=${waiting}\uFF08waiting=false \u4E14\u975E idle=\u5F15\u64CE\u5728\u8DD1\u4F46\u5BBF\u4E3B\u65E0\u4EBA\u7C7B\u7B49\u5F85\u767B\u8BB0\uFF1Bidle=FEMO\u811A\u672C\u975E running\uFF09`);
  console.log(`[femo-plugin] projection input kept local: len=${text.length}`);
  writeJson(res, 200, { ok: true, routed: "interjection-todo" });
}
async function feedHumanNode(ctx, deps, mainSid, job, text, variables, debugLog) {
  const { bridge, projections, sessionsStore } = deps;
  const waitKeyUsed = String(job.waitingHuman?.waitKey ?? "");
  debugLog(`branch\u2461 feeding: job=${String(job.jobId)} wait_key=${waitKeyUsed} len=${text.length} vars=${JSON.stringify(variables)}`);
  const feedResult = await bridge.send("post_speech", humanSpeechArgs({
    jobId: job.jobId,
    waitKey: waitKeyUsed,
    soul: job.waitingHuman?.waitScope?.[0] ?? "human",
    node: job.waitingHuman?.nodeName,
    text,
    variables
  }));
  debugLog(`branch\u2461 feed result: ${JSON.stringify(feedResult)}`);
  pushDiag("proj-input", `branch\u2461 speech posted job=${String(job.jobId)} wait_key=${waitKeyUsed} \u2192 ${JSON.stringify(feedResult)}`);
  return feedResult?.posted ?? false;
}

// host/debug-run.ts
import { open as open2 } from "node:fs/promises";
var TAIL_INTERVAL_MS = 150;
function makeDshSpawnProc(ctx, resolved, mode) {
  return (spec) => {
    const subprocess = ctx.get("subprocess");
    if (subprocess === void 0) {
      throw new Error("subprocess \u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u65E0\u6CD5\u62C9\u8D77\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\uFF09");
    }
    let handle;
    const ready = subprocess.resolveExecutable(resolved.python).then((pythonPath) => {
      handle = subprocess.spawn({
        argv: [pythonPath, ...spec.argv],
        cwd: spec.cwd,
        stdio: {
          stdin: "ignore",
          stdout: mode === "capture" && spec.onStdoutChunk ? "pipe" : "ignore",
          // 'pipe' (not collect): the caller owns the stream and forwards
          // tracebacks live; a collect buffer would swallow them silently.
          stderr: "pipe"
        },
        graceMs: 3e3,
        env: spec.env
      });
      return handle;
    });
    const out = { done: void 0, terminate: () => {
      try {
        handle?.terminate();
      } catch {
      }
    } };
    out.done = ready.then((h) => {
      h.stderr?.on("data", (chunk) => {
        for (const line of chunk.toString("utf8").split(/\r?\n/)) {
          if (line.trim().length === 0) continue;
          if (mode === "capture") spec.onStderrLine?.(line);
          else process.stdout.write(`[femo-debug:stderr] ${line}
`);
          pushDiag("engine", `[stderr] ${line}`.slice(0, 400));
        }
      });
      if (mode === "capture" && spec.onStdoutChunk) {
        h.stdout?.on("data", (chunk) => spec.onStdoutChunk(chunk.toString("utf8")));
      }
      return h.done.then((outcome) => outcome, () => void 0);
    }, (error) => {
      throw new Error(`\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\u542F\u52A8\u5931\u8D25: ${String(error)}`);
    });
    return out;
  };
}
async function handleDebugRun(req, res, ctx, resolved) {
  if (!acquireDebugRun()) {
    writeJson(res, 409, { ok: false, error: "\u5DF2\u6709\u8C03\u8BD5\u5E72\u8DD1\u5728\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u518D\u70B9" });
    return;
  }
  const body = await readBody(req);
  const femo = typeof body.femo === "string" ? body.femo : "";
  if (femo.trim().length === 0) {
    releaseDebugRun();
    writeJson(res, 400, { ok: false, error: "FEMO\u811A\u672C\u6587\u672C\u4E3A\u7A7A" });
    return;
  }
  const runs = Number(body.runs);
  const seed = typeof body.seed === "number" ? body.seed : void 0;
  const module = typeof body.module === "string" ? body.module : void 0;
  const scriptPath = typeof body.scriptPath === "string" ? body.scriptPath : void 0;
  let streaming = false;
  let clientGone = false;
  let procHandle;
  let exited = false;
  const onClientClose = () => {
    clientGone = true;
    if (!exited && procHandle !== void 0) {
      try {
        procHandle.terminate();
      } catch {
      }
    }
  };
  try {
    let sandbox;
    let argv;
    try {
      sandbox = await prepareDebugSandbox(resolved.femoRoot, { femo });
      const built = await buildDebuggerArgv({ femoRoot: resolved.femoRoot, sandbox, req: { scriptPath }, runs, seed, module });
      argv = built.argv;
      if (built.note !== void 0) console.log(`[femo-plugin] debug-run: ${built.note}`);
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) });
      return;
    }
    const subprocess = ctx.get("subprocess");
    if (subprocess === void 0) {
      writeJson(res, 500, { ok: false, error: "subprocess \u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u65E0\u6CD5\u62C9\u8D77\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\uFF09" });
      return;
    }
    let handle;
    try {
      const pythonPath = await subprocess.resolveExecutable(resolved.python);
      handle = subprocess.spawn({
        argv: [pythonPath, ...argv],
        cwd: resolved.femoRoot,
        stdio: { stdin: "ignore", stdout: "ignore", stderr: "pipe" },
        graceMs: 3e3,
        env: { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
      });
    } catch (error) {
      writeJson(res, 500, { ok: false, error: `\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\u542F\u52A8\u5931\u8D25: ${String(error)}` });
      return;
    }
    procHandle = handle;
    const logPath = sandbox.logPath;
    req.on("close", onClientClose);
    res.on("close", onClientClose);
    handle.stderr?.on("data", (chunk) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.trim().length === 0) continue;
        process.stdout.write(`[femo-debug:stderr] ${line}
`);
        pushDiag("engine", `[stderr] ${line}`.slice(0, 400));
      }
    });
    streaming = true;
    res.writeHead(200, {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache"
    });
    const send = (rec) => {
      if (!clientGone && !res.destroyed) res.write(`${JSON.stringify(rec)}
`);
    };
    let offset = 0;
    let tailRemainder = "";
    const tailOnce = async () => {
      let fh;
      try {
        fh = await open2(logPath, "r");
      } catch {
        return;
      }
      try {
        const st = await fh.stat();
        if (st.size > offset) {
          const buf = Buffer.alloc(st.size - offset);
          const { bytesRead } = await fh.read(buf, 0, buf.length, offset);
          offset += bytesRead;
          tailRemainder += buf.toString("utf8");
          let idx;
          while ((idx = tailRemainder.indexOf("\n")) !== -1) {
            const line = tailRemainder.slice(0, idx).trim();
            tailRemainder = tailRemainder.slice(idx + 1);
            if (line.length === 0) continue;
            try {
              send(JSON.parse(line));
            } catch {
              send({ kind: "debug_error", error: `\u65E5\u5FD7\u884C\u89E3\u6790\u5931\u8D25: ${line.slice(0, 200)}` });
            }
          }
        }
      } finally {
        await fh.close();
      }
    };
    void handle.done.then(() => {
      exited = true;
    }, () => {
      exited = true;
    });
    const started = Date.now();
    let timedOut = false;
    let exitCode = -1;
    const timeoutMs = DEBUG_TIMEOUT_MS;
    while (!exited && !clientGone) {
      await tailOnce();
      if (exited || clientGone) break;
      if (Date.now() - started > timeoutMs) {
        timedOut = true;
        try {
          handle.terminate();
        } catch {
        }
        break;
      }
      await sleep2(TAIL_INTERVAL_MS);
    }
    const outcome = await handle.done.catch(() => void 0);
    exitCode = outcome?.exitCode ?? -1;
    await tailOnce();
    if (timedOut) send({ kind: "debug_error", error: `\u8C03\u8BD5\u5E72\u8DD1\u8D85\u65F6\uFF08${timeoutMs / 1e3}s\uFF09\uFF0C\u5DF2\u5F3A\u5236\u7EC8\u6B62` });
    send({ kind: "debug_done", exitCode });
  } finally {
    releaseDebugRun();
    req.off?.("close", onClientClose);
    res.off?.("close", onClientClose);
    if (streaming && !clientGone && !res.destroyed) res.end();
  }
}
var sleep2 = (ms) => new Promise((resolve2) => {
  setTimeout(resolve2, ms);
});
async function collectDebugRun2(ctx, resolved, req, signal) {
  return collectDebugRun({
    femoRoot: resolved.femoRoot,
    spawnProc: makeDshSpawnProc(ctx, resolved, "capture"),
    req,
    signal,
    onProgress: (msg) => pushDiag("femo-debug", msg)
  });
}

// ../../femo2host/femoGenConnector/file-dialogs.mjs
var DIALOG_TIMEOUT_MS = 6e5;
function b64(s) {
  return Buffer.from(String(s), "utf8").toString("base64");
}
function dialogPinCs() {
  const cs = [
    "using System; using System.Runtime.InteropServices; using System.Text;",
    "public class FDZ {",
    '  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);',
    '  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint c);',
    '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);',
    "  delegate bool EnumProc(IntPtr h, IntPtr l);",
    "  public static IntPtr FindOwned(IntPtr owner, string cls) {",
    "    IntPtr found = IntPtr.Zero;",
    "    EnumWindows(delegate(IntPtr h, IntPtr l) {",
    "      if (GetWindow(h, 4) == owner && IsWindowVisible(h)) {",
    "        StringBuilder sb = new StringBuilder(64); GetClassName(h, sb, 64);",
    "        if (sb.ToString() == cls) { found = h; return false; }",
    "      }",
    "      return true;",
    "    }, IntPtr.Zero);",
    "    return found;",
    "  }",
    "}"
  ].join("\n");
  return Buffer.from(cs, "utf8").toString("base64");
}
async function pickFemoFileViaDialog(opts) {
  const { spawn: spawn2 } = await import("node:child_process");
  const dialogType = opts.mode === "open" ? "OpenFileDialog" : "SaveFileDialog";
  const defaultNameLine = opts.defaultName !== void 0 ? `$d.FileName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(String(opts.defaultName).replace(/\.femo$/i, ""))}')) + '.femo'` : void 0;
  const initialDirLine = opts.initialDirectory !== void 0 ? `$d.InitialDirectory = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(opts.initialDirectory)}'))` : void 0;
  const ps = [
    "$ErrorActionPreference='Stop'",
    "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)",
    "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
    // 置顶兜底要用的 Win32 口（C# 全文 base64 解入；含按 owner 归属枚举对话框）。
    `Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${dialogPinCs()}'))) | Out-Null`,
    // 置顶腿①：owner 实弹成窗——屏幕外 1×1 透明真 Show，站进置顶带当锚。
    "$o = New-Object System.Windows.Forms.Form",
    "$o.TopMost = $true",
    "$o.ShowInTaskbar = $false",
    "$o.Opacity = 0",
    "$o.StartPosition = 'Manual'",
    "$o.Size = New-Object System.Drawing.Size(1, 1)",
    "$o.Location = New-Object System.Drawing.Point(-32000, -32000)",
    "[void]$o.Show()",
    `$d = New-Object System.Windows.Forms.${dialogType}`,
    `$d.Title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(opts.title)}'))`,
    "$d.Filter = 'FEMO Script (*.femo)|*.femo|All Files (*.*)|*.*'",
    ...initialDirLine !== void 0 ? [initialDirLine] : [],
    ...defaultNameLine !== void 0 ? [defaultNameLine] : [],
    // 置顶腿②：Timer 兜底再钉——后台进程改 Z 序不需要前台权限（SWP_NOACTIVATE
    // 不抢焦点，NOMOVE|NOSIZE 不扰拖窗；0x13=NOSIZE|NOMOVE|NOACTIVATE）。窗口按
    // owner 归属枚举（FindOwned），只钉自己 owner 名下的对话框，叠窗互不串扰。
    "$t = New-Object System.Windows.Forms.Timer",
    "$t.Interval = 300",
    "$t.Add_Tick({ $h = [FDZ]::FindOwned($o.Handle, '#32770'); if ($h -ne [IntPtr]::Zero) { [void][FDZ]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x13) } })",
    "$t.Start()",
    "$r = $d.ShowDialog($o)",
    "$t.Stop()",
    "if ($r -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) } else { exit 2 }"
  ].join("; ");
  const child = spawn2("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true });
  let out = "";
  let err = "";
  child.stdout.on("data", (c) => {
    out += c.toString("utf8");
  });
  child.stderr.on("data", (c) => {
    err += c.toString("utf8");
  });
  const timer = setTimeout(() => {
    try {
      child.kill();
    } catch {
    }
  }, DIALOG_TIMEOUT_MS);
  const code = await new Promise((resolve2) => {
    child.on("close", (c) => {
      clearTimeout(timer);
      resolve2(c ?? 1);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve2(-1);
    });
  });
  const picked = out.trim();
  if (code === 0 && picked.length > 0) return picked;
  if (code === 2) return null;
  throw new Error(`${opts.mode === "open" ? "pick-script" : "pick-save-path"} failed (exit ${String(code)})${err.trim().length > 0 ? `: ${err.trim().slice(-400)}` : ""}`);
}

// host/routes/dialogs.ts
function handlePickScript(res, femoRoot2) {
  void (async () => {
    let picked;
    try {
      picked = await pickFemoFileViaDialog({ mode: "open", title: "Import FEMO Script" });
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) });
      return;
    }
    if (picked === null) {
      writeJson(res, 200, { ok: true, path: null });
      return;
    }
    const { readFileSync: readFileSync8 } = await import("node:fs");
    let content;
    try {
      content = readFileSync8(picked, "utf8");
    } catch (error) {
      writeJson(res, 500, { ok: false, error: `cannot read ${picked}: ${String(error)}` });
      return;
    }
    await rememberFemoFile(femoRoot2, picked, "import");
    writeJson(res, 200, { ok: true, path: picked, content });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}
function handlePickSavePath(res, defaultName) {
  void (async () => {
    let picked;
    try {
      picked = await pickFemoFileViaDialog({ mode: "save", title: "Save FEMO Script", defaultName });
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) });
      return;
    }
    writeJson(res, 200, { ok: true, path: picked });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}

// host/routes/state.ts
async function reconcileMirrorWithEngine(opts) {
  const { bridge, runState, jobId, mainSid, sessionKnown, jobState } = opts;
  const mirror = runState.jobs.get(jobId);
  const mirrorRunning = mirror !== void 0 && mirror.state === "running";
  const engineRunning = jobState === "running";
  const settleMirror = (finalState) => {
    if (runState.jobs.get(jobId) === void 0) {
      jobMirrorPrearm2(runState, jobId, mainSid);
    }
    jobMirrorSetState2(runState, jobId, finalState);
    if (finalState !== "running" && runState.activeJobId === jobId) {
      runState.activeJobId = void 0;
    }
    broadcastProjectionState(runState, mainSid);
  };
  if (sessionKnown && mirrorRunning !== engineRunning) {
    console.log(`[femo-plugin] session-state \u72B6\u6001\u4E0D\u4E00\u81F4\u6536\u53E3: job=${jobId} sid=${mainSid.slice(-12)} \u5F15\u64CE=${jobState} \u955C\u50CF=${mirror?.state ?? "\u65E0"} \u2192 \u53D1\u9001 job_pause`);
    pushDiag("session-state", `\u72B6\u6001\u4E0D\u4E00\u81F4 job=${jobId} \u5F15\u64CE=${jobState} \u955C\u50CF=${mirror?.state ?? "\u65E0"} \u2192 job_pause \u6536\u53E3`);
    let pauseState;
    try {
      const pause = await bridge.send("job_pause", { job_id: jobId }, 15e3);
      pauseState = pause?.state;
    } catch (error) {
      console.log(`[femo-plugin] session-state job_pause \u6536\u53E3\u5931\u8D25\uFF0C\u6309\u67E5\u8BE2\u72B6\u6001\u5BF9\u9F50: ${String(error instanceof Error ? error.message : error)}`);
    }
    if (!engineRunning) {
      const finalState2 = pauseState ?? jobState;
      settleMirror(finalState2);
      return finalState2;
    }
    if (pauseState === "running") {
      settleMirror("running");
      return jobState;
    }
    const finalState = pauseState ?? "suspended";
    settleMirror(finalState);
    return finalState;
  }
  if (mirrorRunning && !engineRunning) {
    jobMirrorSetState2(runState, jobId, jobState);
  }
  return jobState;
}
async function writePending(deps, res, mainSid, jobId, script, record) {
  const pendingJobIds = await readSessionJobIds(deps.resolved.femoRoot, mainSid);
  writeJson(res, 200, {
    ok: true,
    pending: true,
    hasScript: script !== void 0,
    script: script ?? void 0,
    scriptPath: record?.path ?? void 0,
    rev: record?.rev ?? 0,
    jobId,
    ...pendingJobIds !== void 0 ? { jobIds: pendingJobIds } : {},
    checkpoint: {},
    running: false
  });
}
function handleSessionState(deps, req, res) {
  const { resolved, bridge, runState, sessionsStore } = deps;
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: "sessionId is required" });
      return;
    }
    const mainSid = mainSessionIdOf(sessionId);
    const record = await readSessionScript(resolved.femoRoot, mainSid);
    const script = await readSessionScriptText(resolved.femoRoot, mainSid);
    const pendingJobId = await readSessionCurrentJob(resolved.femoRoot, mainSid);
    if (!bridge.alive) {
      await writePending(deps, res, mainSid, pendingJobId, script, record);
      return;
    }
    let checkpoint = {};
    let jobState;
    let lastError;
    const jobId = pendingJobId;
    if (jobId !== void 0) {
      const sessionKnown = (() => {
        try {
          return sessionsStore?.get(SessionId(mainSid)) !== void 0;
        } catch {
          return false;
        }
      })();
      let state;
      try {
        state = await bridge.send("get_job_state", {
          job_id: jobId,
          ...sessionKnown ? { reconcile_if_stale: true } : {}
        }, 15e3);
      } catch (error) {
        console.log(`[femo-plugin] session-state get_job_state failed \u2192 pending \u8BED\u4E49\u8FD4\u56DE: ${String(error instanceof Error ? error.message : error)}`);
        await writePending(deps, res, mainSid, jobId, script, record);
        return;
      }
      if (state !== void 0 && state.state !== void 0) {
        jobState = state.state;
        if (jobState === "failed" && state.error !== void 0 && state.error.length > 0) {
          lastError = state.error;
        }
        jobState = await reconcileMirrorWithEngine({ bridge, runState, jobId, mainSid, sessionKnown, jobState });
        const labels = state.checkpoint_labels ?? {};
        checkpoint = Object.fromEntries(
          Object.entries(state.checkpoints ?? {}).map(([tid, nid]) => [tid, labels[tid] ?? nid])
        );
      } else if (state !== void 0) {
        const ghostMirror = runState.jobs.get(jobId);
        if (ghostMirror !== void 0 && ghostMirror.state === "running") {
          jobMirrorSetState2(runState, jobId, "suspended");
          if (runState.activeJobId === jobId) runState.activeJobId = void 0;
          broadcastProjectionState(runState, mainSid);
          console.log(`[femo-plugin] session-state job=${jobId} no_such_job\uFF1A\u6B8B\u7559 running \u955C\u50CF\u964D\u7EA7 suspended`);
        }
      }
    }
    const jobIds = await readSessionJobIds(resolved.femoRoot, mainSid);
    const waitingMirror = jobId !== void 0 ? runState.jobs.get(jobId) : void 0;
    writeJson(res, 200, {
      ok: true,
      hasScript: script !== void 0,
      script: script ?? void 0,
      scriptPath: record?.path ?? void 0,
      rev: record?.rev ?? 0,
      jobId,
      ...jobIds !== void 0 ? { jobIds } : {},
      checkpoint,
      state: jobState,
      running: isSessionRunning2(runState, mainSid),
      ...lastError !== void 0 ? { lastError } : {},
      ...waitingMirror?.waitingHuman !== void 0 ? { waitingHuman: waitingMirror.waitingHuman } : {}
    });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}

// host/routes/run.ts
function handlePause(deps, req, res) {
  const { bridge, runState, recordError } = deps;
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: "sessionId is required" });
      return;
    }
    const rawJobId = url.searchParams.get("jobId");
    const explicitJobId = rawJobId !== null && /^\d+$/.test(rawJobId) ? Number(rawJobId) : void 0;
    let out;
    try {
      out = await pauseJobResolved(bridge, runState, sessionId, explicitJobId);
    } catch (error) {
      const msg = String(error instanceof Error ? error.message : error);
      console.log(`[femo-plugin] pause sid=${sessionId} job=${String(explicitJobId ?? "-")} FAILED: ${msg}`);
      recordError(sessionId, `\u23F8 \u6682\u505C\u5931\u8D25\uFF1A\u5F15\u64CE\u65E0\u54CD\u5E94\uFF08${msg}\uFF09\u3002\u5F15\u64CE\u53EF\u80FD\u5DF2\u50F5\u6B7B\uFF0C\u91CD\u542F\u5BBF\u4E3B\u540E\u5BF9\u8D26\u6062\u590D`);
      pushDiag("pause", `FAILED sid=${sessionId} job=${String(explicitJobId ?? "-")}: ${msg}`);
      writeJson(res, 500, { ok: false, error: msg });
      return;
    }
    if (out.kind === "not-owner") {
      const denied = `Job ${String(explicitJobId)} \u4E0D\u5C5E\u4E8E\u4F1A\u8BDD ${sessionId}\uFF08\u5F52\u5C5E ${out.ownerShow}\uFF09\uFF0C\u62D2\u7EDD\u6682\u505C`;
      recordError(sessionId, `\u23F8 \u6682\u505C\u5931\u8D25\uFF1A${denied}`);
      pushDiag("pause", `DENIED sid=${sessionId} job=${String(explicitJobId)}\uFF08\u5F52\u5C5E ${out.ownerShow}\uFF09`);
      writeJson(res, 403, { ok: false, error: denied });
      return;
    }
    if (out.kind === "no-such-job") {
      console.log(`[femo-plugin] pause (explicit) sid=${sessionId} job=${String(out.jobId)} -> no_such_job`);
      writeJson(res, 404, { ok: false, error: `Job ${String(out.jobId)} \u4E0D\u5B58\u5728\uFF08no_such_job\uFF09` });
      return;
    }
    if (out.kind === "idle") {
      console.log(`[femo-plugin] pause (explicit) sid=${sessionId} job=${String(out.jobId)} -> idle state=${out.state}`);
      writeJson(res, 200, { ok: true, paused: false, state: out.state, job_id: out.jobId, note: `Job \u672A\u5728\u8FD0\u884C\uFF08state=${out.state}\uFF09` });
      return;
    }
    if (out.kind === "none") {
      console.log(`[femo-plugin] pause sid=${sessionId} mirrorJob=${String(out.mirrorJobId ?? "-")} activeJobId=${String(out.activeJobId ?? "-")} -> none\uFF08\u5F15\u64CE\u6863\u6848\u4EA6\u65E0 running\uFF09`);
      writeJson(res, 200, { ok: true, paused: false, note: "\u8BE5\u4F1A\u8BDD\u65E0\u6D3B\u8DC3FEMO\u811A\u672C" });
      return;
    }
    console.log(`[femo-plugin] pause sid=${sessionId} job=${String(out.jobId)} -> paused=${out.paused} state=${String(out.state ?? "-")}`);
    writeJson(res, 200, { ok: true, paused: out.paused, state: out.state, job_id: out.jobId });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}
function handleHumanInput(deps, req, res) {
  const { bridge, runState } = deps;
  void (async () => {
    const raw = await readBody(req);
    const waitKey = typeof raw.wait_key === "string" ? raw.wait_key : "";
    const chatText = typeof raw.chat_text === "string" ? raw.chat_text : "";
    const variables = raw.variables ?? {};
    const hasVars = typeof variables === "object" && variables !== null && Object.keys(variables).length > 0;
    const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : "";
    if (waitKey.length === 0 || chatText.length === 0 && !hasVars || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: "sessionId, wait_key and chat_text/variables are required" });
      return;
    }
    const job = activeJobOfSession(runState, sessionId);
    if (job === void 0 || job.state !== "running" || job.waitingHuman === void 0) {
      pushDiag("canvas-input", `B6-INTERCEPT sid=${sessionId.slice(-12)} job=${job?.jobId ?? "-"} state=${job?.state ?? "-"} waitHuman=${job?.waitingHuman === void 0 ? "none" : "set"} wait_key=${waitKey}`);
      console.log(`[femo-plugin] /human-input B6-intercept: sid=${sessionId} job=${job?.jobId ?? "-"} state=${job?.state ?? "-"} waitHuman=${job?.waitingHuman === void 0 ? "none" : "set"} wait_key=${waitKey}`);
      writeJson(res, 200, { ok: true, delivered: false, note: "no active job" });
      return;
    }
    pushDiag("canvas-input", `feeding job=${job.jobId} wait_key=${waitKey} len=${chatText.length}`);
    const speech = humanSpeechArgs({ jobId: job.jobId, waitKey, text: chatText, variables });
    const delivered = await bridge.send("human_input", {
      job_id: speech.job_id,
      wait_key: speech.wait_key,
      body: speech.body
    });
    writeJson(res, 200, { ok: true, delivered: delivered?.delivered ?? false });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}

// host/routes/script-files.ts
function handleSessionScript(resolved, req, res) {
  void (async () => {
    const raw = await readBody(req);
    const sessionId = typeof raw.sessionId === "string" && raw.sessionId.trim().length > 0 ? raw.sessionId.trim() : "";
    if (sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: "sessionId is required" });
      return;
    }
    const scriptPath = typeof raw.scriptPath === "string" && raw.scriptPath.trim().length > 0 ? raw.scriptPath.trim() : "";
    const femo = typeof raw.femo === "string" && raw.femo.trim().length > 0 ? raw.femo : "";
    const baseRev = typeof raw.baseRev === "number" ? raw.baseRev : void 0;
    const pageId = typeof raw.pageId === "string" ? raw.pageId : "";
    if (femo.length === 0) {
      writeJson(res, 400, { ok: false, error: "femo is required" });
      return;
    }
    const scriptMainSid = mainSessionIdOf(sessionId);
    const prev = await readSessionScript(resolved.femoRoot, scriptMainSid);
    const explicit = scriptPath.length > 0;
    const result = await writeSessionScript(
      resolved.femoRoot,
      scriptMainSid,
      {
        ...explicit ? { path: scriptPath } : prev?.path === void 0 ? {} : { path: prev.path },
        text: femo
      },
      explicit ? void 0 : baseRev
    );
    if (!result.ok) {
      writeJson(res, 409, { ok: false, error: "conflict", record: result.record });
      return;
    }
    broadcastSse("script_changed", explicit ? { sessionId: scriptMainSid } : { sessionId: scriptMainSid, pageId });
    writeJson(res, 200, { ok: true, rev: result.rev });
  })().catch((error) => {
    if (res.headersSent) {
      console.warn("[femo-plugin] session-script handler failed after response:", String(error));
      return;
    }
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}

// ../../femo2host/host/femo-relation.mjs
async function sessionFemoRelation(femoRoot2, sessionId, opts = {}) {
  const sid = String(sessionId ?? "").trim();
  if (sid.length === 0) {
    return { ok: true, related: false, launched: false, acting: false, latestJob: void 0 };
  }
  const [jobIds, prefs] = await Promise.all([
    readSessionJobIds(femoRoot2, sid).catch(() => void 0),
    opts.castView ?? preferencesView(femoRoot2, "online")
  ]);
  const launched = Array.isArray(jobIds) && jobIds.length > 0 || typeof opts.isRunning === "function" && opts.isRunning(sid) === true;
  const acting = Object.values(prefs?.bindings ?? {}).some((entry) => entry?.sid === sid);
  const latestJob = Array.isArray(jobIds) && jobIds.length > 0 ? jobIds[jobIds.length - 1] : void 0;
  return { ok: true, related: launched || acting, launched, acting, latestJob };
}

// host/routes/projection.ts
function handleActors(deps, req, res) {
  const { resolved, runState } = deps;
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 200, { ok: true, actors: [] });
      return;
    }
    const mem = runState.sessionActors.get(sessionId);
    console.log(`[femo-plugin][diag] GET /actors ${sessionId}: mem=${mem === void 0 ? "undefined" : JSON.stringify(mem)}`);
    if (mem !== void 0 && mem.length > 0) {
      writeJson(res, 200, { ok: true, actors: mem });
      return;
    }
    const jobId = await resolveFemoJobId(resolved, runState, sessionId);
    const actors = await hubActorNames(jobId);
    console.log(`[femo-plugin][diag] GET /actors ${sessionId}: mem miss, hub roster fallback=${JSON.stringify(actors)}`);
    writeJson(res, 200, { ok: true, actors });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}
function handleProjectionState(deps, req, res) {
  const { resolved, runState } = deps;
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const parsedWin = parseProjectionWindowId(sessionId);
    if (parsedWin === void 0) {
      writeJson(res, 200, { ok: true, winKind: "none" });
      return;
    }
    const mainSid = parsedWin.mainSid;
    const actorKey = parsedWin.win;
    const winKind = actorKey === "god" ? "god" : actorKey === "stage" ? "stage" : "actor";
    const state = projectionStateOf2(runState, mainSid);
    const resolveActor = (actors) => actors.find((name2) => projectionActorKey(name2) === actorKey);
    const mem = runState.sessionActors.get(mainSid);
    if (mem !== void 0 && mem.length > 0) {
      writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor: resolveActor(mem), ...state });
      return;
    }
    const jobId = await resolveFemoJobId(resolved, runState, mainSid);
    const actor = rosterBareName(await fetchHubRoster(jobId), actorKey);
    writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor, ...state });
  })().catch(() => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parsedWin = parseProjectionWindowId(url.searchParams.get("sessionId") ?? "");
    const mainSid = parsedWin?.mainSid ?? "";
    const actorKey = parsedWin?.win;
    const winKind = actorKey === "god" ? "god" : actorKey === "stage" ? "stage" : actorKey === void 0 ? "none" : "actor";
    const state = parsedWin === void 0 ? { winKind: "none" } : { sid: mainSid, winKind, actor: void 0, ...projectionStateOf2(runState, mainSid) };
    writeJson(res, 200, { ok: true, ...state });
  });
}
function handleProjectionWindows(deps, req, res) {
  const { ctx, resolved, runState, projections, sessionsStore } = deps;
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: "sessionId is required" });
      return;
    }
    let windows = projections.get(sessionId);
    if (windows === void 0) {
      let main = sessionsStore?.get(SessionId(sessionId));
      if (main === void 0) {
        main = await ensureSessionLive(ctx, SessionId(sessionId), "projection-windows", sessionsStore);
      }
      const cwd = main?.header?.cwd;
      if (main === void 0 || cwd === void 0) {
        writeJson(res, 503, {
          ok: false,
          kind: "main-not-loaded",
          error: "\u4E3B\u4F1A\u8BDD\u672A\u88C5\u8F7D\uFF08\u81EA\u52A8\u62C9\u6D3B\u5931\u8D25\uFF09\uFF1A\u5148\u6253\u5F00\u4E00\u6B21\u4E3B\u4F1A\u8BDD\uFF08FEMO\u5916 \xB7 \u4E3B\u6A21\u578B\uFF09\u518D\u70B9\u89C6\u89D2\uFF1B\u4E00\u76F4\u5931\u8D25\u8BF7\u770B\u5BBF\u4E3B\u65E5\u5FD7 [femo-run-diag]"
        });
        return;
      }
      const jobId = await resolveFemoJobId(resolved, runState, sessionId);
      const scopeActors = await hubActorNames(jobId);
      windows = await projections.ensure(sessionId, scopeActors, cwd);
    }
    const actors = {};
    for (const [actor, win] of windows.actors) actors[actor] = String(win.id);
    writeJson(res, 200, {
      ok: true,
      god: windows.god === void 0 ? void 0 : String(windows.god.id),
      stage: windows.stage === void 0 ? void 0 : String(windows.stage.id),
      actors
    });
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}
function handleFemoRelation(deps, req, res) {
  const { resolved, runState } = deps;
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const out = await sessionFemoRelation(resolved.femoRoot, sessionId, {
      isRunning: (sid) => runState.sidIndex.get(sid) !== void 0
    });
    writeJson(res, 200, out);
  })().catch((error) => {
    writeJson(res, 500, { ok: false, error: String(error) });
  });
}

// host/routes/index.ts
function registerRoutes(ctx, deps) {
  const { resolved, bridge, runState, projections, sessionsStore, recordError } = deps;
  const webServer = ctx.get("webServer");
  if (webServer !== void 0 && typeof webServer.register === "function") {
    registerHubProxy(resolved, runState, (spec) => webServer.register(spec));
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/create-session",
      handler: (req, res) => {
        void handleCreateSession(req, res, ctx, resolved, bridge, runState, projections).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/run",
      handler: (req, res) => {
        void handleRunOnSession(req, res, ctx, resolved, bridge, runState, projections).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/models",
      handler: (_req, res) => {
        void collectLlmModels(ctx, resolved).then((payload) => {
          writeJson(res, 200, { ok: true, ...payload });
        }).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/native-flag",
      handler: (_req, res) => {
        writeJson(res, 200, { ok: true, native: isNativeMode() });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/actor-usage",
      handler: (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const sid = url.searchParams.get("sessionId") ?? "";
          if (sid.length === 0) {
            writeJson(res, 400, { ok: false, error: "sessionId is required" });
            return;
          }
          const mem = actorUsageBySession.get(sid);
          if (mem !== void 0) {
            writeJson(res, 200, { ok: true, actors: Object.fromEntries(mem) });
            return;
          }
          const actors = await readActorUsageFile(sid);
          writeJson(res, 200, { ok: true, actors: actors ?? {} });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    const castBusyJobOf = (sid) => {
      for (const [jobId, mirror] of runState.jobs) {
        if (mirror.ownerSid === sid && mirror.state === "running") return String(jobId);
      }
      return void 0;
    };
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/cast",
      handler: (req, res) => {
        void (async () => {
          if (req.method === "GET") {
            const [prefs, soulsOut] = await Promise.all([
              preferencesView(resolved.femoRoot),
              bridge.send("list_souls", {}, 15e3)
            ]);
            writeJson(res, 200, { ok: true, bindings: prefs.bindings, souls: soulsOut?.souls ?? [] });
            return;
          }
          if (req.method !== "POST") {
            writeJson(res, 405, { ok: false, error: "method not allowed" });
            return;
          }
          const body = await readBody(req);
          const action = typeof body.action === "string" ? body.action : "";
          const soulId = typeof body.soul_id === "string" ? body.soul_id.trim() : "";
          const sid = typeof body.sid === "string" ? body.sid.trim() : "";
          if (action !== "bind" && action !== "unbind" || soulId.length === 0 || sid.length === 0) {
            writeJson(res, 400, { ok: false, error: "action(bind|unbind) + soul_id + sid are required" });
            return;
          }
          if (soulId === "human") {
            writeJson(res, 400, { ok: false, error: "human \u89D2\u8272\u4E0D\u53C2\u4E0E\u4F1A\u8BDD\u7ED1\u5B9A" });
            return;
          }
          const busyJob = castBusyJobOf(sid);
          if (busyJob !== void 0) {
            writeJson(res, 409, { ok: false, error: `\u672C\u4F1A\u8BDD\u6B63\u5728\u8FD0\u884C\uFF08Job ${busyJob}\uFF09\uFF0C\u8FD0\u884C\u4E2D\u4E0D\u8BB8\u6539\u7ED1\u5B9A` });
            return;
          }
          if (action === "bind") {
            const soulsOut = await bridge.send("list_souls", {}, 15e3);
            if (soulsOut?.souls?.find((s) => s.soul_id === soulId) === void 0) {
              writeJson(res, 404, { ok: false, error: `\u89D2\u8272 "${soulId}" \u4E0D\u5728\u89D2\u8272\u5E93\u91CC` });
              return;
            }
          }
          const out = await preferenceSet(resolved.femoRoot, hostAddr(), sid, action === "bind" ? soulId : null);
          if (out.ok !== true) {
            writeJson(res, 409, { ok: false, error: out.error ?? "\u7ED1\u5B9A\u88AB\u62D2\u7EDD" });
            return;
          }
          writeJson(res, 200, { ok: true, soul_id: soulId });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/souls",
      handler: (req, res) => {
        void (async () => {
          if (req.method !== "POST") {
            writeJson(res, 405, { ok: false, error: "method not allowed" });
            return;
          }
          const body = await readBody(req);
          const soulError = validateSoulCreate(body);
          if (soulError !== null) {
            writeJson(res, 400, { ok: false, error: soulError });
            return;
          }
          const soul_id = typeof body.soul_id === "string" ? body.soul_id.trim() : "";
          const result = await bridge.send("create_soul", {
            soul_id,
            soul_name: typeof body.soul_name === "string" ? body.soul_name.trim() : "",
            description: typeof body.description === "string" ? body.description : "",
            user_id: "u001"
          }, 15e3);
          writeJson(res, 200, { ok: true, soul_id, result });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/pause",
      handler: (req, res) => {
        handlePause({ bridge, runState, recordError }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/diag-tail",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const n = Number(url.searchParams.get("n") ?? "300");
        writeJson(res, 200, { ok: true, lines: diagTail(n) });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/debug-run",
      handler: (req, res) => {
        void handleDebugRun(req, res, ctx, resolved).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/human-input",
      handler: (req, res) => {
        handleHumanInput({ bridge, runState }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/scripts",
      handler: (_req, res) => {
        bridge.send("list_scripts", {}).then((result) => {
          const scripts = result?.scripts ?? [];
          writeJson(res, 200, { ok: true, scripts });
        }).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/save-script",
      handler: (req, res) => {
        void handleSaveScript(req, res, resolved).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/script",
      handler: (req, res) => {
        void handleReadScript(req, res).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/errors",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const sessionId = url.searchParams.get("sessionId");
        const list = sessionId === null ? [] : runState.errors.get(sessionId) ?? [];
        writeJson(res, 200, { ok: true, errors: list });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/editor-error",
      handler: (req, res) => {
        void (async () => {
          const raw = await readBody(req);
          const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : "";
          const message = typeof raw.message === "string" ? raw.message.trim() : "";
          const source = typeof raw.source === "string" && raw.source.length > 0 ? raw.source : "editor";
          if (sessionId.length === 0 || message.length === 0) {
            writeJson(res, 400, { ok: false, error: "sessionId and message are required" });
            return;
          }
          recordError(sessionId, `[\u7F16\u8F91\u5668\xB7${source}] ${message}`);
          writeJson(res, 200, { ok: true });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/actors",
      handler: (req, res) => {
        handleActors({ ctx, resolved, runState, projections, sessionsStore }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/projection-state",
      handler: (req, res) => {
        handleProjectionState({ ctx, resolved, runState, projections, sessionsStore }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/client-probe",
      handler: (req, res) => {
        void (async () => {
          let raw = null;
          try {
            raw = await readBody(req);
          } catch (error) {
            console.log(`[femo-probe][client] body read failed: ${String(error)}`);
          }
          console.log(`[femo-probe][client] ${JSON.stringify(raw)}`);
          writeJson(res, 200, { ok: true });
        })();
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/session-script",
      handler: (req, res) => {
        handleSessionScript(resolved, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/session-state",
      handler: (req, res) => {
        handleSessionState({ resolved, bridge, runState, sessionsStore }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/events",
      handler: (req, res) => {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "x-accel-buffering": "no"
        });
        res.write(": connected\n\n");
        sseChannel.connect(res);
        req.on("close", () => {
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/femo-files",
      handler: (_req, res) => {
        void (async () => {
          const files = await listFemoFiles(resolved.femoRoot);
          writeJson(res, 200, { ok: true, files });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/open-femo-file",
      handler: (req, res) => {
        void (async () => {
          const raw = await readBody(req);
          const path = typeof raw.path === "string" ? raw.path.trim() : "";
          if (path.length === 0) {
            writeJson(res, 400, { ok: false, error: "path is required" });
            return;
          }
          let content;
          try {
            content = await readLedgerFemoFile(resolved.femoRoot, path);
          } catch (error) {
            writeJson(res, 404, { ok: false, error: `\u6253\u4E0D\u5F00\u8BE5\u6587\u4EF6\uFF1A${String(error)}` });
            return;
          }
          await rememberFemoFile(resolved.femoRoot, path, "import");
          writeJson(res, 200, { ok: true, path, content });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/forget-femo-file",
      handler: (req, res) => {
        void (async () => {
          const raw = await readBody(req);
          const path = typeof raw.path === "string" ? raw.path.trim() : "";
          if (path.length === 0) {
            writeJson(res, 400, { ok: false, error: "path is required" });
            return;
          }
          const removed = await forgetFemoFile(resolved.femoRoot, path);
          writeJson(res, 200, { ok: true, removed });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/pick-script",
      handler: (_req, res) => {
        handlePickScript(res, resolved.femoRoot);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/pick-save-path",
      handler: (req, res) => {
        void (async () => {
          const raw = await readBody(req);
          const rawName = typeof raw.name === "string" ? raw.name : "";
          const base = (rawName.split(/[\\/]/).pop() ?? "").trim() || "flow";
          handlePickSavePath(res, base);
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/projection-windows",
      handler: (req, res) => {
        handleProjectionWindows({ ctx, resolved, runState, projections, sessionsStore }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/femo-relation",
      handler: (req, res) => {
        handleFemoRelation({ ctx, resolved, runState, projections, sessionsStore }, req, res);
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/projection-input",
      handler: (req, res) => {
        void handleProjectionInput(ctx, {
          resolved,
          bridge,
          runState,
          projections,
          sessionsStore,
          // 主会话不在 store（宿主重启后）：按官方路径拉活，ensure 兜底才有 cwd。
          ensureMainLive: (mainSid) => ensureSessionLive(ctx, SessionId(mainSid), "projection-input", sessionsStore),
          // 【十连裁⑨】收件口在=人类插话走寄信单通道的前提；未起 → 原地降级直推。
          mailboxPushUp: bridge.pushPort !== void 0
        }, req, res).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    console.log("[femo-plugin] create-session + scripts + save-script + script + errors routes registered");
  } else {
    console.log("[femo-plugin] webServer unavailable; routes not registered");
  }
}

// host/events/mailbox-push.ts
import { createServer } from "node:http";

// ../../femo2host/host/mailbox-push-core.mjs
function decidePush(body) {
  const letters = Array.isArray(body?.letters) ? body.letters : [];
  const isObj = (x) => x !== null && typeof x === "object";
  const isNotice = (x) => isObj(x) && x.kind === "notice";
  const isContext = (x) => isObj(x) && x.kind === "context";
  const outcome = typeof body?.outcome === "string" ? body.outcome : void 0;
  if (outcome !== void 0) {
    const first = isObj(letters[0]) ? letters[0] : void 0;
    const jobId2 = typeof body?.job_id === "number" ? body.job_id : typeof first?.job_id === "number" ? first.job_id : void 0;
    if (jobId2 === void 0 || outcome !== "finished" && outcome !== "failed" && outcome !== "paused") {
      return { kind: "stop-invalid", outcome, jobId: jobId2 };
    }
    const detail = typeof body?.detail === "string" ? body.detail : void 0;
    return { kind: "stop", jobId: jobId2, outcome, ...detail !== void 0 ? { detail } : {}, letters };
  }
  const playLetter = letters.find((x) => isNotice(x) && x.subkind === "play_start");
  if (playLetter !== void 0) {
    return {
      kind: "play-start",
      jobId: typeof playLetter.job_id === "number" ? playLetter.job_id : void 0,
      text: String(playLetter.payload ?? "")
    };
  }
  const retry = isObj(body?.retry) ? body.retry : void 0;
  const retryLetter = letters.find((x) => isNotice(x) && x.subkind === "node_retry");
  if (retry !== void 0 && retryLetter !== void 0) {
    const waitKey = String(retry.wait_key ?? "");
    if (waitKey.length === 0) return { kind: "retry-invalid" };
    const retryJobId = typeof retryLetter.job_id === "number" ? retryLetter.job_id : typeof body?.job_id === "number" ? body.job_id : void 0;
    return {
      kind: "node-retry",
      waitKey,
      feedback: String(retry.feedback ?? ""),
      attempt: Number(retry.attempt ?? 1) || 1,
      actorName: String(retry.actor_name ?? ""),
      ...retryJobId !== void 0 ? { jobId: retryJobId } : {}
    };
  }
  const interjection = isObj(body?.interjection) ? body.interjection : void 0;
  const interLetter = letters.find((x) => isNotice(x) && x.subkind === "user_interjection");
  if (interjection !== void 0 && interLetter !== void 0) {
    const mainSid = typeof interjection.mainSid === "string" ? interjection.mainSid : "";
    if (mainSid.length === 0) return { kind: "interjection-invalid" };
    return { kind: "interjection", mainSid, text: String(interLetter.payload ?? "") };
  }
  const brief = isObj(body?.brief) ? body.brief : void 0;
  const letter = letters.find((x) => isContext(x));
  if (brief === void 0 || letter === void 0) {
    return { kind: "letters-only", count: letters.length };
  }
  const ref = String(brief.wait_key ?? letter.ref ?? "");
  if (ref.length === 0) return { kind: "brief-invalid" };
  const jobId = typeof letter.job_id === "number" ? letter.job_id : -1;
  if (String(brief.source ?? "") === "main") return { kind: "brief-main", ref, jobId, brief };
  if (brief.source !== void 0) return { kind: "brief-actor", ref, jobId, brief };
  return { kind: "brief-human", ref, jobId, brief };
}

// host/events/mailbox-push.ts
async function ensureSeatLive(ctx, sessionsStore, sid, logTag) {
  const existing = sessionsStore?.get(SessionId(sid));
  if (existing !== void 0) return existing;
  const hydrated = await ensureSessionLive(ctx, SessionId(sid), "mailbox-push", sessionsStore);
  console.log(`[femo-plugin] mailbox-push: seat \u62C9\u6D3B (${logTag}) sid=\u2026${sid.slice(-12)} => ${hydrated !== void 0 ? "\u6210\u529F" : "\u5931\u8D25"}`);
  return hydrated;
}
function runTurnOnSession(ctx, resolved, bridge, projections, recordError, opts) {
  const { session, brief, mirror, jobId, ref, soul, sid, errorCode, errorPrefix } = opts;
  const nodeName = typeof brief.node_name === "string" ? brief.node_name : void 0;
  const scopeInfo = Array.isArray(brief.scope_info) ? brief.scope_info.filter((x) => typeof x === "string") : void 0;
  if (nodeName !== void 0 && scopeInfo !== void 0) mirror.nodeScopes.set(nodeName, scopeInfo);
  noteMainActor(sid, actorNameOf(brief));
  void putJobCastEntry(resolved.femoRoot, jobId, soul, sid, hostAddr()).catch((error) => {
    console.log(`[femo-plugin] cast \u767B\u8BB0 ${soul} \u5931\u8D25 (job=${jobId}): ${String(error)}`);
  });
  void runMainModelTurn(ctx, resolved, bridge, session, brief, recordError, projections, mirror.nodeScopes, mirror.nodeShowprompts, jobId).catch((error) => {
    recordError(session.id, `${errorPrefix}\uFF1A${String(error)}`);
    void sendActorFailure(bridge, jobId, ref, errorCode, String(error)).catch(() => void 0);
  });
}
async function handlePush(ctx, deps, body) {
  const { resolved, bridge, runState, projections, sessionsStore, defaultModel, recordError } = deps;
  const d = decidePush(body);
  switch (d.kind) {
    // ── 终局整包（bridge 侧 extra 带 outcome）→ 公共拼词 → steer 主模型 ──
    case "stop-invalid": {
      console.log(`[femo-plugin] mailbox-push: bad stop pack (outcome=${d.outcome}, jobId=${String(d.jobId)})`);
      return;
    }
    case "stop": {
      const mirror = runState.jobs.get(d.jobId);
      if (mirror === void 0) {
        console.log(`[femo-plugin] mailbox-push: stop pack for unknown job ${d.jobId} (letters dropped)`);
        return;
      }
      steerMainAgent(ctx, mirror.ownerSid, formatStopNotice({
        jobId: d.jobId,
        outcome: d.outcome,
        ...d.detail !== void 0 ? { detail: d.detail } : {},
        letters: d.letters
      }));
      return;
    }
    // ── 启动运行/续跑信（十连裁④）：收信即 steer 通知全文，一次启动运行恰一封 ──
    case "play-start": {
      const mirror = d.jobId === void 0 ? void 0 : runState.jobs.get(d.jobId);
      if (mirror === void 0) {
        console.log(`[femo-plugin] mailbox-push: play_start letter without mirror (job=${String(d.jobId)})`);
        return;
      }
      steerMainAgent(ctx, mirror.ownerSid, d.text);
      return;
    }
    // ── 重试牌信（十连裁③）：按 wait_key 交停靠经纪人（信是唯一传话通道）──
    case "retry-invalid": {
      console.log("[femo-plugin] mailbox-push: node_retry without wait_key (dropped)");
      return;
    }
    case "node-retry": {
      broker.deliverRetry(d.waitKey, d.feedback, d.attempt, d.actorName);
      return;
    }
    // ── 人类插话信（十连裁⑨）：source=user 真人消息直达主模型 ──────────
    case "interjection-invalid": {
      console.log("[femo-plugin] mailbox-push: user interjection without mainSid (dropped)");
      return;
    }
    case "interjection": {
      followupMain(ctx, d.mainSid, d.text);
      return;
    }
    // ── 料包信三路（【十连裁② 单通道】无簿无兜底：一封信一次投递）──────
    case "brief-invalid": {
      console.log("[femo-plugin] mailbox-push: brief without wait_key (dropped)");
      return;
    }
    case "brief-main":
    case "brief-actor":
    case "brief-human": {
      let mirror = runState.jobs.get(d.jobId);
      if (mirror === void 0 && d.kind === "brief-actor") {
        const adoptSoul = soulIdentityOf(d.brief) || actorNameOf(d.brief);
        const adoptEntry = adoptSoul.length > 0 ? (await readJobCast(resolved.femoRoot, d.jobId))[adoptSoul] : void 0;
        const fail = async (reason, code) => {
          void sendActorFailure(bridge, d.jobId, d.ref, code, reason).catch(() => void 0);
          console.log(`[femo-plugin] mailbox-push: adopt failed job=${d.jobId}: ${reason}`);
        };
        if (adoptEntry === void 0) {
          await fail(`\u672C\u6B21\u7ED1\u5B9A\u8D26\u67E5\u65E0 "${adoptSoul}" \u7684\u5EA7\u4F4D`, "cast_seat_missing");
          return;
        }
        if (adoptEntry.host !== hostAddr()) {
          await fail(`\u89D2\u8272\u7ED1\u5728\u522B\u7684\u5BBF\u4E3B\uFF08${adoptEntry.host}\uFF09\uFF0C\u672C\u5BBF\u4E3B\u4E0D\u8BE5\u6536\u5230\u8FD9\u5C01\u4FE1`, "cast_host_foreign");
          return;
        }
        if (await ensureSeatLive(ctx, sessionsStore, adoptEntry.sid, `job=${d.jobId}`) === void 0) {
          await fail(`\u7ED1\u5B9A\u7684\u4F1A\u8BDD ${adoptEntry.sid} \u62C9\u6D3B\u5931\u8D25\uFF08\u5B98\u65B9 resume \u4E0D\u53EF\u7528\uFF09`, "cast_session_hydrate_failed");
          return;
        }
        jobMirrorPrearm2(runState, d.jobId, SessionId(adoptEntry.sid));
        mirror = runState.jobs.get(d.jobId);
        console.log(`[femo-plugin] mailbox-push: adopted foreign job ${d.jobId} (soul=${adoptSoul}, \u672C\u5C0A sid=\u2026${adoptEntry.sid.slice(-12)})`);
      }
      if (mirror === void 0) {
        console.log(`[femo-plugin] mailbox-push: brief for unknown job ${d.jobId} (ref=${d.ref.slice(0, 24)})`);
        return;
      }
      const session = sessionsStore?.get(SessionId(mirror.ownerSid));
      if (session === void 0) {
        recordError(SessionId(mirror.ownerSid), "\u9A7F\u7AD9\u4FE1\u4EF6\u65E0\u6CD5\u6295\u9012\uFF1A\u4E3B\u4F1A\u8BDD\u4E0D\u5728 store\uFF08\u5BBF\u4E3B\u91CD\u542F\u7A84\u7A97\u53E3\uFF09");
        console.log(`[femo-plugin] mailbox-push: session ${mirror.ownerSid} not in store; no fallback since \u5355\u901A\u9053 (2026-09-23)`);
        return;
      }
      if (d.kind === "brief-main") {
        runTurnOnSession(ctx, resolved, bridge, projections, recordError, {
          session,
          brief: d.brief,
          mirror,
          jobId: d.jobId,
          ref: d.ref,
          soul: "main",
          sid: mirror.ownerSid,
          errorCode: "main_executor_error",
          errorPrefix: "\u4E3B\u6A21\u578B\u53C2\u4E0E\u8FD0\u884C\u6CE8\u5165\u5931\u8D25"
        });
        return;
      }
      if (d.kind === "brief-actor") {
        const brief = d.brief;
        const castSoul = soulIdentityOf(brief) || actorNameOf(brief);
        const boundEntry = castSoul.length > 0 ? (await readJobCast(resolved.femoRoot, d.jobId))[castSoul] : void 0;
        const boundSid = boundEntry?.sid;
        if (boundSid !== void 0 && !boundSid.startsWith("femo-actor-")) {
          if (boundEntry.host !== void 0 && boundEntry.host !== "" && boundEntry.host !== hostAddr()) {
            console.log(`[femo-plugin] mailbox-push: role "${castSoul}" bound to foreign host ${boundEntry.host} -- letter stays in mailbox for self-pickup`);
            return;
          }
          const liveSession = await ensureSeatLive(ctx, sessionsStore, boundSid, "\u672C\u5C0A\u5206\u652F");
          if (liveSession === void 0) {
            void sendActorFailure(bridge, d.jobId, d.ref, "cast_session_hydrate_failed", `bound session ${boundSid} hydrate failed`).catch(() => void 0);
            return;
          }
          runTurnOnSession(ctx, resolved, bridge, projections, recordError, {
            session: liveSession,
            brief,
            mirror,
            jobId: d.jobId,
            ref: d.ref,
            soul: castSoul,
            sid: boundSid,
            errorCode: "session_actor_error",
            errorPrefix: "\u4F1A\u8BDD\u89D2\u8272\u6CE8\u5165\u5931\u8D25"
          });
          return;
        }
        dispatchActorTurn(ctx, resolved, bridge, session, d.brief, recordError, defaultModel, mirror, projections, d.jobId);
        return;
      }
      applyHumanWait(ctx, runState, session, projections, broker, mirror, d.brief);
      return;
    }
    // ── 无 actionable 面单（登记即可；信已回执清账）────────────────────
    case "letters-only":
      return;
  }
}
async function startMailboxPushListener(ctx, deps) {
  const basePort = Number(process.env.FEMO_PUSH_PORT ?? "3895");
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = basePort + attempt;
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/femo-plugin/mailbox-push" || req.method !== "POST") {
        writeJson(res, 404, { ok: false, error: "not found" });
        return;
      }
      void readBody(req).then((body) => {
        return handlePush(ctx, deps, body ?? {});
      }).then(() => {
        writeJson(res, 200, { ok: true });
      }).catch((error) => {
        console.log(`[femo-plugin] mailbox-push handler failed: ${String(error instanceof Error ? error.message : error)}`);
        writeJson(res, 200, { ok: true });
      });
    });
    const ok = await new Promise((resolve2) => {
      server.once("error", () => resolve2(false));
      server.listen(port, "127.0.0.1", () => resolve2(true));
    });
    if (!ok) continue;
    console.log(`[femo-plugin] mailbox push listener: http://127.0.0.1:${port}/femo-plugin/mailbox-push`);
    ctx.effect(() => () => {
      server.close();
    }, "femo-plugin: mailbox push listener");
    return { port };
  }
  console.log(`[femo-plugin] mailbox push listener: no free port from ${basePort}; courier falls back to pickup mode`);
  return void 0;
}

// host/tools.ts
function specToSchema(name2, possess = false) {
  const spec = buildToolSpecs({ host: "dsh", possess }).find((s) => s.name === name2);
  if (spec === void 0) throw new Error(`tool spec missing: ${name2}`);
  return {
    name: spec.name.replace(/_/g, "-"),
    description: spec.description,
    parameters: {
      type: "object",
      properties: spec.parameters.properties,
      ...spec.parameters.required !== void 0 ? { required: spec.parameters.required } : {},
      additionalProperties: false
    }
  };
}
var mountTool = specToSchema("femo_mount");
var runTool = specToSchema("femo_run");
var debugTool = specToSchema("femo_debug");
var viewScriptTool = specToSchema("femo_script");
var soulTool = specToSchema("femo_soul");
var chronicaTool = specToSchema("femo_chronica");
var possessTool = specToSchema("femo_possess", true);
function callerSessionId(deps, agent) {
  if (agent === void 0 || !deps.isFemoMainSession(agent)) return null;
  return String(agent.session.id);
}
function registerFemoTools(ctx, deps, projections) {
  const tools = ctx.tools;
  if (tools === void 0) {
    console.log("[femo-plugin] tools service unavailable; femo-mount/femo-run/femo-script not registered");
    return () => void 0;
  }
  const disposers = [];
  const register = (schema, run, renderText) => {
    const dispose = tools.register({
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => [{
          type: "text",
          text: value.ok === true ? renderText !== void 0 ? renderText(value) : JSON.stringify(value) : `\u274C ${value.error ?? "\u672A\u77E5\u9519\u8BEF"}`
        }]
      },
      execute: async (args, exec) => {
        const sid = callerSessionId(deps, exec.agent);
        if (sid === null) {
          return { ok: false, error: "\u8BE5\u5DE5\u5177\u4EC5 Femo \u4E3B\u4F1A\u8BDD\u53EF\u7528\uFF08\u89D2\u8272/\u5B50\u4EE3\u7406\u4E0D\u53EF\u8C03\u7528\uFF09" };
        }
        try {
          return await run(args ?? {}, exec.agent, { signal: exec.signal });
        } catch (error) {
          return { ok: false, error: String(error instanceof Error ? error.message : error) };
        }
      }
    });
    disposers.push(dispose);
    console.log(`[femo-plugin] tool registered: ${schema.name}`);
  };
  register(mountTool, async (args, agent) => {
    const scriptPath = typeof args.script_path === "string" && args.script_path.trim().length > 0 ? args.script_path.trim() : "";
    if (scriptPath.length === 0) {
      return { ok: false, error: "script_path \u662F\u5FC5\u586B\u53C2\u6570" };
    }
    await deps.mountScript(String(agent.session.id), scriptPath, rosterNameOfSession(agent.session));
    const editorErrors = deps.takeEditorErrors?.(String(agent.session.id)) ?? [];
    return { ok: true, mounted: scriptPath, ...editorErrors.length > 0 ? { editor_errors: editorErrors } : {} };
  });
  register(runTool, async (args, agent) => {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (action !== "fresh_start" && action !== "pause" && action !== "resume" && action !== "list_jobs") {
      return { ok: false, error: "action \u662F\u5FC5\u586B\u53C2\u6570\uFF1Afresh_start / pause / resume / list_jobs \u56DB\u9009\u4E00" };
    }
    const sid = String(agent.session.id);
    const jobIdArg = typeof args.job_id === "number" && Number.isFinite(args.job_id) ? Math.trunc(args.job_id) : void 0;
    switch (action) {
      case "fresh_start": {
        const result = await deps.startJob(sid, "fresh");
        if (result.ok !== true) {
          return { ok: false, error: result.error };
        }
        return {
          ok: true,
          action,
          job_id: result.jobId,
          ...result.warnings !== void 0 && result.warnings.length > 0 ? { warnings: result.warnings } : {},
          note: `\u5DF2\u4ECE\u5934\u5F00\u59CB\u8FD0\u884CFEMO\u811A\u672C\uFF08Job ${result.jobId}\uFF09${result.note ? `\uFF1B${result.note}` : ""}`
        };
      }
      case "pause": {
        const result = await deps.pauseScript(sid, jobIdArg);
        if (result.paused !== true) {
          return {
            ok: true,
            action,
            ...jobIdArg !== void 0 ? { note: result.state !== void 0 ? `Job ${jobIdArg} \u5F53\u524D\u72B6\u6001\u4E3A ${result.state}\uFF08\u975E running\uFF09\uFF0C\u65E0\u9700\u6682\u505C` : `Job ${jobIdArg} \u4E0D\u5B58\u5728\uFF08\u5F15\u64CE\u65E0\u6B64\u6863\u6848\uFF09\uFF1B\u53EF\u7528 list_jobs \u67E5\u8BE2\u5168\u90E8 Job` } : { note: "\u5F53\u524D\u65E0\u6D3B\u8DC3 job\uFF0C\u5F15\u64CE\u4E0D\u77E5\u9053\u4F60\u8981\u6302\u8D77\u54EA\u4E2A\u3002\u5982\u679C\u9700\u8981\u5F3A\u5236\u505C\u6B62\u67D0 job\uFF0C\u8BF7\u5E26 job_id\uFF08\u53EF\u5148 list_jobs \u67E5\u8BE2\uFF09" }
          };
        }
        return {
          ok: true,
          action,
          ...result.jobId !== void 0 ? { job_id: result.jobId } : {},
          note: `\u5DF2\u6682\u505C\u6302\u8D77\uFF08${result.jobId !== void 0 ? `Job ${result.jobId}\uFF0C` : ""}\u65AD\u70B9\u4FDD\u7559\uFF0C\u53EF resume \u7EED\u8DD1\uFF09`
        };
      }
      case "resume": {
        if (jobIdArg === void 0) {
          return { ok: false, error: "resume \u5FC5\u987B\u6307\u5B9A job_id\uFF1A\u5148 list_jobs \u67E5\u8BE2\u672C\u4F1A\u8BDD\u6302\u8D77\u7684 Job\uFF0C\u518D\u5E26 job_id \u7EED\u8DD1" };
        }
        const result = await deps.startJob(sid, "resume", jobIdArg);
        if (result.ok !== true) {
          return { ok: false, error: result.error };
        }
        return {
          ok: true,
          action,
          job_id: result.jobId,
          ...result.warnings !== void 0 && result.warnings.length > 0 ? { warnings: result.warnings } : {},
          note: `\u5DF2\u4ECE\u6302\u8D77\u5904\u7EED\u8DD1\uFF08Job ${result.jobId}\uFF09`
        };
      }
      case "list_jobs": {
        const jobs = await deps.listJobs();
        return { ok: true, action, jobs };
      }
    }
  });
  register(debugTool, async (args, agent, exec) => {
    const result = await deps.debugRun(String(agent.session.id), {
      runs: typeof args.runs === "number" ? args.runs : void 0,
      ...typeof args.seed === "number" ? { seed: args.seed } : {},
      ...typeof args.module === "string" && args.module.trim().length > 0 ? { module: args.module } : {},
      signal: exec.signal
    });
    const verdict = debugRunToolOutcome(result);
    if (verdict.ok !== true) {
      return { ok: false, error: verdict.error };
    }
    return {
      ok: true,
      runs: result.runs,
      ...result.seed !== void 0 ? { seed: result.seed } : {},
      exit_code: result.exitCode,
      timed_out: result.timedOut,
      // 墙钟耗时（多轮线性叠加）：模型下次自己掂量轮数用。
      elapsed_ms: result.elapsedMs,
      outcomes: result.report?.runs.map((r) => r.outcome) ?? [],
      log_path: result.logPath,
      // 被中断但有流水时的可读留档（框架会丢掉 aborted 的工具结果，靠它捞回）。
      ...result.partialPath !== void 0 ? { partial_path: result.partialPath } : {},
      // text 已含流水 + 终报 + 落盘路径：render 原样上屏，UI/其他消费方也能取全文。
      text: verdict.text
    };
  }, (value) => value.text ?? JSON.stringify(value));
  register(viewScriptTool, async (_args, agent) => {
    const record = await deps.readScript(String(agent.session.id));
    if (record === void 0) {
      return { ok: false, error: "\u4F1A\u8BDD\u672A\u6302\u8F7DFEMO\u811A\u672C\uFF1A\u8BF7\u5148 femo-mount \u6302\u8F7D\uFF0C\u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165FEMO\u811A\u672C" };
    }
    return {
      ok: true,
      source: record.path !== void 0 ? "file" : "session-text",
      ...record.path !== void 0 ? { path: record.path } : {},
      lines: record.finalText.split("\n").length,
      script: record.finalText
    };
  }, (value) => {
    const head = `\u{1F4DC} \u6302\u8F7DFEMO\u811A\u672C\uFF08${value.source ?? ""}${value.path !== void 0 ? `: ${value.path}` : ""}\uFF0C${value.lines ?? "?"} \u884C\uFF09`;
    return `${head}

${value.script ?? ""}`;
  });
  register(soulTool, async (args) => {
    if (args.action === "list") {
      const { souls } = await deps.soulList();
      return { ok: true, souls };
    }
    if (args.action === "create") {
      const invalid = validateSoulCreate(args);
      if (invalid !== null) {
        return { ok: false, error: invalid };
      }
      await deps.soulCreate(String(args.soul_id).trim(), String(args.soul_name).trim(), String(args.description));
      return { ok: true, note: `\u5DF2\u521B\u5EFA\u89D2\u8272 ${String(args.soul_name).trim()}\uFF08soul_id=${String(args.soul_id).trim()}\uFF0C\u811A\u672C\u91CC\u7528 soul:${String(args.soul_id).trim()} \u5F15\u7528\uFF09` };
    }
    return { ok: false, error: "action \u5FC5\u586B\uFF1Alist \u6216 create \u4E8C\u9009\u4E00" };
  }, (value) => {
    if (value.note !== void 0) return value.note;
    if (Array.isArray(value.souls)) {
      if (value.souls.length === 0) return "\u89D2\u8272\u5E93\u4E3A\u7A7A";
      return `\u{1F3AD} \u89D2\u8272\u5E93\uFF08${value.souls.length} \u4E2A\u89D2\u8272\uFF09\uFF1A
` + value.souls.map((s) => `- ${s.soul_id}\uFF08${s.soul_name}\uFF09`).join("\n");
    }
    return JSON.stringify(value);
  });
  register(chronicaTool, async (args) => {
    const opts = normalizeChronicaOpts(args);
    const output = await deps.chronicaQuery(opts);
    return {
      ok: true,
      ...opts.show !== void 0 ? { show: opts.show } : {},
      ...opts.list !== void 0 ? { list: opts.list } : {},
      ...opts.scope !== void 0 ? { scope: opts.scope } : {},
      ...opts.full !== void 0 ? { full: opts.full } : {},
      output
    };
  }, (value) => value.output ?? JSON.stringify(value));
  let possessCallerSid;
  const possessImpls = createBridgeToolImpls({
    ensureBridge: async () => {
    },
    send: (cmd, args, timeoutMs) => deps.bridgeSend(cmd, args, timeoutMs),
    femoRoot: deps.femoRoot,
    host: "dsh",
    hostRef: hostAddr(),
    spawnPython: async () => {
      throw new Error("dsh \u672A\u542F\u7528\u603B\u7EB2 spawn \u8DEF\u5F84\uFF08femo_possess \u4E0D\u7ECF\u8FC7\u5B83\uFF09");
    },
    debugSpawnProc: void 0,
    possess: {
      selfSid: () => possessCallerSid,
      running: () => possessCallerSid !== void 0 && deps.sessionBusy(possessCallerSid)
    }
  });
  register(possessTool, async (args, agent) => {
    const sid = callerSessionId(deps, agent);
    if (sid === null) return { ok: false, error: "femo-possess \u4EC5\u4E3B\u4F1A\u8BDD\u53EF\u7528" };
    possessCallerSid = sid;
    try {
      const v = await possessImpls.femo_possess(args);
      if (v.error !== void 0) return { ok: false, error: v.error };
      return { ok: true, ...v.result ?? {}, ...v.note !== void 0 ? { note: v.note } : {} };
    } finally {
      possessCallerSid = void 0;
    }
  }, (value) => value.note ?? JSON.stringify(value));
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
      }
    }
    disposers.length = 0;
  };
}

// host/preset-install.ts
var import_yaml = __toESM(require_dist(), 1);
import { existsSync as existsSync6, mkdirSync as mkdirSync4, readFileSync as readFileSync7, writeFileSync as writeFileSync3 } from "node:fs";
import { homedir } from "node:os";
import { join as join17 } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";

// ../../femo2host/host/skill-expand.mjs
import { readFileSync as readFileSync6 } from "node:fs";
import { join as join16 } from "node:path";
function expandSkillTemplate(text, femoRoot2, host, { onMissing } = {}) {
  const root = String(femoRoot2).replace(/[\\/]+$/, "");
  const re = /^[ ]*\{\{INCLUDE:([^}]+)\}\}/gm;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index);
    last = m.index + m[0].length;
    const indent = m[0].slice(0, m[0].indexOf("{{"));
    try {
      const body = readFileSync6(join16(root, m[1].trim()), "utf8").replace(/\r\n/g, "\n");
      out += body.split("\n").map((l) => l.length > 0 ? indent + l : l).join("\n");
    } catch {
      out += m[0];
      try {
        onMissing?.(m[1].trim());
      } catch {
      }
    }
  }
  out += text.slice(last);
  return out.replaceAll("{FEMO_ROOT}", root).replaceAll("{HOST}", host);
}

// host/preset-install.ts
var PRESET_NAME = "femo-plugin";
var PRESET_FILES = ["preset.yml", "agent.cordis.yml"];
function dshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  return fromEnv || join17(homedir(), ".dsh");
}
function expandCommon(text, femoRoot2, hostName) {
  return expandSkillTemplate(text, femoRoot2, hostName);
}
function installFemoPreset(femoRoot2) {
  const bundledDir = fileURLToPath4(new URL("../preset/", import.meta.url));
  const targetDir = join17(dshHome(), ".agent-presets", PRESET_NAME);
  const root = femoRoot2.replace(/[\\/]+$/, "");
  let result = "up-to-date";
  const errors = [];
  const existed = existsSync6(join17(targetDir, "preset.yml"));
  for (const file of PRESET_FILES) {
    try {
      const raw = readFileSync7(join17(bundledDir, file), "utf8");
      let desired = root.length > 0 ? expandCommon(raw, root, "dsh") : raw;
      const target = join17(targetDir, file);
      const same = existsSync6(target) && readFileSync7(target, "utf8") === desired;
      if (same) continue;
      mkdirSync4(targetDir, { recursive: true });
      writeFileSync3(target, desired);
      if (result === "up-to-date") result = existed ? "updated" : "installed";
    } catch (error) {
      errors.push(`${file}: ${String(error)}`);
    }
  }
  if (errors.length > 0) return `${result} with errors (${errors.join("; ")})`;
  return result;
}
function expandDeep(value, root) {
  if (typeof value === "string") {
    return root.length > 0 ? expandCommon(value, root, "dsh") : value;
  }
  if (Array.isArray(value)) return value.map((item) => expandDeep(item, root));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandDeep(item, root)]));
  }
  return value;
}
function readFemoPresetDefinition(femoRoot2, bundledDir = fileURLToPath4(new URL("../preset/", import.meta.url))) {
  const root = femoRoot2.replace(/[\\/]+$/, "");
  let meta;
  let plugins;
  try {
    meta = (0, import_yaml.parse)(readFileSync7(join17(bundledDir, "preset.yml"), "utf8"));
  } catch (error) {
    return `preset.yml unparsable: ${String(error)}`;
  }
  try {
    plugins = (0, import_yaml.parse)(readFileSync7(join17(bundledDir, "agent.cordis.yml"), "utf8"));
  } catch (error) {
    return `agent.cordis.yml unparsable: ${String(error)}`;
  }
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return "agent.cordis.yml is not a non-empty plugin entry list";
  }
  return {
    id: PRESET_NAME,
    ...meta?.name === void 0 ? {} : { name: meta.name },
    ...meta?.description === void 0 ? {} : { description: meta.description },
    ...meta?.order === void 0 ? {} : { order: meta.order },
    plugins: expandDeep(plugins, root)
  };
}
function declareFemoPreset(ctx, femoRoot2) {
  const inject2 = ctx.inject;
  if (typeof inject2 !== "function") {
    console.log("[femo-plugin] preset declare: ctx.inject unavailable; legacy mirror only");
    return;
  }
  inject2(["agentPresets"], (child) => {
    const registry = child.agentPresets;
    if (registry === void 0 || typeof registry.list !== "function" || typeof registry.register !== "function") {
      console.log("[femo-plugin] preset declare: agentPresets registry has no register(); legacy mirror serves this host");
      return;
    }
    let unregister;
    child.effect(() => () => {
      void unregister?.();
    }, "femo-plugin: agent preset declaration");
    void (async () => {
      try {
        const definition = readFemoPresetDefinition(femoRoot2);
        if (typeof definition === "string") {
          console.log(`[femo-plugin] preset declare skipped: ${definition}`);
          return;
        }
        const roster = await registry.list();
        if (roster.some((row) => row.id === definition.id)) {
          console.log(`[femo-plugin] preset ${definition.id} already on roster; declaration not needed`);
          return;
        }
        unregister = await registry.register(definition);
        console.log(`[femo-plugin] preset declared to agentPresets registry: ${definition.id}`);
      } catch (error) {
        console.log(`[femo-plugin] preset declare failed: ${String(error)}`);
      }
    })();
  });
}

// host/job-index.ts
async function rebuildJobIndexFromRecords(femoRoot2, runState) {
  const { readdir: readdir3 } = await import("node:fs/promises");
  const sessionsDir = draftsDirOf(femoRoot2);
  let names = [];
  try {
    names = await readdir3(sessionsDir);
  } catch {
    return;
  }
  let rebuilt = 0;
  for (const name2 of names) {
    if (!name2.endsWith(".json")) continue;
    const sid = name2.slice(0, -".json".length);
    const jobId = await readSessionCurrentJob(femoRoot2, sid);
    if (jobId !== void 0) {
      runState.sidIndex.set(sid, jobId);
      rebuilt += 1;
    }
  }
  if (rebuilt > 0) console.log(`[femo-plugin] job index rebuilt from session records: ${rebuilt} entr(y|ies)`);
}

// host/bridge-supervisor.ts
function installBridgeSupervisor(opts) {
  const { ctx, resolved, bridge, runState } = opts;
  let bridgeDisposed = false;
  let bridgeCrashStreak = 0;
  let lastCrashAt = 0;
  const pingBridgeUntilAlive = async () => {
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve2) => setTimeout(resolve2, 1e3));
      if (bridgeDisposed) return;
      try {
        await bridge.send("ping", {}, 3e3);
        console.log(`[femo-plugin] C1 self-heal: bridge respawned and ready (after ~${i + 1}s); rebuilding job index`);
        await rebuildJobIndexFromRecords(resolved.femoRoot, runState);
        return;
      } catch {
      }
    }
    console.log("[femo-plugin] C1 self-heal: bridge ping not ready after 15s; subsequent commands will surface errors if still down");
  };
  bridge.onExited = () => {
    if (runState.activeJobId !== void 0 || runState.jobs.size > 0) {
      console.log("[femo-plugin] bridge exited mid-run; clearing stale job mirrors");
      pushDiag("bridge", "exited mid-run \u2192 \u6E05\u5168\u90E8 Job \u955C\u50CF waitingHuman + activeJobId\uFF08C1 \u81EA\u6108\u5C06\u91CD\u5EFA\u7D22\u5F15\uFF09");
    }
    abortAllSubagents("bridge exited");
    broker.abortAll("bridge exited");
    for (const [jobId, mirror] of runState.jobs) {
      if (mirror.state === "running") mirror.state = "failed";
      mirror.waitingHuman = void 0;
    }
    runState.activeJobId = void 0;
    for (const mirror of runState.jobs.values()) {
      broadcastProjectionState(runState, mirror.ownerSid);
    }
    void rebuildJobIndexFromRecords(resolved.femoRoot, runState);
    if (bridgeDisposed) return;
    const now = Date.now();
    bridgeCrashStreak = now - lastCrashAt < 3e4 ? bridgeCrashStreak + 1 : 1;
    lastCrashAt = now;
    if (bridgeCrashStreak >= 3) {
      console.log("[femo-plugin] C1 self-heal: bridge crashed 3x within 30s; auto-respawn disabled (needs manual restart)");
      return;
    }
    setTimeout(() => {
      if (bridgeDisposed) return;
      console.log(`[femo-plugin] C1 self-heal: respawning bridge (crash streak=${bridgeCrashStreak})`);
      bridge.start(ctx, resolved);
      void pingBridgeUntilAlive();
    }, 3e3);
  };
  return {
    markDisposed: () => {
      bridgeDisposed = true;
    }
  };
}

// host/tool-deps.ts
function createFemoToolDeps(deps) {
  const { ctx, resolved, bridge, runState, sessionsStore, projections, recordError } = deps;
  const resolveMounted = async (sessionId) => {
    const sid = SessionId(sessionId);
    const session = sessionsStore?.get(sid);
    if (session === void 0) {
      throw new Error(`\u4F1A\u8BDD ${sessionId} \u4E0D\u5B58\u5728`);
    }
    assertRunAllowed(runState, sessionId);
    const scriptText = await readSessionScriptText(resolved.femoRoot, sessionId);
    if (scriptText === void 0) {
      throw new Error("\u4F1A\u8BDD\u672A\u6302\u8F7DFEMO\u811A\u672C\uFF1A\u8BF7\u5148 femo-mount \u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165FEMO\u811A\u672C");
    }
    const prev = await readSessionScript(resolved.femoRoot, sessionId);
    const effectivePath = prev?.path;
    const baseDir = effectivePath !== void 0 ? effectivePath.replace(/[\\/][^\\/]*$/, "") : "";
    try {
      await bridge.send("check", { femo: scriptText, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 3e4);
    } catch (error) {
      throw new Error(`FEMO\u811A\u672C\u7F16\u8BD1\u5931\u8D25\uFF1A${String(error instanceof Error ? error.message : error)}`);
    }
    return { sid, scriptText, effectivePath };
  };
  return {
    // editor_errors 回传：只取编辑器来源（带 [编辑器·] 前缀）的错误，取走即从
    // 列表删除。engine 来源的错误（flow_error / 子 agent 失败等）不带走——它们
    // 已有 steer ❌ 必达通道，不应再经工具返回体重复通知主模型。
    // errors 大列表保留供画布面板 /femo-plugin/errors GET 显示用。
    takeEditorErrors: (sessionId) => {
      const list = runState.errors.get(sessionId) ?? [];
      if (list.length === 0) return [];
      const taken = [];
      const remaining = [];
      for (const e of list) {
        if (e.text.startsWith("[\u7F16\u8F91\u5668\xB7")) {
          taken.push(e.text);
        } else {
          remaining.push(e);
        }
      }
      if (taken.length > 0) {
        runState.errors.set(sessionId, remaining);
      }
      return taken;
    },
    mountScript: async (sessionId, scriptPath, sessionName) => {
      runState.errors.delete(sessionId);
      const { readFile: readFile3 } = await import("node:fs/promises");
      let text;
      try {
        text = await readFile3(scriptPath, "utf8");
      } catch (error) {
        throw new Error(`\u65E0\u6CD5\u8BFB\u53D6\u811A\u672C\u6587\u4EF6 ${scriptPath}\uFF1A${String(error instanceof Error ? error.message : error)}`);
      }
      const baseDir = scriptPath.replace(/[\\/][^\\/]*$/, "");
      try {
        await bridge.send("check", { femo: text, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 3e4);
      } catch (error) {
        recordError(SessionId(sessionId), `[\u7F16\u8F91\u5668\xB7mount] ${String(error instanceof Error ? error.message : error)}`);
      }
      await writeSessionScript(resolved.femoRoot, sessionId, { path: scriptPath, text });
      try {
        upsertMountRecord(
          {
            host: process.env.FEMO_HOST_NAME || "dsh",
            session: sessionId,
            ...sessionName ? { sessionName } : {},
            scriptPath
          },
          mountLedgerPath(resolved.femoRoot)
        );
      } catch (error) {
        console.log(`[femo-plugin] mount ledger write failed: ${String(error instanceof Error ? error.message : error)}`);
      }
      await rememberFemoFile(resolved.femoRoot, scriptPath, "import");
      console.log(`[femo-plugin] femo-mount ${sessionId} <- ${scriptPath}`);
      broadcastSse("script_changed", { sessionId });
    },
    startJob: async (sessionId, mode, jobId) => {
      const { sid, scriptText, effectivePath } = await resolveMounted(sessionId);
      if (mode === "fresh") {
        let note;
        try {
          const oldJobId = await readSessionCurrentJob(resolved.femoRoot, sessionId);
          if (oldJobId !== void 0) {
            const st = await bridge.send("get_job_state", { job_id: oldJobId }, 15e3);
            if (st?.state === "suspended") {
              note = `\u4E0A\u4E00\u6B21 Job ${oldJobId} \u5DF2\u6302\u8D77\u5B58\u6863\uFF0C\u53EF femo-run resume + job_id \u6216 list_jobs \u627E\u56DE`;
            }
          }
        } catch {
        }
        const warnings2 = await startJobOnSession(ctx, resolved, bridge, runState, sid, scriptText, effectivePath, true, void 0, projections);
        const activeId2 = runState.activeJobId;
        return { ok: true, jobId: activeId2 ?? -1, ...note !== void 0 ? { note } : {}, ...warnings2.length > 0 ? { warnings: warnings2 } : {} };
      }
      const warnings = await startJobOnSession(ctx, resolved, bridge, runState, sid, scriptText, effectivePath, false, jobId, projections);
      const activeId = runState.activeJobId;
      return { ok: true, jobId: activeId ?? jobId ?? -1, ...warnings.length > 0 ? { warnings } : {} };
    },
    pauseScript: async (sessionId, jobId) => {
      const out = await pauseJobResolved(bridge, runState, sessionId, jobId);
      if (out.kind === "no-such-job") {
        console.log(`[femo-plugin] femo-run pause (explicit) ${sessionId} job=${String(jobId)} -> no_such_job`);
        return { paused: false, jobId };
      }
      if (out.kind === "not-owner") {
        throw new Error(`Job ${jobId} \u4E0D\u5C5E\u4E8E\u4F1A\u8BDD ${sessionId}\uFF08\u5F52\u5C5E ${out.ownerShow}\uFF09\uFF0C\u62D2\u7EDD\u6682\u505C`);
      }
      if (out.kind === "idle") {
        console.log(`[femo-plugin] femo-run pause (explicit) ${sessionId} job=${String(out.jobId)} -> idle state=${out.state}`);
        return { paused: false, state: out.state, jobId: out.jobId };
      }
      if (out.kind === "none") {
        console.log(`[femo-plugin] femo-run pause ${sessionId} -> no running job (mirror=${String(out.mirrorJobId ?? "-")}, active=${String(out.activeJobId ?? "-")})`);
        return { paused: false };
      }
      console.log(`[femo-plugin] femo-run pause ${sessionId} job=${String(out.jobId)} -> paused=${out.paused} state=${String(out.state ?? "-")}`);
      return { paused: out.paused, state: out.state, jobId: out.jobId };
    },
    listJobs: async () => {
      const result = await bridge.send("list_jobs", {}, 15e3);
      return result?.jobs ?? [];
    },
    // 【2026-09-19 取消限制】femo 工具的调用者校验放宽为「主会话本体」：
    // 非 FEMO 会话的主模型也能 mount/run 自己的脚本；角色子代理
    // （parentSession 在场）仍被拒——工具面的角色噪音过滤不放松。
    isFemoMainSession: (agent) => agent.session.header.parentSession === void 0,
    // ── 附身工具（femo_possess，2026-09-25 接总纲收编版）──────────────────
    // 执行体在总纲（tools-core createBridgeToolImpls），dsh 只注入 IO 三件：
    // 桥命令直通、引擎根、运行态（本会话有 running Job=启动运行锁冻结绑定）。
    femoRoot: resolved.femoRoot,
    bridgeSend: (cmd, args, timeoutMs) => bridge.send(cmd, args ?? {}, timeoutMs ?? 15e3),
    sessionBusy: (sessionId) => {
      for (const mirror of runState.jobs.values()) {
        if (mirror.ownerSid === sessionId && mirror.state === "running") return true;
      }
      return false;
    },
    soulList: async () => {
      const result = await bridge.send("list_souls", {}, 15e3);
      return { souls: result?.souls ?? [] };
    },
    soulCreate: async (soulId, soulName, description) => {
      return bridge.send("create_soul", { soul_id: soulId, soul_name: soulName, description, user_id: "u001" }, 15e3);
    },
    readScript: async (sessionId) => {
      const record = await readSessionScript(resolved.femoRoot, sessionId);
      if (record === void 0) return void 0;
      const finalText = await readSessionScriptText(resolved.femoRoot, sessionId);
      if (finalText === void 0) return void 0;
      return { path: record.path, text: record.text, finalText };
    },
    debugRun: async (sessionId, opts) => {
      const scriptText = await readSessionScriptText(resolved.femoRoot, sessionId);
      if (scriptText === void 0) {
        throw new Error("\u4F1A\u8BDD\u672A\u6302\u8F7DFEMO\u811A\u672C\uFF1A\u8BF7\u5148 femo-mount \u6302\u8F7D\uFF0C\u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165FEMO\u811A\u672C");
      }
      const prev = await readSessionScript(resolved.femoRoot, sessionId);
      const started = Date.now();
      const result = await collectDebugRun2(ctx, resolved, {
        femo: scriptText,
        ...prev?.path !== void 0 ? { scriptPath: prev.path } : {},
        ...opts.module !== void 0 && opts.module.length > 0 ? { module: opts.module } : {},
        ...opts.runs !== void 0 ? { runs: opts.runs } : {},
        ...opts.seed !== void 0 ? { seed: opts.seed } : {}
      }, opts.signal);
      console.log(`[femo-plugin] femo-debug ${sessionId} \u2192 exit=${result.exitCode} records=${result.records.length} report=${result.report !== void 0} timedOut=${result.timedOut}${opts.module !== void 0 && opts.module.length > 0 ? ` module=${opts.module}` : ""}\uFF08${Date.now() - started}ms\uFF09`);
      return result;
    },
    chronicaQuery: async (opts) => {
      const args = chronicaCliArgs(opts);
      const subprocess = ctx.get("subprocess");
      if (subprocess === void 0) {
        throw new Error("subprocess \u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u65E0\u6CD5\u89E3\u6790 python \u53EF\u6267\u884C\u6587\u4EF6\uFF09");
      }
      const pythonPath = await subprocess.resolveExecutable(resolved.python);
      const [{ execFile }, { promisify }, { join: join19 }] = await Promise.all([
        import("node:child_process"),
        import("node:util"),
        import("node:path")
      ]);
      try {
        const { stdout } = await promisify(execFile)(
          pythonPath,
          [join19(resolved.femoRoot, "femo2host", "femoToolcall", "chronica.py"), ...args],
          {
            timeout: 15e3,
            maxBuffer: 32 * 1024 * 1024,
            encoding: "utf8",
            env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
          }
        );
        return stdout;
      } catch (error) {
        const err = error;
        if (err.killed === true) throw new Error("chronica.py \u67E5\u8BE2\u8D85\u65F6\uFF0815s\uFF09");
        const stderr = typeof err.stderr === "string" && err.stderr.length > 0 ? err.stderr : String(err.message ?? "");
        throw new Error(`chronica.py \u67E5\u8BE2\u5931\u8D25\uFF08\u9000\u51FA\u7801 ${String(err.code ?? "?")}\uFF09\uFF1A${stderr.slice(-800)}`);
      }
    }
  };
}

// host/index.ts
var name = "femo-plugin";
var inject = ["agents", "sessions", "agentDefaultModel", "tools", "webServer"];
async function apply(ctx, config) {
  const resolved = resolveConfig(config);
  if (!resolved.enabled) {
    console.log("[femo-plugin] disabled by config");
    return;
  }
  console.log(`[femo-plugin] preset install: ${installFemoPreset(resolved.femoRoot)}`);
  declareFemoPreset(ctx, resolved.femoRoot);
  const defaultModel = ctx.get("agentDefaultModel");
  const registerSessionEventType2 = registerSessionEventType;
  if (registerSessionEventType2 !== void 0) {
    ctx.effect(() => registerSessionEventType2("femo-plugin/chat"), "femo-plugin: session event type");
    ctx.effect(() => registerSessionEventType2("femo-plugin/turn-scope"), "femo-plugin: session event type (legacy turn-scope)");
  } else {
    console.log("[femo-plugin] this dsh build lacks registerSessionEventType; loading history of femo-plugin sessions is unsupported here (see README)");
  }
  process.on("uncaughtException", (error) => {
    console.log(`[femo-plugin] uncaughtException: ${String(error?.stack ?? error)}`);
  });
  process.on("unhandledRejection", (reason) => {
    console.log(`[femo-plugin] unhandledRejection: ${String(reason instanceof Error ? reason.stack : reason)}`);
  });
  let heartbeatLast = Date.now();
  const HEARTBEAT_INTERVAL = 1e3;
  setInterval(() => {
    const now = Date.now();
    const lag = now - heartbeatLast - HEARTBEAT_INTERVAL;
    heartbeatLast = now;
    if (lag > 2e3) {
      console.log(`[femo-plugin] event-loop stall: ${lag}ms behind`);
    }
  }, HEARTBEAT_INTERVAL);
  const bridge = new FemoBridge();
  bridge.emit = (name2, ...args) => {
    ;
    ctx.emit(name2, ...args);
  };
  const runState = {
    jobs: /* @__PURE__ */ new Map(),
    sidIndex: /* @__PURE__ */ new Map(),
    sessionActors: /* @__PURE__ */ new Map(),
    errors: /* @__PURE__ */ new Map()
  };
  initDiagFeed(resolved.femoRoot);
  installHostLogCapture();
  installNativeWindowing(ctx, {
    native: isNativeDshBuild(dsh_session_host_exports),
    mirrorDir: join18(packageRoot, "data", "proj-mirror")
  });
  const sessionsStore = ctx.get("sessions");
  const bridgeSupervisor = installBridgeSupervisor({ ctx, resolved, bridge, runState });
  const projections = createProjectionRegistry(ctx);
  const godMirror = createGodMirror({ mainActorSceneActor, isMainActorNotice });
  const recordError = (sessionId, text) => {
    const key = String(sessionId);
    const list = runState.errors.get(key) ?? [];
    list.push({ ts: Date.now(), text });
    if (list.length > 50) list.shift();
    runState.errors.set(key, list);
    console.log(`[femo-plugin] error on ${key}: ${text}`);
  };
  registerPersonaHooks(ctx, resolved.femoRoot);
  registerSessionRoster(ctx, resolved.femoRoot);
  registerEngineEventHandlers(ctx, {
    resolved,
    bridge,
    runState,
    sessionsStore,
    projections,
    godMirror,
    defaultModel,
    recordError,
    broker
  });
  ctx.effect(() => apiRetry2.install(ctx, {
    resolveTarget: (childId) => {
      const hit = activeChildRuns.get(childId);
      if (hit !== void 0) {
        return { kind: "subagent", mainSessionId: hit.mainSid, childSessionId: childId, node: hit.node };
      }
      if (isMainAnswerPending(childId)) {
        return { kind: "main", mainSessionId: childId, childSessionId: childId, node: pendingNodeName(childId) };
      }
      return void 0;
    },
    onRetry: (target, attempt, delayMs, failure) => {
      const delayText = delayMs <= 0 ? "\u7ACB\u5373" : `${Math.round(delayMs / 1e3)} \u79D2\u540E`;
      if (target.kind === "main") {
        console.log(`[femo-api-retry] main \u8C03\u7528\u5931\u8D25\uFF08${failure.code}\uFF09\uFF0C${delayText}\u91CD\u8BD5\uFF08\u7B2C ${attempt}/5 \u6B21\uFF09\uFF1Anode=${target.node} ${failure.message.slice(0, 200)}`);
        return;
      }
      console.log(`[femo-api-retry] \u89D2\u8272 ${target.node} \u8C03\u7528\u5931\u8D25\uFF08${failure.code}\uFF09\uFF0C${delayText}\u91CD\u8BD5\uFF08\u7B2C ${attempt}/5 \u6B21\uFF09`);
    },
    onExhausted: (target, failure) => {
      if (target.kind === "main") {
        console.log(`[femo-api-retry] main \u8FDE\u7EED 5 \u6B21 API \u5931\u8D25\uFF0C\u8282\u70B9\u300C${target.node}\u300D\u6267\u884C\u5931\u8D25\u4E0A\u62A5\u5F15\u64CE\uFF08\u672C\u6B21\u6302\u8D77\u53EF\u7EED\u8DD1\uFF09\uFF1A${failure.code} ${failure.message.slice(0, 200)}`);
        return;
      }
      const text = `\u89D2\u8272 ${target.node} \u8FDE\u7EED 5 \u6B21 API \u5931\u8D25\uFF0C\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${failure.code} ${failure.message}\uFF08\u672C\u6B21\u5C06\u6302\u8D77\uFF0C\u53EF\u70B9\u300C\u7EE7\u7EED\u300D\u91CD\u6F14\uFF09`;
      recordError(SessionId(target.mainSessionId), text);
    }
  }), "femo-plugin: api retry chain");
  ctx.effect(() => () => {
    broker.dispose();
    disposeMainDeliveries();
  }, "femo-plugin: node retry broker");
  registerRoutes(ctx, {
    resolved,
    bridge,
    runState,
    projections,
    sessionsStore,
    recordError
  });
  const pushListener = await startMailboxPushListener(ctx, {
    resolved,
    bridge,
    runState,
    projections,
    sessionsStore,
    defaultModel,
    recordError
  });
  bridge.pushPort = pushListener?.port;
  setTimeout(() => {
    bridge.start(ctx, resolved);
  }, 1e3);
  ctx.effect(() => () => {
    bridgeSupervisor.markDisposed();
    void bridge.stop();
  }, "femo-plugin: bridge lifecycle");
  ctx.effect(() => () => {
    for (const dispose of awakenedDisposers.splice(0)) {
      try {
        dispose();
      } catch {
      }
    }
    disposeProjectionWriters();
  }, "femo-plugin: awakened projection windows");
  ctx.effect(() => installPersistenceListCache(ctx), "femo-plugin: persistence list cache");
  const toolDeps = createFemoToolDeps({ ctx, resolved, bridge, runState, sessionsStore, projections, recordError });
  void rebuildJobIndexFromRecords(resolved.femoRoot, runState);
  ctx.effect(() => registerFemoTools(ctx, toolDeps, projections), "femo-plugin: main-model tools");
}
export {
  Config,
  apply,
  inject,
  name
};
//# sourceMappingURL=main.js.map
