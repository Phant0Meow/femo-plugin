// host/index.ts
import { SessionId as SessionId9 } from "@deepseek-ai/dsh-session";
import * as sessionNS from "@deepseek-ai/dsh-session";

// host/config.ts
import { fileURLToPath } from "node:url";
import { join } from "node:path";

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
var engineRoot = fileURLToPath(new URL("../../..", import.meta.url));
var hostManifestFile = join(packageRoot, "host.manifest.json");
var Config = Schema.object({
  /** Master switch. */
  enabled: Schema.boolean().default(true),
  /** Femo 引擎根目录（femoCompiler/femoBridges 所在；宿主边界层（门面 API + CLI 工具）在 femo2host/，示例剧本与 @func 伴生模块在 femoExamples/）。缺省 = 插件包根（自包含）。 */
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
   * Per-Actor tool access default. The 剧本 author decides per actor with
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

// host/bridge.ts
import { join as join3 } from "node:path";

// host/diag-feed.ts
import { appendFileSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { join as join2 } from "node:path";

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
var sseClients = /* @__PURE__ */ new Set();
function broadcastSse(eventType, data) {
  const payload = `data: ${JSON.stringify({ type: eventType, data: data ?? {} })}

`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// host/diag-feed.ts
var CAP = 800;
var ring = [];
var logFile;
function initDiagFeed(femoRoot) {
  const dir = join2(femoRoot, "cache", "logs");
  logFile = join2(dir, "debug-diag-feed.log");
  try {
    mkdirSync(dir, { recursive: true });
    if (statSync(logFile).mtimeMs < Date.now() - 3 * 864e5) unlinkSync(logFile);
  } catch {
  }
}
function pushDiag(tag, msg) {
  const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tag, msg };
  ring.push(entry);
  if (ring.length > CAP) ring.shift();
  try {
    broadcastSse("femo_diag", entry);
  } catch {
  }
  if (logFile !== void 0) {
    try {
      appendFileSync(logFile, `[${entry.ts}] [${tag}] ${msg}
`, "utf8");
    } catch {
    }
  }
}
function diagTail(n) {
  const count = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), CAP) : 300;
  return ring.slice(-count);
}

// host/bridge.ts
var FemoBridge = class {
  handle;
  pending = /* @__PURE__ */ new Map();
  nextId = 1;
  lineBuf = "";
  /** 进程退出回调（index.ts 接线）：引擎半路死亡时不会有任何终止事件
   * （flow_done/flow_paused），宿主 runState.running 会卡 true——在这里
   * 让总装层清理孤儿运行态（2026-08-24）。 */
  onExited;
  get alive() {
    return this.handle !== void 0;
  }
  /** Spawn the bridge and wire stdout line parsing. */
  start(ctx, config, attempt = 0) {
    if (this.handle !== void 0) return;
    const subprocess = ctx.get("subprocess");
    if (subprocess === void 0) {
      if (attempt < 30) {
        setTimeout(() => this.start(ctx, config, attempt + 1), 1e3);
        return;
      }
      console.log("[femo-plugin] subprocess service unavailable after 30s; bridge not started");
      return;
    }
    if (attempt > 0) console.log(`[femo-plugin] subprocess service ready after ${attempt}s wait; starting bridge`);
    const bridgePath = join3(config.femoRoot, "hostAdapter", "dshAdapter", "python", "femo_bridge.py");
    const hostManifestPath = config.hostManifest;
    void subprocess.resolveExecutable(config.python).then((pythonPath) => {
      const handle = subprocess.spawn({
        argv: [pythonPath, bridgePath, "--fe4m", config.femoRoot, "--host-manifest", hostManifestPath],
        cwd: config.femoRoot,
        stdio: {
          stdin: "pipe",
          stdout: "pipe",
          // 'pipe' (not collect): the caller owns the stream and forwards
          // tracebacks live; a collect buffer would swallow them silently.
          stderr: "pipe"
        },
        graceMs: 3e3,
        env: { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
      });
      this.handle = handle;
      handle.stdout?.on("data", (chunk) => this.onData(chunk));
      handle.stderr?.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        for (const line of text.split(/\r?\n/)) {
          if (line.trim().length === 0) continue;
          pushDiag("engine", `[stderr] ${line}`.slice(0, 400));
          process.stdout.write(`[femo-engine:stderr] ${line}
`);
        }
      });
      handle.done.then((outcome) => {
        console.log(`[femo-plugin] bridge exited: code=${outcome.exitCode} signal=${outcome.signal}`);
        for (const [, pending2] of this.pending) {
          pending2.reject(new Error(`bridge exited (code=${outcome.exitCode})`));
        }
        this.pending.clear();
        this.handle = void 0;
        try {
          this.onExited?.(outcome);
        } catch (error) {
          console.log(`[femo-plugin] onExited callback failed: ${String(error)}`);
        }
      }, (error) => {
        console.log(`[femo-plugin] bridge spawn failed: ${String(error)}`);
        this.handle = void 0;
      });
      console.log(`[femo-plugin] bridge started (pid=${handle.pid})`);
    }, (error) => {
      console.log(`[femo-plugin] python resolve failed: ${String(error)}`);
    });
  }
  /** Send one command; resolves with the bridge's response result. */
  send(cmd, args = {}, timeoutMs = 15e3) {
    const handle = this.handle;
    if (handle === void 0) return Promise.reject(new Error("bridge not running"));
    const id = this.nextId++;
    const payload = `${JSON.stringify({ id, cmd, args })}
`;
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`bridge command "${cmd}" timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve2(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
      handle.stdin?.write(payload, (error) => {
        if (error !== void 0 && error !== null) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }
  /** Terminate the bridge process tree (graceful shutdown command first). */
  async stop() {
    const handle = this.handle;
    if (handle === void 0) return;
    try {
      await this.send("shutdown", {}, 2e3);
    } catch {
    }
    handle.terminate();
    await handle.waitForExit();
    this.handle = void 0;
  }
  onData(chunk) {
    this.lineBuf += chunk.toString("utf8");
    let idx;
    while ((idx = this.lineBuf.indexOf("\n")) !== -1) {
      const line = this.lineBuf.slice(0, idx).trim();
      this.lineBuf = this.lineBuf.slice(idx + 1);
      if (line.length === 0) continue;
      if (!line.startsWith("{")) {
        if (line.includes('"type"') || line.includes("job_id")) {
          pushDiag("bridge", `TORN_LINE_SUSPECT: ${line.slice(0, 300)}`);
        }
        pushDiag("engine", line.slice(0, 400));
        process.stdout.write(`[femo-engine] ${line}
`);
        continue;
      }
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        pushDiag("bridge", `JSON_PARSE_FAIL: ${line.slice(0, 300)}`);
        continue;
      }
      if (msg.type === "response") {
        const rid = msg.id;
        if (rid === void 0) continue;
        const pending2 = this.pending.get(rid);
        if (pending2 === void 0) continue;
        this.pending.delete(rid);
        if (msg.ok === true) pending2.resolve(msg.result);
        else pending2.reject(new Error(String(msg.detail ?? msg.error ?? "bridge error")));
      } else if (msg.type === "event") {
        pushDiag("bridge", `event ${String(msg.event)} job=${String(msg.data?.job_id ?? "-")}`);
        this.emit("femo-plugin/event", msg.event, msg.data);
      }
    }
  }
};
async function sendActorFailure(bridge, jobId, waitKey, kind, detail) {
  await bridge.send("actor_failed", {
    job_id: jobId,
    wait_key: waitKey,
    kind,
    detail: detail.slice(0, 500)
  }, 1e4);
}

// host/session-events.ts
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
function configurePersonaDocs(femoRoot) {
  const root = (femoRoot || engineRoot).replace(/[\/]+$/, "");
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
function registerPersonaHooks(ctx, femoRoot) {
  configurePersonaDocs(femoRoot);
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

// host/state-files.ts
import { join as join4 } from "node:path";
async function readSessionRecord(femoRoot, sessionId, quarantineOnParseError = false) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  let raw;
  try {
    raw = await readFile3(sessionScriptPath(femoRoot, sessionId), "utf8");
  } catch {
    return void 0;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (!quarantineOnParseError) return void 0;
    const { rename } = await import("node:fs/promises");
    const quarantined = `${sessionScriptPath(femoRoot, sessionId)}.corrupt-${Date.now()}`;
    try {
      await rename(sessionScriptPath(femoRoot, sessionId), quarantined);
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
async function writeSessionRecord(femoRoot, sessionId, record) {
  const { mkdir: mkdir3, writeFile: writeFile2 } = await import("node:fs/promises");
  const path = sessionScriptPath(femoRoot, sessionId);
  await mkdir3(join4(path, ".."), { recursive: true });
  await writeFile2(path, JSON.stringify({ ...record, sessionId }, null, 2), "utf8");
}
async function setSessionCurrentJob(femoRoot, sessionId, jobId) {
  await withRecordLock(sessionId, async () => {
    const record = { ...await readSessionRecord(femoRoot, sessionId, true) ?? {} };
    if (jobId === null) delete record.currentJobId;
    else record.currentJobId = jobId;
    await writeSessionRecord(femoRoot, sessionId, record);
  });
}
async function readSessionCurrentJob(femoRoot, sessionId) {
  const record = await readSessionRecord(femoRoot, sessionId);
  return record?.currentJobId;
}
async function readSessionJobIds(femoRoot, sessionId) {
  const record = await readSessionRecord(femoRoot, sessionId);
  return record?.jobIds;
}
async function appendSessionJob(femoRoot, sessionId, jobId) {
  await withRecordLock(sessionId, async () => {
    const record = { ...await readSessionRecord(femoRoot, sessionId, true) ?? {} };
    if (record.jobIds?.includes(jobId)) return;
    record.jobIds = [...record.jobIds ?? [], jobId];
    await writeSessionRecord(femoRoot, sessionId, record);
  });
}
function appendFemoSession(femoRoot, sessionId, femoSessionId) {
  return withRecordLock(sessionId, async () => {
    const record = { ...await readSessionRecord(femoRoot, sessionId, true) ?? {} };
    const list = record.femoSessions ?? [];
    if (list[list.length - 1] === femoSessionId) return;
    record.femoSessions = [...list, femoSessionId];
    await writeSessionRecord(femoRoot, sessionId, record);
  });
}
function turnScopePath(femoRoot, sessionId) {
  return join4(femoRoot, "user_data", "host-history", "projections", "turn-scopes", `${sessionId}.json`);
}
async function writeTurnScopeFile(femoRoot, sessionId, scopes) {
  const { mkdir: mkdir3, writeFile: writeFile2 } = await import("node:fs/promises");
  const path = turnScopePath(femoRoot, sessionId);
  const out = {};
  for (const [turn, scope] of scopes) out[String(turn)] = scope;
  await mkdir3(join4(path, ".."), { recursive: true });
  await writeFile2(path, JSON.stringify({ sessionId, updatedAt: Date.now(), scopes: out }, null, 2), "utf8");
}
async function readTurnScopeFile(femoRoot, sessionId) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(turnScopePath(femoRoot, sessionId), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.scopes ?? {};
  } catch {
    return {};
  }
}
function sessionScriptPath(femoRoot, sessionId) {
  return join4(femoRoot, "user_data", "host-history", "drafts", `${sessionId}.json`);
}
function writeSessionScript(femoRoot, sessionId, record, expectRev) {
  return withRecordLock(sessionId, async () => {
    const prevFile = await readSessionRecord(femoRoot, sessionId, true);
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
      ...record,
      rev
    };
    await writeSessionRecord(femoRoot, sessionId, next);
    return { ok: true, rev };
  });
}
async function readSessionScript(femoRoot, sessionId) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(sessionScriptPath(femoRoot, sessionId), "utf8");
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
async function readSessionScriptText(femoRoot, sessionId) {
  const record = await readSessionScript(femoRoot, sessionId);
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
function actorUsagePath(femoRoot, sessionId) {
  return join4(femoRoot, "user_data", "host-history", "projections", "actor-usage", `${sessionId}.json`);
}
async function readActorUsageFile(femoRoot, sessionId) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(actorUsagePath(femoRoot, sessionId), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.actors === "object" && parsed.actors !== null ? parsed.actors : void 0;
  } catch {
    return void 0;
  }
}
async function mergeActorUsageFile(femoRoot, sessionId, actorKey, record) {
  await withRecordLock(sessionId, async () => {
    const fs = await import("node:fs/promises");
    const existing = await readActorUsageFile(femoRoot, sessionId) ?? {};
    const actors = { ...existing, [actorKey]: record };
    await fs.mkdir(join4(femoRoot, "user_data", "host-history", "projections", "actor-usage"), { recursive: true });
    await fs.writeFile(actorUsagePath(femoRoot, sessionId), JSON.stringify({ sessionId, actors }, null, 2), "utf8");
  });
}

// host/projection.ts
import { SessionId } from "@deepseek-ai/dsh-session";

// host/list-cache.ts
import { readdir } from "node:fs/promises";
import { join as join5 } from "node:path";
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
        const projectPath = join5(root, project.name);
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

// host/native-state.ts
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

// host/proj-trace.ts
var enabled = true;
function projTrace(tag, msg) {
  if (!enabled) return;
  try {
    pushDiag(tag, msg);
  } catch {
  }
}
function brief(data, max = 60) {
  if (data === void 0) return "-";
  const parts = [];
  for (const key of ["turn", "step", "kind", "actor", "seq", "reason", "_srcSeq"]) {
    const v = data[key];
    if (v === void 0) continue;
    if (key === "reason" && typeof v === "object" && v !== null) {
      parts.push(`reason=${String(v.kind ?? "?")}`);
      continue;
    }
    parts.push(`${key}=${typeof v === "string" ? v.slice(0, 24) : String(v)}`);
  }
  const text = data.text;
  if (typeof text === "string" && text.length > 0) parts.push(`text=${JSON.stringify(text.slice(0, max))}`);
  return parts.join(" ");
}
function t4(turn) {
  return typeof turn === "number" ? `\u2026${String(turn).slice(-4)}` : String(turn);
}

// host/projection.ts
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
function dedupeStructKey(eventType, d) {
  if (typeof d.turn !== "number") return void 0;
  if (eventType === "turn/start" || eventType === "turn/end") return `${eventType}:${d.turn}`;
  if ((eventType === "step/start" || eventType === "step/end") && typeof d.step === "number") {
    return `${eventType}:${d.turn}:${d.step}`;
  }
  return void 0;
}
function dedupeIndexFor(session) {
  let idx = winDedupeIndex.get(session);
  if (idx === void 0) {
    idx = { srcSeqs: /* @__PURE__ */ new Set(), structKeys: /* @__PURE__ */ new Set(), hasDescriptor: false };
    for (const e of readSessionEvents(session)) {
      const d = e.data ?? {};
      if (d._srcSeq !== void 0) idx.srcSeqs.add(d._srcSeq);
      const sk = dedupeStructKey(e.type, d);
      if (sk !== void 0) idx.structKeys.add(sk);
      if (e.type === "subagent/descriptor") idx.hasDescriptor = true;
    }
    winDedupeIndex.set(session, idx);
  }
  return idx;
}
function dedupeMarkIndexed(session, type, data) {
  const idx = winDedupeIndex.get(session);
  if (idx === void 0) return;
  const d = data ?? {};
  if (d._srcSeq !== void 0) idx.srcSeqs.add(d._srcSeq);
  const sk = dedupeStructKey(type, d);
  if (sk !== void 0) idx.structKeys.add(sk);
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
function appendChatProjected(ctx, session, projections, text, kind, actor, visible, alsoMainSession = false) {
  if (alsoMainSession) {
    appendChat(ctx, session, text, kind, actor, visible);
  }
  const windows = projections.get(String(session.id));
  if (windows === void 0) {
    if (!alsoMainSession) {
      console.log(`[femo-plugin] chat line dropped (no projection window): kind=${kind}`);
    }
    return;
  }
  projectionAppend(windows, "femo-plugin/chat", {
    ...actor === void 0 ? {} : { actor },
    text,
    kind,
    ...visible === void 0 ? {} : { visible },
    seq: Date.now()
  }, void 0, visible);
}
function appendChatMain(ctx, session, text) {
  appendChat(ctx, session, text, "sys");
}
function appendChatBroadcast(ctx, session, projections, text) {
  appendChatMain(ctx, session, text);
  const windows = projections.get(String(session.id));
  if (windows === void 0) {
    console.log(`[femo-plugin] broadcast dropped (no projection window): ${text.slice(0, 30)}`);
    return;
  }
  projectionAppend(windows, "femo-plugin/chat", { text, kind: "sys", seq: Date.now() }, void 0, []);
}
var GOD_ACTOR = "god";
var STAGE_ACTOR = "stage";
function projectionActorKey(actor) {
  return Array.from(actor).map((ch) => /[A-Za-z0-9_-]/.test(ch) ? ch : `_${ch.codePointAt(0).toString(16)}`).join("");
}
function projectionId(sid, actor) {
  return `femo-proj-${sid}-${projectionActorKey(actor)}`;
}
function mainSessionIdOf(sessionId) {
  if (!sessionId.startsWith("femo-proj-")) return sessionId;
  return sessionId.slice("femo-proj-".length).replace(/-[^-]*$/, "");
}
function descriptorLabel(actor) {
  return actor === GOD_ACTOR ? "\u{1F441} \u4E0A\u5E1D\u89C6\u89D2" : actor === STAGE_ACTOR ? "\u620F\u5185\u89C6\u89D2" : `\u{1F3AD} ${actor}`;
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
          projTrace("proj", `\u5199\u76D8\u5931\u8D25 ${id}: ${String(error instanceof Error ? error.message : error).slice(0, 120)}`);
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
      projTrace("proj", `\u63A5\u7BA1\u5199\u76D8 ${id}\uFF08\u5DF2\u5B58=${all.length - suffix.length} \u8865\u5199=${suffix.length}\uFF09`);
    } catch (error) {
      await handle.close().catch(() => {
      });
      throw error;
    }
  } catch (error) {
    projTrace("proj", `\u63A5\u7BA1\u5199\u76D8\u8DF3\u8FC7 ${id}: ${String(error instanceof Error ? error.message : error).slice(0, 120)}`);
  }
}
function disposeProjectionWriters() {
  for (const [id, handle] of projectionWriters) {
    void handle.close().catch(() => {
    });
    projTrace("proj", `\u91CA\u653E\u5199\u76D8\u53E5\u67C4 ${id}`);
  }
  projectionWriters.clear();
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
      return existing;
    }
    const awakened = await awakenProjectionWindow(ctx, sessions, id, cwd);
    if (awakened !== void 0) {
      if (!projectionHasDescriptor(awakened)) {
        appendEvent(awakened, "subagent/descriptor", descriptorPayload(actor));
      }
      await attachProjectionWriter(ctx, awakened, id);
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
function projectionAppend(windows, type, data, surfaceOp, targetActors, opts) {
  const targets = targetActors !== void 0 && targetActors.length === 0 ? void 0 : targetActors;
  const srcSeq = data._srcSeq;
  const skey = dedupeStructKey(type, data);
  const appendTo = (win, winName) => {
    if (win === void 0) return;
    const idx = dedupeIndexFor(win);
    if (srcSeq !== void 0 && idx.srcSeqs.has(srcSeq)) {
      projTrace("proj", `\u8DF3\u8FC7(\u6E90\u5DF2\u5B58\u5728) ${winName ?? "?"} ${type} ${brief(data)}`);
      return;
    }
    if (skey !== void 0 && idx.structKeys.has(skey)) {
      projTrace("proj", `\u8DF3\u8FC7(\u7ED3\u6784\u5DF2\u5B58\u5728) ${winName ?? "?"} ${type} ${brief(data)}`);
      return;
    }
    try {
      appendEvent(win, type, data, surfaceOp);
      if (srcSeq !== void 0) idx.srcSeqs.add(srcSeq);
      if (skey !== void 0) idx.structKeys.add(skey);
      if (type === "subagent/descriptor") idx.hasDescriptor = true;
      projTrace("proj", `\u5199\u5165 ${winName ?? "?"} ${type} ${brief(data)}`);
    } catch (error) {
      console.log(`[femo-plugin] projectionAppend(${type}) failed: ${String(error)}`);
      projTrace("proj", `\u5199\u5165\u5931\u8D25 ${winName ?? "?"} ${type} ${String(error).slice(0, 120)}`);
    }
  };
  if (opts?.skipGod === true) {
    appendTo(windows.stage, "stage");
  } else {
    appendTo(windows.god, "god");
    appendTo(windows.stage, "stage");
  }
  if (targets === void 0) {
    for (const [actorName, win] of windows.actors.entries()) appendTo(win, `\u89D2\u8272:${actorName}`);
  } else {
    for (const actor of targets) appendTo(windows.actors.get(actor), `\u89D2\u8272:${actor}`);
  }
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

// host/windowing-native.ts
import { createRequire } from "node:module";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join as join6 } from "node:path";
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
  return join6(mirrorDir, `${safe}.jsonl`);
}
function mirrorEnqueue(mirrorDir, windowId, event) {
  const file = mirrorFile(mirrorDir, windowId);
  const surfaceOp = SURFACE_ELIGIBLE_TYPES.has(event.type) ? { surfaceOp: "append" } : void 0;
  const row = {
    type: event.type,
    data: event.data,
    ...surfaceOp === void 0 ? {} : { surfaceOp }
  };
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
function replayKey(type, d) {
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
function registerRuntimeWhitelist() {
  const candidates = [];
  let hostPath;
  if (process.argv[1] !== void 0 && process.argv[1].length > 0) {
    try {
      const req = createRequire(process.argv[1]);
      hostPath = req.resolve("@deepseek-ai/dsh-session");
      candidates.push(() => req("@deepseek-ai/dsh-session"));
    } catch {
    }
  }
  candidates.push(() => createRequire(import.meta.url)("@deepseek-ai/dsh-session"));
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

// host/god-mirror.ts
import { SessionId as SessionId2 } from "@deepseek-ai/dsh-session";
import { join as join7 } from "node:path";
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
function createGodMirror(deps) {
  const { femoRoot, sessionsStore, projections } = deps;
  const godMirrorSeqs = /* @__PURE__ */ new Map();
  function godMirrorPath(sid) {
    return join7(femoRoot, "user_data", "host-history", "projections", "god-mirror", `${sid}.json`);
  }
  async function loadGodMirrorSeq(sid) {
    const cached = godMirrorSeqs.get(sid);
    if (cached !== void 0) return cached;
    try {
      const { readFile: readFile3 } = await import("node:fs/promises");
      const parsed = JSON.parse(await readFile3(godMirrorPath(sid), "utf8"));
      const seq = typeof parsed.seq === "number" ? parsed.seq : 0;
      godMirrorSeqs.set(sid, seq);
      return seq;
    } catch {
      godMirrorSeqs.set(sid, 0);
      return 0;
    }
  }
  function markGodMirrorSeq(sid, seq) {
    const prev = godMirrorSeqs.get(sid) ?? 0;
    if (seq <= prev) return;
    godMirrorSeqs.set(sid, seq);
    void import("node:fs/promises").then(
      ({ mkdir: mkdir3, writeFile: writeFile2 }) => mkdir3(join7(godMirrorPath(sid), ".."), { recursive: true }).then(() => writeFile2(godMirrorPath(sid), JSON.stringify({ sessionId: sid, seq }, null, 2), "utf8")).catch((error) => console.log(`[femo-plugin] god-mirror watermark write failed: ${String(error)}`))
    );
  }
  function mirrorMainEventToGod(sid, event) {
    const windows = projections.get(sid);
    if (windows?.god === void 0) return;
    const srcSeq = Number(event.seq);
    const idx = dedupeIndexFor(windows.god);
    const dupBySrc = idx.srcSeqs.has(srcSeq);
    if (dupBySrc) return;
    const mTurn = event.data.turn;
    const mStep = event.data.step;
    if (event.type === "turn/start" && typeof mTurn === "number") {
      if (idx.structKeys.has(`turn/start:${mTurn}`)) return;
    }
    if (event.type === "step/start" && typeof mTurn === "number" && typeof mStep === "number") {
      if (idx.structKeys.has(`step/start:${mTurn}:${mStep}`)) return;
    }
    if (event.type === "turn/end" && typeof mTurn === "number") {
      if (idx.structKeys.has(`turn/end:${mTurn}`)) return;
    }
    if (event.type === "step/end" && typeof mTurn === "number" && typeof mStep === "number") {
      if (idx.structKeys.has(`step/end:${mTurn}:${mStep}`)) return;
    }
    const rawSurface = event.surfaceOp;
    const surface = rawSurface === void 0 ? void 0 : { surfaceOp: rawSurface };
    const structural = event.type === "turn/start" || event.type === "turn/end" || event.type === "step/start" || event.type === "step/end";
    const data = structural ? { ...event.data } : { ...event.data, _srcSeq: srcSeq };
    if (event.type === "turn/start" && typeof mTurn === "number") {
      const anchorKey = `live-main:${mTurn}`;
      if (!idx.structKeys.has(anchorKey)) {
        const sceneActor = deps.mainActorSceneActor?.(sid, mTurn);
        try {
          appendEvent(windows.god, "femo-plugin/chat", {
            kind: "live",
            actor: sceneActor ?? "\u5BFC\u6F14",
            turn: mTurn,
            main: true,
            ...sceneActor !== void 0 ? { scene: true } : {},
            seq: Date.now()
          });
          idx.structKeys.add(anchorKey);
          projTrace("proj", `\u5199\u4E3B Agent \u5F00\u8F6E\u951A\u70B9(god) turn=\u2026${String(mTurn).slice(-4)} sid=${sid.slice(-8)} actor=${sceneActor ?? "\u5BFC\u6F14"}\uFF08\u5148\u4E8E\u955C\u50CF turn/start\uFF09`);
        } catch (error) {
          console.log(`[femo-plugin] main->god anchor(${mTurn}) failed: ${String(error)}`);
        }
      }
    }
    try {
      appendEvent(windows.god, event.type, data, surface);
      if (!structural) idx.srcSeqs.add(srcSeq);
      const sk = dedupeStructKey(event.type, data);
      if (sk !== void 0) idx.structKeys.add(sk);
    } catch (error) {
      console.log(`[femo-plugin] main->god mirror(${event.type}) failed: ${String(error)}`);
      return;
    }
    markGodMirrorSeq(sid, srcSeq);
  }
  const catchUpInflight = /* @__PURE__ */ new Map();
  function ensureGodMirrorUpToDate(sid) {
    const prev = catchUpInflight.get(sid) ?? Promise.resolve();
    const task = prev.then(() => catchUpNow(sid)).catch((error) => {
      console.log(`[femo-plugin] god-mirror catch-up ${sid} failed: ${String(error)}`);
    });
    catchUpInflight.set(sid, task);
    const cleanup = () => {
      if (catchUpInflight.get(sid) === task) catchUpInflight.delete(sid);
    };
    void task.then(cleanup, cleanup);
    return task;
  }
  async function catchUpNow(sid) {
    const windows = projections.get(sid);
    if (windows?.god === void 0) return;
    const main = sessionsStore?.get(SessionId2(sid));
    if (main === void 0) return;
    const t0 = Date.now();
    let last = await loadGodMirrorSeq(sid);
    let wrote = 0;
    const events = readSessionEvents(main);
    for (const event of events) {
      const seq = Number(event.seq);
      if (seq <= last) continue;
      last = seq;
      if (!MIRROR_MAIN_EVENTS.has(event.type)) continue;
      mirrorMainEventToGod(sid, event);
      wrote += 1;
    }
    console.log(`[femo-plugin][diag] god-mirror catch-up ${sid}: ${Date.now() - t0}ms, scanned=${events.length}, wrote=${wrote}, watermark->${last}`);
  }
  function registerRealtimeListener(ctx) {
    ctx.on("session/event", (session, event) => {
      if (session.header.parentSession !== void 0) return;
      if (!MIRROR_MAIN_EVENTS.has(event.type)) return;
      mirrorMainEventToGod(String(session.id), event);
    });
  }
  return { mirrorMainEventToGod, ensureGodMirrorUpToDate, registerRealtimeListener };
}

// host/engine-events.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { SessionId as SessionId5 } from "@deepseek-ai/dsh-session";

// host/subagent.ts
import { randomUUID } from "node:crypto";
import { dirname, join as join9 } from "node:path";

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

// host/section-gate.ts
function actorKeyOf(sid, actorKey) {
  return `${sid}\0${actorKey}`;
}
var SectionGate = class {
  queues = /* @__PURE__ */ new Map();
  actorLast = /* @__PURE__ */ new Map();
  /** 节点开跑（ai_request 处理起点）登记：占据本区块在 FIFO 里的顺位。
   *  同 turn 重复 begin 幂等忽略。 */
  begin(sid, turn, actorKey) {
    let q = this.queues.get(sid);
    if (q === void 0) {
      q = [];
      this.queues.set(sid, q);
    }
    if (q.some((e) => e.turn === turn)) return;
    const entry = { turn, actorKey, ready: false };
    let resolve2;
    const promise = new Promise((r) => {
      resolve2 = r;
    });
    entry.hook = { promise, resolve: resolve2 };
    q.push(entry);
    this.actorLast.set(actorKeyOf(sid, actorKey), entry.hook);
    projTrace("gate", `begin turn=${t4(turn)} actor=${actorKey} \u961F\u5217\u957F=${q.length} \u961F\u9996=${t4(q[0]?.turn)} \u5C31\u7EEA=${q.map((e) => e.ready ? "R" : "-").join("")}`);
  }
  /** 同角色上一区块的落盘完成钩子（未登记过 = 立即通过）。调用方必须在
   *  begin(自己的回合) 之前 await，拿到的才是上一回合的钩子。 */
  waitActorFlush(sid, actorKey) {
    const hook = this.actorLast.get(actorKeyOf(sid, actorKey));
    projTrace("gate", `waitFlush actor=${actorKey} ${hook === void 0 ? "\uFF08\u65E0\u767B\u8BB0=\u7ACB\u5373\u901A\u8FC7\uFF09" : "\uFF08\u7B49\u4E0A\u4E00\u6BB5\u843D\u76D8\uFF09"}`);
    return hook?.promise ?? Promise.resolve();
  }
  /** 区块就绪：挂上落盘 runner 并按序冲刷就绪前缀。
   *  - 队列里有本 turn 的 entry → 标记 ready；
   *  - 没有（重试回合等二次提交）→ 就绪 entry 排到队尾（保持相对顺序）。
   *  commit 幂等性由调用方的 released 旗标保证（同 turn 二次 commit 会作为
   *  新 entry 再排一次）。 */
  commit(sid, turn, actorKey, run) {
    let q = this.queues.get(sid);
    if (q === void 0) {
      q = [];
      this.queues.set(sid, q);
    }
    const entry = q.find((e) => e.turn === turn);
    if (entry === void 0) {
      q.push({ turn, actorKey, ready: true, run });
    } else {
      entry.run = run;
      entry.ready = true;
    }
    projTrace("gate", `commit turn=${t4(turn)} actor=${actorKey} \u961F\u5217\u957F=${q.length} \u961F\u9996=${t4(q[0]?.turn)} \u5C31\u7EEA=${q.map((e) => e.ready ? "R" : "-").join("")}`);
    this.tryFlush(sid);
  }
  /** 冲刷就绪前缀：队首就绪则落盘并继续（FIFO，单线程同步）。 */
  tryFlush(sid) {
    const q = this.queues.get(sid);
    if (q === void 0) return;
    while (q.length > 0 && q[0].ready && q[0].run !== void 0) {
      const entry = q.shift();
      projTrace("gate", `\u843D\u76D8 turn=${t4(entry.turn)} actor=${entry.actorKey} \u5269\u4F59\u961F\u5217=${q.length}`);
      entry.run();
      entry.hook?.resolve();
    }
  }
};
var sectionGate = new SectionGate();

// host/api-retry.ts
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
  attempts = /* @__PURE__ */ new Map();
  lifetime = new AbortController();
  /**
   * 注册 `agent/request-error` 瀑布下游 listener。返回 disposer（HMR 安全：
   * 移除 listener + 中止在飞延迟 + 清计数）。
   */
  install(ctx, deps) {
    const disposeListener = ctx.on("agent/request-error", async (payload, next) => {
      const childId = String(payload.agent.session.id);
      const target = deps.resolveTarget(childId);
      if (target === void 0) {
        this.attempts.delete(childId);
        return next();
      }
      if (payload.signal.aborted) return next();
      const failure = { code: payload.failure.code, message: payload.failure.message };
      if (!RETRYABLE_CODES.has(failure.code)) return next();
      const previous = this.attempts.get(childId);
      const count = previous !== void 0 && previous.turn === payload.turn && previous.step === payload.step ? previous.count + 1 : 1;
      if (count > MAX_CONSECUTIVE_FAILURES) {
        this.attempts.delete(childId);
        deps.onExhausted(target, failure);
        return next();
      }
      this.attempts.set(childId, { turn: payload.turn, step: payload.step, count });
      const delayMs = SLOW_DELAYS_MS[count - 1] ?? 0;
      deps.onRetry(target, count, delayMs, failure);
      const fused = AbortSignal.any([payload.signal, this.lifetime.signal]);
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
    });
    return () => {
      disposeListener();
      this.lifetime.abort(new Error("femo-plugin api-retry chain disposed"));
      this.attempts.clear();
    };
  }
  /** 显式清某个 child 的失败计数（子代理/main 收尾路径可调用；幂等）。 */
  clearChild(childSessionId) {
    this.attempts.delete(childSessionId);
  }
};
var apiRetry = new ApiRetryChain();

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

// host/node-retry.ts
var PARK_TIMEOUT_MS = 15 * 6e4;
var RETRY_TURN_TIMEOUT_MS = 5 * 6e4;
var SET_VARIABLE_TEACHING = "\u9700\u8981 SET VARIABLE \u7684\u8282\u70B9\u628A\u8D4B\u503C\u6309\u683C\u5F0F\u5199\u5728\u53F0\u8BCD\u672B\u5C3E";
function RETRY_STEER_TEXT(attempt, message) {
  return `[femo-plugin\xB7\u8282\u70B9\u91CD\u8BD5] \u4F60\u4E0A\u4E00\u8F6E\u7684\u8F93\u51FA\u672A\u901A\u8FC7\u5267\u672C\u6821\u9A8C\uFF08\u7B2C ${attempt} \u6B21\u53CD\u9988\uFF09\uFF1A
${message}
\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5168\u90E8\u8FC7\u7A0B\u4FEE\u6B63\u5E76\u91CD\u65B0\u8F93\u51FA\u672C\u8282\u70B9\u53F0\u8BCD\uFF08${SET_VARIABLE_TEACHING}\uFF09\u3002`;
}
var NodeRetryBroker = class {
  parkers = /* @__PURE__ */ new Map();
  /** 持久登记（幂等：同 waitKey 已存在则跳过——首次登记权威，登记时点
   *  永远早于引擎可能发出的第一个 node_retry）。 */
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
  /** node_retry 信号的入口。按 parker.kind 分发：
   *  - human → 租约（投影窗提醒）即翻译：显示到人类输入的地方，引擎在
   *    自己的人类重等循环里等重输，宿主零额外机制；
   *  - subagent/main → parked 则 resolve(retry)，否则暂存 pending。
   *  ⚠️ 对 subagent/main 只 resolve/pending，不代调租约——steer 的调用时机
   *  =停靠循环收到 verdict 之后（漏调=重试永远空转）。 */
  deliverRetry(waitKey, feedback, attempt, aiName) {
    const p = this.parkers.get(waitKey);
    if (p === void 0) {
      console.log(`[femo-plugin] node_retry without parker (dropped; engine 3600s timeout covers): wait_key=${waitKey} attempt=${attempt}`);
      return;
    }
    if (p.kind === "human") {
      safeSteer(p, feedback, `node_retry human ${waitKey}`);
      return;
    }
    const verdict = { kind: "retry", feedback, attempt, aiName };
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
    safeSteer(p, text, `lease ${waitKey}`);
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
  /** 全场放行（flow_paused/flow_error/bridge_run_ended/onExited）：所有
   *  parker resolve(aborted) 并清空登记（引擎已停，剩余停靠无意义；幂等）。 */
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
  /** Job 域放行（Job 模型 §9.3）：只 abort 本 Job 的 parker——flow_paused/
   *  flow_error 清场用，不误杀其他会话在飞演员（abortAll 保留给 bridge 死亡/
   *  HMR 全场场景）。 */
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
  /** HMR/插件卸载：清全部状态（在飞 timer 一并清）。 */
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
var broker = new NodeRetryBroker();

// host/debug-log.ts
import { appendFileSync as appendFileSync2, mkdirSync as mkdirSync2, statSync as statSync2, unlinkSync as unlinkSync2 } from "node:fs";
import { join as join8 } from "node:path";
var KEEP_DAYS = 3;
var NL = String.fromCharCode(10);
function appendDebugLog(femoRoot, name2, line) {
  try {
    const dir = join8(femoRoot, "cache", "logs");
    const file = join8(dir, name2);
    mkdirSync2(dir, { recursive: true });
    try {
      if (statSync2(file).mtimeMs < Date.now() - KEEP_DAYS * 864e5) unlinkSync2(file);
    } catch {
    }
    appendFileSync2(file, line.endsWith(NL) ? line : line + NL, "utf8");
  } catch {
  }
}

// host/subagent.ts
function debugEffortLog(resolved, tag, detail) {
  appendDebugLog(
    resolved.femoRoot,
    "debug-effort-hook.log",
    "[" + (/* @__PURE__ */ new Date()).toISOString() + "] " + tag + " " + detail
  );
}
var turnBaseBySession = /* @__PURE__ */ new Map();
var TURN_BASE_EPOCH = Math.floor(Date.now() / 1e3);
var turnScopesBySession = /* @__PURE__ */ new Map();
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
var SURFACE_OP_EVENTS = /* @__PURE__ */ new Set(["assistant/message", "tool/result"]);
var BUFFERED_CHILD_EVENTS = /* @__PURE__ */ new Set([
  "assistant/chunk",
  "assistant/message",
  "tool/call",
  "tool/result",
  "step/end"
]);
var activeSubagents = /* @__PURE__ */ new Set();
var activeChildRuns = /* @__PURE__ */ new Map();
var runControlAborted = /* @__PURE__ */ new WeakSet();
function abortJobSubagents(jobId, reason) {
  let aborted = 0;
  for (const entry of [...activeSubagents]) {
    if (entry.jobId !== jobId) continue;
    if (entry.controller.signal.aborted) continue;
    runControlAborted.add(entry.controller);
    entry.interrupt?.();
    entry.controller.abort(new Error(reason));
    aborted += 1;
  }
  return aborted;
}
function abortAllSubagents(reason) {
  let aborted = 0;
  for (const entry of [...activeSubagents]) {
    if (entry.controller.signal.aborted) continue;
    runControlAborted.add(entry.controller);
    entry.interrupt?.();
    entry.controller.abort(new Error(reason));
    aborted += 1;
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
  const system = [
    str("basic_safety"),
    str("basic_output"),
    str("user_info")
  ].filter(Boolean).join("\n\n");
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
var ACTOR_DENIED_TOOLS = [
  "femo-mount",
  "femo-run",
  "femo-script",
  "femo-soul",
  "femo-chronica",
  "femo-debug"
];
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
async function moveChildSessionOut(ctx, resolved, run) {
  const header = run.localAgent?.session.header;
  if (header === void 0 || header.cwd === void 0) return;
  const persistence = ctx.get("sessionPersistence");
  if (persistence?.locate === void 0) return;
  const loc = persistence.locate({ cwd: header.cwd, id: run.id });
  if (loc === void 0) return;
  const sessionDir = dirname(loc.path);
  const targetRoot = join9(resolved.femoRoot, "user_data", "host-history", "projections", "subagents");
  const target = join9(targetRoot, String(run.id));
  const { mkdir: mkdir3, rename } = await import("node:fs/promises");
  await mkdir3(targetRoot, { recursive: true });
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rename(sessionDir, target);
      console.log(`[femo-plugin] moved child session ${run.id} -> subagent_sessions/`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve2) => setTimeout(resolve2, 500));
    }
  }
  throw lastError;
}
async function runAiSubagent(ctx, resolved, bridge, session, request, recordError, defaultModel, nodeActors = /* @__PURE__ */ new Map(), projections, nodeShowprompts = /* @__PURE__ */ new Map(), jobId = -1) {
  if (projections === void 0) throw new Error("projections registry unavailable");
  const waitKey = String(request.wait_key ?? "");
  if (waitKey.length === 0) return;
  const subagents = ctx.get("subagents");
  if (subagents === void 0) {
    throw new Error("subagents service unavailable");
  }
  const parent = ctx.agents.get(session.id);
  if (parent === void 0) {
    throw new Error(`parent agent for ${session.id} is not live`);
  }
  const blocks = request.blocks ?? {};
  const unknownBlockKeys = Object.keys(blocks).filter((k) => !KNOWN_BLOCK_KEYS.has(k));
  if (unknownBlockKeys.length > 0) {
    console.log(`[femo-plugin] ai_request(node=${String(request.node_name ?? "")}) blocks \u542B\u5951\u7EA6\u5916\u8BED\u6599\u952E\uFF08\u5BBF\u4E3B\u62FC\u88C5\u5668\u4E0D\u8BC6\u522B\u5DF2\u5FFD\u7565\uFF1B\u81EA\u5B9A\u4E49 context \u5757\u4EC5\u76F4\u8FDE\u6A21\u5F0F\u751F\u6548\uFF09: ${unknownBlockKeys.join(", ")}`);
  }
  const prompt = buildSubagentPrompt(blocks);
  const actorInfo = request.actor_info ?? {};
  const soulId = typeof actorInfo.soul === "string" ? actorInfo.soul : "";
  const soulPersona = soulId.length > 0 ? await readSoulPersona(bridge, soulId) : "";
  if (soulPersona.includes("{{")) {
    console.log(`[femo-plugin] WARNING soul persona (soul_id=${soulId}) contains "{{" \u2014 dsh prompt assembly treats it as a template variable and will fail loud`);
  }
  const blk = (key) => typeof blocks[key] === "string" ? String(blocks[key]) : "";
  console.log(`[femo-plugin] ai_request node=${String(request.node_name ?? "")} scope=${String(request.scope ?? "")} soul_id=${soulId} blocks: context=${blk("context").length}ch soul=${blk("soul").length}ch memory=${blk("memory").length}ch prompt=${blk("prompt").length}ch`);
  console.log(`[femo-plugin] subagent prompt (${prompt.length}ch): ${prompt.slice(0, 300).replace(/\n/g, "\\n")}`);
  const controller = new AbortController();
  const activeEntry = { controller, node: String(request.node_name ?? ""), jobId };
  activeSubagents.add(activeEntry);
  let idleTimer;
  const armIdle = () => {
    if (idleTimer !== void 0) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      controller.abort(new Error(`\u5B50 agent \u7A7A\u95F2\u8D85\u65F6\uFF08${Math.round(resolved.subagentIdleTimeoutMs / 1e3)}s \u65E0\u8F93\u51FA\uFF09`));
    }, resolved.subagentIdleTimeoutMs);
  };
  const mainModel = resolveMainModel(parent, defaultModel);
  const run = await subagents.start(resolved.subagentProvider, {
    label: `femo-node-${String(request.node_name ?? "")}`,
    prompt: [{ type: "text", text: prompt }],
    parent,
    signal: controller.signal,
    // 演员 persona（2026-09-05 猫猫拍板两步走）：先置空让演员摆脱导演手册
    // （「演员子代理拥有 dsh 的标准模式的 system prompt 就好了，他们不是导
    // 演」）；本轮再把 soul 从 user 消息挪进来——persona= 引擎 souls 表的
    // .description（桥命令 get_soul），在子代理自身 scope 注册
    // deployment:persona section，就近 shadow 掉 Femo preset standing mount 的
    // 导演手册（composeFrom 是 bind 不是 mount，preset row 落在 mount layer；
    // ScopedLayers.merge 就近优先）。无 soul/读库失败 → ''，渲染时空 section
    // 被 drop=标准模式（与「演员不是导演」拍板一致）。3081 部署无全局 persona
    // 配置，标准模式本就无 persona 段。导演主会话不受影响（本参数只作用于
    // spawn 子代理）；preset 工具面/compaction 不受影响（join 语义未动）。
    persona: soulPersona,
    // source → (provider, model)：剧本 actor 声明（编译期已校验白名单）。
    // 裸 id 走默认 provider（dshProvider）；provider/model 双写完全指定；空跟随主模型。
    ...resolveSourceModel(resolved, request.source, mainModel),
    // Actor-level tool access: the script's `tools: true/false` on the actor
    // wins; undeclared actors fall back to defaultActorTools (default true so
    // coding workflows keep their tools). An enabled actor with no whitelist
    // inherits the preset's full tool set (no filter); a disabled actor gets
    // an empty allow-list (no tools at all).
    ...toolFilterOf(resolved, request)
  });
  activeChildRuns.set(String(run.id), { mainSid: String(session.id), node: String(request.node_name ?? ""), jobId });
  broker.register({
    waitKey,
    nodeName: String(request.node_name ?? ""),
    kind: "subagent",
    jobId,
    mainSessionId: String(session.id),
    controller,
    steer: (text) => run.localAgent?.steer?.({
      id: randomUUID(),
      role: "user",
      content: [{ type: "text", text }],
      source: { kind: "plugin", plugin: "femo-plugin" }
    })
  });
  if (run.localAgent !== void 0) {
    appendActorPolicyPins(run.localAgent.session);
    const childSystemPrompt = run.localAgent.ctx.systemPrompt;
    childSystemPrompt?.context({
      name: "femo:child-scope",
      order: 121,
      text: FEMO_CHILD_SCOPE_TEXT
    });
  }
  if (run.localAgent !== void 0) {
    run.localAgent.ctx.on("agent/request", async (_payload, next) => {
      const resolvedCall = await next();
      const actorThinking = typeof request.actor_thinking === "string" && request.actor_thinking.trim().length > 0 ? request.actor_thinking.trim() : void 0;
      const effort = actorThinking ?? resolved.subagentReasoning ?? defaultModel?.currentSelection()?.reasoningEffort;
      const { reasoningEffort: _inheritedEffort, ...withoutInheritedEffort } = resolvedCall;
      return {
        ...withoutInheritedEffort,
        ...effort !== void 0 && effort.length > 0 ? { reasoningEffort: effort } : {}
      };
    });
  }
  armIdle();
  const sid = String(session.id);
  const nodeName = String(request.node_name ?? "");
  const requestAiName = typeof request.ai_name === "string" && request.ai_name.length > 0 ? request.ai_name : void 0;
  const actor = requestAiName ?? nodeActors.get(nodeName) ?? nodeName;
  const actorKey = projectionActorKey(actor);
  const usageCurrent = {};
  const publishActorUsage = () => {
    if (usageCurrent.usedTokens === void 0) return;
    const record = {
      provider: usageCurrent.provider ?? "",
      model: usageCurrent.model ?? "",
      contextWindow: usageCurrent.contextWindow ?? ACTOR_CONTEXT_WINDOW_FALLBACK,
      usedTokens: usageCurrent.usedTokens,
      updatedAt: Date.now()
    };
    let byActor = actorUsageBySession.get(sid);
    if (byActor === void 0) {
      byActor = /* @__PURE__ */ new Map();
      actorUsageBySession.set(sid, byActor);
    }
    byActor.set(actorKey, record);
    broadcastSse("femo_actor_usage", { sid, actorKey, ...record });
  };
  const captureActorUsage = (event) => {
    if (event.type === "request/context") {
      const d = event.data ?? {};
      if (typeof d.provider === "string") usageCurrent.provider = d.provider;
      if (typeof d.model === "string") usageCurrent.model = d.model;
      if (typeof d.contextWindow === "number" && d.contextWindow > 0) usageCurrent.contextWindow = d.contextWindow;
      return;
    }
    const data = event.data ?? {};
    const usage = event.type === "assistant/chunk" && data.chunk?.type === "usage" ? data.chunk.usage : event.type === "assistant/message" ? data.usage : void 0;
    if (usage === void 0 || typeof usage !== "object") return;
    const u = usage;
    const input = typeof u.inputTokens === "number" ? u.inputTokens : 0;
    const cacheRead = typeof u.cacheReadTokens === "number" ? u.cacheReadTokens : 0;
    const cacheWrite = typeof u.cacheWriteTokens === "number" ? u.cacheWriteTokens : 0;
    usageCurrent.usedTokens = input + cacheRead + cacheWrite;
    publishActorUsage();
  };
  const persistActorUsage = () => {
    if (usageCurrent.usedTokens === void 0) return;
    const record = {
      provider: usageCurrent.provider ?? "",
      model: usageCurrent.model ?? "",
      contextWindow: usageCurrent.contextWindow ?? ACTOR_CONTEXT_WINDOW_FALLBACK,
      usedTokens: usageCurrent.usedTokens,
      updatedAt: Date.now()
    };
    void mergeActorUsageFile(resolved.femoRoot, sid, actorKey, record).catch((error) => {
      console.log(`[femo-plugin] write actor-usage failed: ${String(error)}`);
    });
  };
  const showprompt = nodeName.length > 0 ? nodeShowprompts.get(nodeName) : void 0;
  const scopeInfo = Array.isArray(request.scope_info) ? request.scope_info.filter((x) => typeof x === "string") : void 0;
  let windows = projections.get(sid);
  if (windows === void 0) {
    const headerCwd = session.header?.cwd;
    if (headerCwd === void 0 || headerCwd.length === 0) {
      throw new Error(`session ${sid} cwd missing \u2014 projection windows cannot be ensured (process.cwd() fallback forbidden)`);
    }
    windows = await projections.ensure(sid, scopeInfo ?? [], headerCwd);
  }
  await sectionGate.waitActorFlush(sid, actorKey);
  const baseTurn = (turnBaseBySession.get(sid) ?? TURN_BASE_EPOCH) + 1;
  turnBaseBySession.set(sid, baseTurn + 100);
  sectionGate.begin(sid, baseTurn, actorKey);
  projectionAppend(windows, "femo-plugin/chat", {
    kind: "live",
    actor,
    turn: baseTurn,
    ...scopeInfo === void 0 ? {} : { visible: scopeInfo },
    seq: Date.now()
  }, void 0, scopeInfo);
  let speakerWritten = false;
  const appendSpeakerLine = () => {
    if (speakerWritten || windows === void 0) return;
    speakerWritten = true;
    mirrorBuffer.push({
      type: "femo-plugin/chat",
      data: {
        kind: "speaker",
        actor,
        text: actor,
        // 【V5】显式 turn 归属：speaker 事件不再由 femoChat 独立渲染（无
        // turn 的旧数据除外），而是作为 femo-turn-head 节点的 actor 数据源——
        // 渲染位由 head 的动态 anchor 决定（恒贴自己段落头），与本事件物理
        // seq 无关。
        turn: baseTurn,
        ...scopeInfo === void 0 ? {} : { visible: scopeInfo },
        seq: Date.now()
      },
      surface: void 0
    });
  };
  let showpromptWritten = false;
  const appendShowpromptLine = () => {
    if (showpromptWritten || windows === void 0 || showprompt === void 0) return;
    showpromptWritten = true;
    mirrorBuffer.push({
      type: "femo-plugin/chat",
      data: {
        kind: "prompt",
        text: `\u{1F4E2} ${showprompt}`,
        turn: baseTurn,
        ...scopeInfo === void 0 ? {} : { visible: scopeInfo },
        seq: Date.now()
      },
      surface: void 0
    });
  };
  const mapTurn = (_childTurn) => baseTurn;
  const mirrorBuffer = [];
  const toolNamesByCallId = /* @__PURE__ */ new Map();
  const flushMirrorBuffer = () => {
    if (mirrorBuffer.length === 0) return;
    const pending2 = mirrorBuffer.splice(0);
    for (const item of pending2) {
      projectionAppend(windows, item.type, item.data, item.surface, scopeInfo);
    }
  };
  let sectionReleased = false;
  let lastErrorReason;
  const releaseSection = () => {
    if (sectionReleased) return;
    sectionReleased = true;
    sectionGate.commit(sid, baseTurn, actorKey, () => {
      if (lastErrorReason !== void 0) {
        mirrorBuffer.push({
          type: "femo-plugin/chat",
          data: {
            kind: "error",
            actor,
            text: `\u26A0\uFE0F \u672C\u8F6E\u8FD0\u884C\u5931\u8D25\uFF1A${lastErrorReason.message}${lastErrorReason.code ? `\uFF08${lastErrorReason.code}\uFF09` : ""}`,
            turn: baseTurn,
            seq: Date.now()
          },
          surface: void 0
        });
      }
      mirrorBuffer.push({ type: "turn/end", data: { turn: baseTurn, reason: { kind: "completed" } }, surface: void 0 });
      flushMirrorBuffer();
      broadcastSse("femo_stream", { kind: "end", sid: String(session.id), node_name: nodeName, actor, turn: baseTurn });
    });
  };
  let turnStarted = false;
  let currentStep = -1;
  const ensureTurnStart = () => {
    if (turnStarted) return;
    const dup = dedupeIndexFor(session).structKeys.has(`turn/start:${baseTurn}`);
    if (dup) {
      turnStarted = true;
      return;
    }
    turnStarted = true;
    mirrorBuffer.push({ type: "turn/start", data: { turn: baseTurn }, surface: void 0 });
    let scopes = turnScopesBySession.get(sid);
    if (scopes === void 0) {
      scopes = /* @__PURE__ */ new Map();
      turnScopesBySession.set(sid, scopes);
    }
    scopes.set(baseTurn, scopeInfo ?? []);
    void writeTurnScopeFile(resolved.femoRoot, sid, scopes).catch((error) => {
      console.log(`[femo-plugin] write turn-scope file failed: ${String(error)}`);
    });
  };
  const ensureStepStart = (step) => {
    if (currentStep === step) return;
    let dup = false;
    if (windows.god !== void 0) {
      dup = dedupeIndexFor(windows.god).structKeys.has(`step/start:${baseTurn}:${step}`);
    }
    if (dup) {
      currentStep = step;
      return;
    }
    currentStep = step;
    ensureTurnStart();
    mirrorBuffer.push({ type: "step/start", data: { turn: baseTurn, step }, surface: void 0 });
  };
  const onChildEvent = (watched, watchedEvent) => {
    if (String(watched.id) !== String(run.id)) return;
    armIdle();
    captureActorUsage(watchedEvent);
    const isChunk = watchedEvent.type === "assistant/chunk";
    if (!FORWARD_CHILD_EVENTS.has(watchedEvent.type) && !isChunk) return;
    const chunkWrap = isChunk ? watchedEvent.data : void 0;
    const chunk = chunkWrap?.chunk;
    const sid0 = String(session.id);
    const raw = watchedEvent.data ?? {};
    const mappedTurn = mapTurn(raw.turn);
    const mappedStep = typeof raw.step === "number" ? raw.step : 0;
    if (watchedEvent.type === "turn/start" || isChunk || watchedEvent.type === "assistant/message" || watchedEvent.type === "step/end" || watchedEvent.type === "step/start") {
      ensureTurnStart();
      if (watchedEvent.type !== "turn/start") ensureStepStart(mappedStep);
    }
    if (isChunk && chunk !== void 0) {
      const sid02 = String(session.id);
      if (chunk.type === "text-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
        broadcastSse("ai_token", { node_name: nodeName, actor, token: chunk.text });
        broadcastSse("femo_stream", { kind: "delta", sid: sid02, node_name: nodeName, actor, blockKind: "text", index: chunk.index, step: mappedStep, text: chunk.text });
      } else if (chunk.type === "reasoning-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
        broadcastSse("femo_stream", { kind: "delta", sid: sid02, node_name: nodeName, actor, blockKind: "reasoning", index: chunk.index, step: mappedStep, text: chunk.text });
      } else if (chunk.type === "tool-call-delta") {
        const name2 = typeof chunk.name === "string" && chunk.name.length > 0 ? chunk.name : void 0;
        const argsDelta = typeof chunk.argumentsDelta === "string" ? chunk.argumentsDelta : "";
        if (name2 !== void 0 || argsDelta.length > 0) {
          broadcastSse("femo_stream", {
            kind: "delta",
            sid: sid02,
            node_name: nodeName,
            actor,
            blockKind: "toolcall",
            index: chunk.index,
            step: mappedStep,
            ...name2 !== void 0 ? { name: name2 } : {},
            text: argsDelta
          });
        }
      } else if (chunk.type === "block-start" && (chunk.blockType === "text" || chunk.blockType === "reasoning")) {
        broadcastSse("femo_stream", { kind: "start", sid: sid02, node_name: nodeName, actor, blockKind: chunk.blockType, index: chunk.index, step: mappedStep });
      } else if (chunk.type === "block-end" && (chunk.block?.type === "text" || chunk.block?.type === "reasoning" || chunk.block?.type === "tool-call")) {
        broadcastSse("femo_stream", {
          kind: "block_end",
          sid: sid02,
          node_name: nodeName,
          actor,
          index: chunk.index,
          step: mappedStep,
          retain: true,
          blockKind: chunk.block?.type === "tool-call" ? "toolcall" : chunk.block?.type
        });
      }
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
      broadcastSse("femo_stream", {
        kind: "tool_result",
        sid: sid0,
        node_name: nodeName,
        actor,
        step: mappedStep,
        ...name2 !== void 0 ? { name: name2 } : {},
        text: text.length > 2e3 ? `${text.slice(0, 2e3)}\u2026` : text
      });
    }
    if (!FORWARD_CHILD_EVENTS.has(watchedEvent.type)) return;
    if (isChunk) {
      if (chunk?.type !== "block-start" && chunk?.type !== "block-end") return;
    }
    appendSpeakerLine();
    appendShowpromptLine();
    const structural = watchedEvent.type === "turn/start" || watchedEvent.type === "turn/end" || watchedEvent.type === "step/start" || watchedEvent.type === "step/end";
    const data = structural ? { ...raw } : { ...raw, _srcSeq: `${String(run.id)}#${Number(watchedEvent.seq)}` };
    if ("turn" in data) data.turn = mappedTurn;
    if ("step" in data && typeof data.step === "number") data.step = data.step;
    if (watchedEvent.type === "turn/end") {
      const reason = raw.reason;
      if (reason?.kind === "error") {
        lastErrorReason = {
          message: typeof reason.error?.message === "string" ? reason.error.message : "",
          code: typeof reason.error?.code === "string" ? reason.error.code : ""
        };
      } else {
        lastErrorReason = void 0;
      }
      return;
    }
    const surfaceOp = SURFACE_OP_EVENTS.has(watchedEvent.type) ? { surfaceOp: "append" } : void 0;
    if (BUFFERED_CHILD_EVENTS.has(watchedEvent.type) || watchedEvent.type === "turn/start" || watchedEvent.type === "step/start") {
      mirrorBuffer.push({ type: watchedEvent.type, data, surface: surfaceOp });
    } else {
      projectionAppend(windows, watchedEvent.type, data, surfaceOp, scopeInfo);
    }
  };
  const disposeListener = ctx.on("session/event", onChildEvent);
  const modelIdNow = () => {
    const actualProvider = typeof usageCurrent.provider === "string" ? usageCurrent.provider : "";
    const actualModel = typeof usageCurrent.model === "string" ? usageCurrent.model : "";
    return actualProvider && actualModel ? `${actualProvider}/${actualModel}` : actualModel || actualProvider || "";
  };
  try {
    const result = await run.result;
    let output = typeof result.output === "string" ? result.output : "";
    let steps = [];
    if (run.localAgent !== void 0) {
      const built = buildTranscript(readSessionEvents(run.localAgent.session));
      steps = built.steps;
      if (output.length === 0 && built.output.length > 0) output = built.output;
    }
    if (steps.length === 0 && output.length > 0) {
      steps = [{ step: 0, cot: "", reply: output, tool_calls: [], tool_results: [] }];
    }
    const runControlAbort = runControlAborted.has(controller);
    if (!runControlAbort && result.stopReason !== "completed" && result.stopReason !== "max-tokens") {
      recordError(session.id, `\u5B50 agent \u7ED3\u675F\u5F02\u5E38\uFF1A${result.stopReason}`);
    }
    let submitFailure = false;
    if (!runControlAbort && output.length === 0 && steps.length === 0 && result.stopReason !== "completed" && result.stopReason !== "max-tokens") {
      submitFailure = true;
      await sendActorFailure(
        bridge,
        jobId,
        waitKey,
        "executor_error",
        `\u5B50 agent \u5F02\u5E38\u7ED3\u675F\uFF08stop=${result.stopReason}\uFF09\u4E14\u65E0\u4EFB\u4F55\u4EA7\u51FA`
      ).catch(() => void 0);
    }
    if (!runControlAbort && !submitFailure) {
      await bridge.send("human_input", {
        job_id: jobId,
        wait_key: waitKey,
        body: { output, steps, model_id: modelIdNow() }
      });
    }
    console.log(`[femo-plugin] subagent done: ${String(request.node_name ?? "")} stop=${result.stopReason} output=${output.length}ch steps=${steps.length}`);
    if (output.length > 0) {
      console.log(`[femo-plugin] subagent output head: ${output.slice(0, 300).replace(/\n/g, "\\n")}`);
    }
    if (!runControlAbort) {
      if (idleTimer !== void 0) {
        clearTimeout(idleTimer);
        idleTimer = void 0;
      }
      let verdict = await broker.park(waitKey);
      while (verdict.kind === "retry") {
        armIdle();
        const childAgent = run.localAgent;
        if (childAgent === void 0) {
          await sendActorFailure(bridge, jobId, waitKey, "executor_gone", "\u91CD\u8BD5\u8F6E\u65E0\u53EF\u6267\u884C\u4F53\uFF08localAgent \u7F3A\u5931\uFF09\uFF0C\u65E0\u6CD5\u7EED\u7B54").catch(() => void 0);
          break;
        }
        const snapshotLen = readSessionEvents(childAgent.session).length;
        broadcastSse("femo_stream", { kind: "end", sid: String(session.id), node_name: nodeName, actor, turn: baseTurn });
        broker.steerLease(waitKey, RETRY_STEER_TEXT(verdict.attempt, verdict.feedback));
        const cleanupFns = [];
        const abortPromise = new Promise((resolve2) => {
          const onAbort = () => resolve2();
          controller.signal.addEventListener("abort", onAbort, { once: true });
          cleanupFns.push(() => controller.signal.removeEventListener("abort", onAbort));
        });
        const turnTimeoutPromise = new Promise((resolve2) => {
          const t = setTimeout(resolve2, RETRY_TURN_TIMEOUT_MS);
          cleanupFns.push(() => clearTimeout(t));
        });
        await Promise.race([childAgent.whenIdle?.() ?? Promise.resolve(), turnTimeoutPromise, abortPromise]);
        cleanupFns.forEach((fn) => fn());
        const retryEvents = readSessionEvents(childAgent.session).slice(snapshotLen);
        const built = buildTranscript(retryEvents);
        if (!retryEvents.some((e) => e.type === "turn/end") && built.steps.length === 0 && built.output.length === 0) {
          console.log(`[femo-plugin] \u8282\u70B9\u91CD\u8BD5\u56DE\u5408\u672A\u89C2\u6D4B\u5230 turn/end \u4E14\u96F6\u4EA7\u51FA\uFF08node=${nodeName}\uFF09\uFF0C\u4E0A\u62A5\u6267\u884C\u4F53\u5931\u8D25`);
          await sendActorFailure(bridge, jobId, waitKey, "turn_timeout", "\u91CD\u8BD5\u56DE\u5408\u8D85\u65F6\u4E14\u96F6\u4EA7\u51FA").catch(() => void 0);
          break;
        }
        output = built.output;
        steps = built.steps.length > 0 ? built.steps : [{ step: 0, cot: "", reply: output, tool_calls: [], tool_results: [] }];
        await bridge.send("human_input", { job_id: jobId, wait_key: waitKey, body: { output, steps, model_id: modelIdNow() } });
        if (idleTimer !== void 0) {
          clearTimeout(idleTimer);
          idleTimer = void 0;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runControlAborted.has(controller)) {
      console.log(`[femo-plugin] subagent stopped by run-control: ${String(request.node_name ?? "")} ${message}`);
    } else {
      recordError(session.id, `\u5B50 agent \u4E2D\u65AD\uFF1A${message}`);
      console.log(`[femo-plugin] subagent interrupted: ${String(request.node_name ?? "")} ${message}`);
      await sendActorFailure(bridge, jobId, waitKey, "executor_error", message).catch((sendError) => {
        console.log(`[femo-plugin] \u6267\u884C\u5931\u8D25\u4FE1\u53F7\u56DE\u4F20\u5931\u8D25: ${String(sendError)}`);
      });
    }
  } finally {
    activeSubagents.delete(activeEntry);
    activeChildRuns.delete(String(run.id));
    broker.unregister(waitKey);
    apiRetry.clearChild(String(run.id));
    persistActorUsage();
    appendSpeakerLine();
    appendShowpromptLine();
    releaseSection();
    if (idleTimer !== void 0) clearTimeout(idleTimer);
    disposeListener();
    await run.dispose();
    console.log(`[femo-plugin] subagent disposed: ${String(request.node_name ?? "")}`);
    if (!isNativeMode()) {
      const registry = ctx.get("workspaceRegistry");
      if (registry?.archiveSession !== void 0) {
        try {
          await registry.archiveSession(String(run.id));
          console.log(`[femo-plugin] archived child session ${run.id}`);
        } catch (error) {
          console.log(`[femo-plugin] archive child session failed: ${String(error)}`);
        }
      }
      await moveChildSessionOut(ctx, resolved, run).catch((error) => {
        console.log(`[femo-plugin] move child session failed: ${String(error)}`);
      });
    }
  }
}

// host/subagent-native.ts
import { SessionId as SessionId3 } from "@deepseek-ai/dsh-session";
import { randomUUID as randomUUID2 } from "node:crypto";

// host/stream-frames.ts
var frameTraceSeen = /* @__PURE__ */ new Map();
function traceFrame(kind, base, extra2) {
  const key = [kind, base.actor, base.turn === void 0 ? "-" : t4(base.turn), base.step ?? "-", base.node_name].join("|");
  const n = frameTraceSeen.get(key) ?? 0;
  frameTraceSeen.set(key, n + 1);
  if (n > 0) return;
  projTrace("frame", `\u51FA\u5E27 kind=${kind} sid=${base.sid.slice(-8)} actor=${base.actor} turn=${base.turn === void 0 ? "(\u65E0)" : t4(base.turn)} step=${base.step ?? "-"} node=${base.node_name || "-"}${extra2 === void 0 ? "" : ` ${extra2}`}`);
}
var EMIT_LOG_CAP = 4e3;
var emitLogCount = 0;
function traceEmit(kind, base) {
  if (emitLogCount >= EMIT_LOG_CAP) return;
  emitLogCount += 1;
  projTrace("emit", `emit#${emitLogCount} ${kind} actor=${base.actor} turn=${base.turn === void 0 ? "-" : t4(base.turn)} sid=${base.sid.slice(-8)}`);
}
function broadcastStreamChunk(base, chunk) {
  if (chunk.type === "text-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
    traceFrame("delta-text", base, `len=${chunk.text.length} idx=${chunk.index ?? "-"}`);
    traceEmit("delta-text", base);
    broadcastSse("femo_stream", { kind: "delta", ...base, blockKind: "text", index: chunk.index, text: chunk.text });
  } else if (chunk.type === "reasoning-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
    traceFrame("delta-reasoning", base, `len=${chunk.text.length} idx=${chunk.index ?? "-"}`);
    broadcastSse("femo_stream", { kind: "delta", ...base, blockKind: "reasoning", index: chunk.index, text: chunk.text });
  } else if (chunk.type === "tool-call-delta") {
    const name2 = typeof chunk.name === "string" && chunk.name.length > 0 ? chunk.name : void 0;
    const argsDelta = typeof chunk.argumentsDelta === "string" ? chunk.argumentsDelta : "";
    if (name2 !== void 0 || argsDelta.length > 0) {
      traceFrame("delta-tool", base, `name=${name2 ?? "-"}`);
      broadcastSse("femo_stream", {
        kind: "delta",
        ...base,
        blockKind: "toolcall",
        index: chunk.index,
        ...name2 !== void 0 ? { name: name2 } : {},
        text: argsDelta
      });
    }
  } else if (chunk.type === "block-start" && (chunk.blockType === "text" || chunk.blockType === "reasoning")) {
    traceFrame(`block-start-${chunk.blockType}`, base, `idx=${chunk.index ?? "-"}`);
    broadcastSse("femo_stream", { kind: "start", ...base, blockKind: chunk.blockType, index: chunk.index });
  } else if (chunk.type === "block-end" && (chunk.block?.type === "text" || chunk.block?.type === "reasoning" || chunk.block?.type === "tool-call")) {
    traceFrame(`block-end-${chunk.block?.type}`, base, `idx=${chunk.index ?? "-"}`);
    traceEmit(`block-end-${chunk.block?.type}`, base);
    broadcastSse("femo_stream", {
      kind: "block_end",
      ...base,
      index: chunk.index,
      retain: true,
      blockKind: chunk.block?.type === "tool-call" ? "toolcall" : chunk.block?.type
    });
  }
}
function clearLiveBucket(base) {
  traceFrame("clear", base, "(\u6E05\u6876\u5E27\uFF0C\u5E26\u8F6E\u53F7\u65F6\u53EA\u6E05\u672C\u8F6E\u7684\u4F4D)");
  traceEmit("clear", base);
  broadcastSse("femo_stream", {
    kind: "end",
    sid: base.sid,
    node_name: base.node_name,
    actor: base.actor,
    ...base.turn === void 0 ? {} : { turn: base.turn }
  });
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
      traceFrame("attempt-start", this.base, `orphan \u6E05\u7406=${String(this.orphan)}`);
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
    traceFrame("turn-status-off", this.base);
    this.broadcastTurnStatus(false);
  }
  /** 状态帧（前端按直播位点亮/熄灭「Deep diving…」）。【2026-09-11 v8】带上
   *  轮号：状态行与内容同属一轮，必须落进同一个轮次位——否则状态行退化成
   *  "按演员"的老位置，会画不出或画到别的块上。 */
  broadcastTurnStatus(running) {
    traceFrame(running ? "turn-status-on" : "turn-status-off", this.base);
    traceEmit(running ? "turn-status-on" : "turn-status-off", this.base);
    broadcastSse("femo_stream", {
      kind: "turn_status",
      running,
      sid: this.base.sid,
      node_name: this.base.node_name,
      actor: this.base.actor,
      ...this.base.turn === void 0 ? {} : { turn: this.base.turn }
    });
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

// host/subagent-native.ts
var actorChildren = /* @__PURE__ */ new Map();
function actorRegistryKey(sid, jobId, actorKey) {
  return `${sid}\0j${jobId}\0${actorKey}`;
}
var actorTurnLocks = /* @__PURE__ */ new Map();
function nativeChildId(sid, jobId, actorKey) {
  return `femo-actor-j${jobId}-${sid}-${actorKey}`;
}
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
  const requestAiName = typeof request.ai_name === "string" && request.ai_name.length > 0 ? request.ai_name : void 0;
  const actor = requestAiName ?? nodeActors.get(nodeName) ?? nodeName;
  const actorKey = projectionActorKey(actor);
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
  let idleTimer;
  const armIdle = () => {
    if (idleTimer !== void 0) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      interruptRef.fn?.();
      controller.abort(new Error(`\u5B50 agent \u7A7A\u95F2\u8D85\u65F6\uFF08${Math.round(resolved.subagentIdleTimeoutMs / 1e3)}s \u65E0\u8F93\u51FA\uFF09`));
    }, resolved.subagentIdleTimeoutMs);
  };
  projTrace("node", `\u8282\u70B9\u5F00\u8DD1 node=${nodeName} actor=${actor} waitKey=${waitKey} job=${jobId}`);
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
  projTrace("node", `\u5206\u914D\u8F6E\u53F7 node=${nodeName} actor=${actor} turn=${t4(baseTurn)}\uFF08\u4E0B\u4E00\u8F6E\u57FA\u6570=${t4(baseTurn + 100)}\uFF09`);
  await sectionGate.waitActorFlush(sid, actorKey);
  sectionGate.begin(sid, baseTurn, actorKey);
  const scopeInfo = Array.isArray(request.scope_info) ? request.scope_info.filter((x) => typeof x === "string") : void 0;
  let windowsOrUndefined = projections.get(sid);
  if (windowsOrUndefined === void 0) {
    const headerCwd = session.header?.cwd;
    if (headerCwd === void 0 || headerCwd.length === 0) {
      activeSubagents.delete(activeEntry);
      releaseLock();
      sectionGate.commit(sid, baseTurn, actorKey, () => {
      });
      throw new Error(`session ${sid} cwd missing \u2014 projection windows cannot be ensured (process.cwd() fallback forbidden)`);
    }
    windowsOrUndefined = await projections.ensure(sid, scopeInfo ?? [], headerCwd);
  }
  const windows = windowsOrUndefined;
  const showprompt = nodeName.length > 0 ? nodeShowprompts.get(nodeName) : void 0;
  projectionAppend(windows, "femo-plugin/chat", {
    kind: "live",
    actor,
    turn: baseTurn,
    ...showprompt === void 0 ? {} : { showprompt },
    ...scopeInfo === void 0 ? {} : { visible: scopeInfo },
    seq: Date.now()
  }, void 0, scopeInfo);
  projTrace("node", `\u5199\u5F00\u8F6E\u951A\u70B9(live) actor=${actor} turn=${t4(baseTurn)} node=${nodeName}`);
  const mapTurn = (_childTurn) => baseTurn;
  let speakerWritten = false;
  const appendSpeakerLine = () => {
    if (speakerWritten) return;
    speakerWritten = true;
    mirrorBuffer.push({
      type: "femo-plugin/chat",
      data: {
        kind: "speaker",
        actor,
        text: actor,
        turn: baseTurn,
        ...scopeInfo === void 0 ? {} : { visible: scopeInfo },
        seq: Date.now()
      },
      surface: void 0
    });
  };
  let showpromptWritten = false;
  const appendShowpromptLine = () => {
    if (showpromptWritten || showprompt === void 0) return;
    showpromptWritten = true;
    mirrorBuffer.push({
      type: "femo-plugin/chat",
      data: {
        kind: "prompt",
        text: `\u{1F4E2} ${showprompt}`,
        turn: baseTurn,
        ...scopeInfo === void 0 ? {} : { visible: scopeInfo },
        seq: Date.now()
      },
      surface: void 0
    });
  };
  const mirrorBuffer = [];
  const toolNamesByCallId = /* @__PURE__ */ new Map();
  const flushMirrorBuffer = () => {
    if (mirrorBuffer.length === 0) return;
    const pending2 = mirrorBuffer.splice(0);
    for (const item of pending2) {
      projectionAppend(windows, item.type, item.data, item.surface, scopeInfo);
    }
  };
  let sectionReleased = false;
  let lastErrorReason;
  const releaseSection = () => {
    if (sectionReleased) return;
    sectionReleased = true;
    projTrace("node", `\u6BB5\u843D\u91CA\u653E(commit) actor=${actor} turn=${t4(baseTurn)} node=${nodeName} \u7F13\u51B2\u884C\u6570=${mirrorBuffer.length}`);
    sectionGate.commit(sid, baseTurn, actorKey, () => {
      if (lastErrorReason !== void 0) {
        mirrorBuffer.push({
          type: "femo-plugin/chat",
          data: {
            kind: "error",
            actor,
            text: `\u26A0\uFE0F \u672C\u8F6E\u8FD0\u884C\u5931\u8D25\uFF1A${lastErrorReason.message}${lastErrorReason.code ? `\uFF08${lastErrorReason.code}\uFF09` : ""}`,
            turn: baseTurn,
            seq: Date.now()
          },
          surface: void 0
        });
      }
      mirrorBuffer.push({ type: "turn/end", data: { turn: baseTurn, reason: { kind: "completed" } }, surface: void 0 });
      flushMirrorBuffer();
      projTrace("node", `\u843D\u76D8\u5B8C\u6210 actor=${actor} turn=${t4(baseTurn)} \u2192 \u53D1\u6E05\u6876\u5E27(\u95ED\u8F6E)`);
      broadcastSse("femo_stream", { kind: "end", sid, node_name: nodeName, actor, turn: baseTurn });
    });
  };
  const usageCurrent = {};
  const usageRecord = () => ({
    provider: usageCurrent.provider ?? "",
    model: usageCurrent.model ?? "",
    contextWindow: usageCurrent.contextWindow ?? 1e6,
    usedTokens: usageCurrent.usedTokens ?? 0,
    updatedAt: Date.now()
  });
  const publishActorUsage = () => {
    if (usageCurrent.usedTokens === void 0) return;
    let byActor = actorUsageBySession.get(sid);
    if (byActor === void 0) {
      byActor = /* @__PURE__ */ new Map();
      actorUsageBySession.set(sid, byActor);
    }
    byActor.set(actorKey, usageRecord());
    broadcastSse("femo_actor_usage", { sid, actorKey, ...usageRecord() });
  };
  const applyUsage = (usage) => {
    if (usage === void 0 || typeof usage !== "object") return;
    const u = usage;
    usageCurrent.usedTokens = (typeof u.inputTokens === "number" ? u.inputTokens : 0) + (typeof u.cacheReadTokens === "number" ? u.cacheReadTokens : 0) + (typeof u.cacheWriteTokens === "number" ? u.cacheWriteTokens : 0);
    publishActorUsage();
  };
  const captureActorUsage = (event) => {
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
  const persistActorUsage = () => {
    if (usageCurrent.usedTokens === void 0) return;
    void mergeActorUsageFile(resolved.femoRoot, sid, actorKey, usageRecord()).catch((error) => {
      console.log(`[femo-plugin][native] write actor-usage failed: ${String(error)}`);
    });
  };
  const settledTurns = [];
  let baselineCount = 0;
  const childTurnEvents = /* @__PURE__ */ new Map();
  const allChildEvents = [];
  const pendingTurn = { slot: [] };
  const resolvePendingTurn = (turn) => {
    const waiter = pendingTurn.slot.shift();
    if (waiter === void 0) return;
    waiter.resolve(turn);
  };
  const rejectPendingTurn = (error) => {
    for (const waiter of pendingTurn.slot.splice(0)) waiter.reject(error);
  };
  const waitTurnAfterBaseline = () => {
    if (settledTurns.length > baselineCount) {
      return Promise.resolve(settledTurns[baselineCount]);
    }
    return new Promise((resolve2, reject) => {
      pendingTurn.slot.push({ resolve: resolve2, reject });
    });
  };
  let turnStarted = false;
  let currentStep = -1;
  const ensureTurnStart = () => {
    if (turnStarted) return;
    const dup = dedupeIndexFor(session).structKeys.has(`turn/start:${baseTurn}`);
    if (dup) {
      turnStarted = true;
      return;
    }
    turnStarted = true;
    mirrorBuffer.push({ type: "turn/start", data: { turn: baseTurn }, surface: void 0 });
    let scopes = turnScopesBySession.get(sid);
    if (scopes === void 0) {
      scopes = /* @__PURE__ */ new Map();
      turnScopesBySession.set(sid, scopes);
    }
    scopes.set(baseTurn, scopeInfo ?? []);
    void writeTurnScopeFile(resolved.femoRoot, sid, scopes).catch((error) => {
      console.log(`[femo-plugin][native] write turn-scope file failed: ${String(error)}`);
    });
  };
  const ensureStepStart = (step) => {
    if (currentStep === step) return;
    let dup = false;
    if (windows.god !== void 0) {
      dup = dedupeIndexFor(windows.god).structKeys.has(`step/start:${baseTurn}:${step}`);
    }
    if (dup) {
      currentStep = step;
      return;
    }
    currentStep = step;
    ensureTurnStart();
    mirrorBuffer.push({ type: "step/start", data: { turn: baseTurn, step }, surface: void 0 });
  };
  const childIdRef = { id: "" };
  const onChildEvent = (watched, watchedEvent) => {
    if (String(watched.id) !== childIdRef.id || childIdRef.id === "") return;
    armIdle();
    captureActorUsage(watchedEvent);
    allChildEvents.push(watchedEvent);
    const rawTurn0 = watchedEvent.data ?? {};
    if (typeof rawTurn0.turn === "number") {
      let bucket = childTurnEvents.get(rawTurn0.turn);
      if (bucket === void 0) {
        bucket = [];
        childTurnEvents.set(rawTurn0.turn, bucket);
      }
      bucket.push(watchedEvent);
      if (watchedEvent.type === "turn/end") {
        settledTurns.push(rawTurn0.turn);
        resolvePendingTurn(rawTurn0.turn);
      }
    }
    if (!FORWARD_CHILD_EVENTS.has(watchedEvent.type) && watchedEvent.type !== "assistant/chunk") return;
    const isChunk = watchedEvent.type === "assistant/chunk";
    const chunkWrap = isChunk ? watchedEvent.data : void 0;
    const chunk = chunkWrap?.chunk;
    const raw = watchedEvent.data ?? {};
    const mappedTurn = mapTurn(raw.turn);
    const mappedStep = typeof raw.step === "number" ? raw.step : 0;
    if (watchedEvent.type === "turn/start" || isChunk || watchedEvent.type === "assistant/message" || watchedEvent.type === "step/end" || watchedEvent.type === "step/start") {
      ensureTurnStart();
      if (watchedEvent.type !== "turn/start") ensureStepStart(mappedStep);
    }
    if (isChunk && chunk !== void 0) {
      if (chunk.type === "text-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
        broadcastSse("ai_token", { node_name: nodeName, actor, token: chunk.text });
        broadcastSse("femo_stream", { kind: "delta", sid, node_name: nodeName, actor, blockKind: "text", index: chunk.index, step: mappedStep, text: chunk.text });
      } else if (chunk.type === "reasoning-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
        broadcastSse("femo_stream", { kind: "delta", sid, node_name: nodeName, actor, blockKind: "reasoning", index: chunk.index, step: mappedStep, text: chunk.text });
      } else if (chunk.type === "tool-call-delta") {
        const name2 = typeof chunk.name === "string" && chunk.name.length > 0 ? chunk.name : void 0;
        const argsDelta = typeof chunk.argumentsDelta === "string" ? chunk.argumentsDelta : "";
        if (name2 !== void 0 || argsDelta.length > 0) {
          broadcastSse("femo_stream", {
            kind: "delta",
            sid,
            node_name: nodeName,
            actor,
            blockKind: "toolcall",
            index: chunk.index,
            step: mappedStep,
            ...name2 !== void 0 ? { name: name2 } : {},
            text: argsDelta
          });
        }
      } else if (chunk.type === "block-start" && (chunk.blockType === "text" || chunk.blockType === "reasoning")) {
        broadcastSse("femo_stream", { kind: "start", sid, node_name: nodeName, actor, blockKind: chunk.blockType, index: chunk.index, step: mappedStep });
      } else if (chunk.type === "block-end" && (chunk.block?.type === "text" || chunk.block?.type === "reasoning" || chunk.block?.type === "tool-call")) {
        broadcastSse("femo_stream", {
          kind: "block_end",
          sid,
          node_name: nodeName,
          actor,
          index: chunk.index,
          step: mappedStep,
          retain: true,
          blockKind: chunk.block?.type === "tool-call" ? "toolcall" : chunk.block?.type
        });
      }
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
      broadcastSse("femo_stream", {
        kind: "tool_result",
        sid,
        node_name: nodeName,
        actor,
        step: mappedStep,
        ...name2 !== void 0 ? { name: name2 } : {},
        text: text.length > 2e3 ? `${text.slice(0, 2e3)}\u2026` : text
      });
    }
    if (!FORWARD_CHILD_EVENTS.has(watchedEvent.type)) return;
    if (isChunk) {
      if (chunk?.type !== "block-start" && chunk?.type !== "block-end") return;
    }
    appendSpeakerLine();
    appendShowpromptLine();
    const structural = watchedEvent.type === "turn/start" || watchedEvent.type === "turn/end" || watchedEvent.type === "step/start" || watchedEvent.type === "step/end";
    let data = structural ? { ...raw } : { ...raw, _srcSeq: `${childIdRef.id}#${Number(watchedEvent.seq)}` };
    if ("turn" in data) data.turn = mappedTurn;
    if ("step" in data && typeof data.step === "number") data.step = data.step;
    if (watchedEvent.type === "turn/end") {
      const reason = raw.reason;
      if (reason?.kind === "error") {
        lastErrorReason = {
          message: typeof reason.error?.message === "string" ? reason.error.message : "",
          code: typeof reason.error?.code === "string" ? reason.error.code : ""
        };
      } else {
        lastErrorReason = void 0;
      }
      return;
    }
    const surfaceOp = SURFACE_OP_EVENTS.has(watchedEvent.type) ? { surfaceOp: "append" } : void 0;
    if (BUFFERED_CHILD_EVENTS.has(watchedEvent.type) || watchedEvent.type === "turn/start" || watchedEvent.type === "step/start") {
      mirrorBuffer.push({ type: watchedEvent.type, data, surface: surfaceOp });
    } else {
      projectionAppend(windows, watchedEvent.type, data, surfaceOp, scopeInfo);
    }
  };
  const disposeListener = ctx.on("session/event", onChildEvent);
  const liveFrames = new LiveStreamFrames(
    { sid, node_name: nodeName, actor, turn: baseTurn },
    (chunk) => {
      if (chunk.type === "usage") applyUsage(chunk.usage);
    }
  );
  const disposeFrameListener = onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === void 0 || childIdRef.id === "") return;
    if (String(agent?.id ?? agent?.session?.id ?? "") !== childIdRef.id) return;
    armIdle();
    projTrace("frame", `\u6536\u539F\u751F\u5E27 type=${frame.type ?? "-"} step=${String(frame.step ?? "-")} \u2192 \u76F4\u64AD\u4F4D actor=${actor} turn=${t4(baseTurn)}`);
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
      const childId2 = nativeChildId(sid, jobId, actorKey);
      childIdRef.id = childId2;
      const persistence = ctx.get("sessionPersistence");
      let persisted = false;
      try {
        persisted = await persistence?.stat?.(SessionId3(childId2)) !== void 0;
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
          childId: SessionId3(childId2),
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
    sectionGate.commit(sid, baseTurn, actorKey, () => {
    });
    throw error;
  }
  const childId = entry.childId;
  interruptRef.fn = () => {
    try {
      subagents.interrupt(SessionId3(childId), { kind: "user", parentSessionId: SessionId3(sid) });
    } catch {
    }
  };
  activeChildRuns.set(childId, { mainSid: sid, node: nodeName, jobId });
  const steerChild = (text) => {
    const live = ctx.agents.get(SessionId3(childId));
    if (live?.steer !== void 0) {
      const delivered = safeSteer(live, {
        id: randomUUID2(),
        role: "user",
        content: [{ type: "text", text }],
        source: { kind: "plugin", plugin: "femo-plugin" }
      }, `child ${childId}`);
      if (delivered) return;
    }
    void subagents.sendMessage(parent, SessionId3(childId), [{ type: "text", text }], { signal: controller.signal }).catch(() => void 0);
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
  const modelIdNow = () => {
    const actualProvider = typeof usageCurrent.provider === "string" ? usageCurrent.provider : "";
    const actualModel = typeof usageCurrent.model === "string" ? usageCurrent.model : "";
    return actualProvider && actualModel ? `${actualProvider}/${actualModel}` : actualModel || actualProvider || "";
  };
  const onAbortReject = () => {
    const reason = controller.signal.reason;
    rejectPendingTurn(reason instanceof Error ? reason : new Error(String(reason ?? "aborted")));
  };
  controller.signal.addEventListener("abort", onAbortReject);
  try {
    armIdle();
    if (!created) {
      const live = ctx.agents.get(SessionId3(childId));
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
      baselineCount = settledTurns.length;
      await subagents.sendMessage(parent, SessionId3(childId), [{ type: "text", text: prompt }], { signal: controller.signal });
      if (entry.hooked !== true) {
        setupChildAgent(ctx, childId, entry.reasoning, resolved, defaultModel, false);
        entry.hooked = true;
      }
    }
    console.log(`[femo-plugin][native] node dispatched to actor child ${childId}: node=${nodeName} created=${String(created)} reused=${String(!wasNew)}`);
    let output = "";
    let steps = [];
    const turnObserveFrom = allChildEvents.length;
    const firstTurn = await waitTurnAfterBaseline();
    const built = buildTranscript(childTurnEvents.get(firstTurn) ?? []);
    output = built.output;
    steps = built.steps;
    if (output.length === 0) {
      const live = ctx.agents.get(SessionId3(childId));
      output = live?.session !== void 0 ? buildTranscript(readSessionEvents(live.session)).output : "";
    }
    if (steps.length === 0 && output.length > 0) {
      steps = [{ step: 0, cot: "", reply: output, tool_calls: [], tool_results: [] }];
    }
    const firstTurnError = childTurnError(allChildEvents.slice(turnObserveFrom));
    if (firstTurnError !== void 0 && output.length === 0) {
      console.log(`[femo-plugin][native] \u5B50\u4EE3\u7406\u56DE\u5408\u4EE5 error \u6536\u573A\uFF08node=${nodeName}\uFF09\uFF1A${firstTurnError.detail}`);
      await sendActorFailure(bridge, jobId, waitKey, firstTurnError.kind, firstTurnError.detail);
      return;
    }
    await bridge.send("human_input", {
      job_id: jobId,
      wait_key: waitKey,
      body: { output, steps, model_id: modelIdNow() }
    });
    if (!runControlAborted.has(controller)) {
      if (idleTimer !== void 0) {
        clearTimeout(idleTimer);
        idleTimer = void 0;
      }
      let verdict = await broker.park(waitKey);
      while (verdict.kind === "retry") {
        armIdle();
        baselineCount = settledTurns.length;
        const snapshotLen = allChildEvents.length;
        broadcastSse("femo_stream", { kind: "end", sid, node_name: nodeName, actor, turn: baseTurn });
        projTrace("node", `\u8F6E\u5185\u91CD\u8BD5\u6E05\u6876 actor=${actor} turn=${t4(baseTurn)} attempt=${verdict.attempt}`);
        steerChild(RETRY_STEER_TEXT(verdict.attempt, verdict.feedback));
        const retryTurn = await waitTurnAfterBaseline();
        const retryEvents = allChildEvents.slice(snapshotLen);
        const builtRetry = buildTranscript(retryEvents.some((e) => e.type === "turn/end") ? childTurnEvents.get(retryTurn) ?? retryEvents : retryEvents);
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
        await bridge.send("human_input", { job_id: jobId, wait_key: waitKey, body: { output, steps, model_id: modelIdNow() } });
        if (idleTimer !== void 0) {
          clearTimeout(idleTimer);
          idleTimer = void 0;
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
    apiRetry.clearChild(childId);
    persistActorUsage();
    appendSpeakerLine();
    appendShowpromptLine();
    releaseSection();
    liveFrames.endTurn();
    if (idleTimer !== void 0) clearTimeout(idleTimer);
    controller.signal.removeEventListener("abort", onAbortReject);
    disposeListener();
    disposeFrameListener();
    rejectPendingTurn(new Error("node settled"));
    releaseLock();
    console.log(`[femo-plugin][native] subagent node settled (child kept alive): ${nodeName} child=${childId}`);
  }
}
function setupChildAgent(ctx, childId, reasoningHolder, resolved, defaultModel, policyAppends = true) {
  const agent = ctx.agents.get(SessionId3(childId));
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

// host/main-actor.ts
import { SessionId as SessionId4 } from "@deepseek-ai/dsh-session";

// host/main-delivery-queue.ts
var MainDeliveryQueue = class {
  /** 主会话最近一次 turn/start 记下的轮号（有轮在飞；turn/end 删条目）。 */
  open = /* @__PURE__ */ new Map();
  /** 排队中的交付件（FIFO，按会话）。 */
  queued = /* @__PURE__ */ new Map();
  /** turn/start：本会话有轮在飞。 */
  noteTurnStart(sid, turn) {
    this.open.set(sid, turn);
  }
  /** turn/end：轮收口（此后交付立即放行，直到下一次 turn/start）。 */
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
    let q = this.queued.get(sid);
    if (q === void 0) {
      q = [];
      this.queued.set(sid, q);
    }
    q.push(item);
    return false;
  }
  /** 队首只读（交付前窥视：等待期间被 drop/abandon 作废 → 自然不再交付）。 */
  peek(sid) {
    return this.queued.get(sid)?.[0];
  }
  /** 轮收口：取队首一条（无 → undefined）。一次只放一条——每节点各占一轮。 */
  takeNext(sid) {
    const q = this.queued.get(sid);
    if (q === void 0 || q.length === 0) return void 0;
    const next = q.shift();
    if (q.length === 0) this.queued.delete(sid);
    return next;
  }
  /** 作废本会话排队件（剧本停止/出错）：返回被丢弃条目——调用方负责 resolve
   *  其交卷槽，防 runMainModelTurnInner 悬挂在 `await answer`。轮开闭状态**不动**
   *  （用户可能还在说话；下一次 turn/start 自会刷新）。 */
  dropAll(sid) {
    const q = this.queued.get(sid);
    this.queued.delete(sid);
    return q ?? [];
  }
  /** 按条件剔除排队件（节点收尾兜底：等它的那个人已经走了——停靠超时/异常
   *  收场后再交付=对空气说话，还会拿旧 wait_key 去交卷）。返回被剔除条目。 */
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
  /** 彻底遗忘本会话（换场 flow_start / 插件卸载）：队列 + 轮开闭状态全清。 */
  forget(sid) {
    const dropped = this.dropAll(sid);
    this.open.delete(sid);
    return dropped;
  }
  /** 全清（HMR/插件卸载）。 */
  clear() {
    this.queued.clear();
    this.open.clear();
  }
};

// host/main-actor.ts
function debugLogMainActor(resolved, line) {
  appendDebugLog(
    resolved.femoRoot,
    "debug-main-actor.log",
    "[" + (/* @__PURE__ */ new Date()).toISOString() + "] " + line
  );
}
var MAIN_SURFACE_OP_EVENTS = /* @__PURE__ */ new Set(["assistant/message", "tool/result"]);
var pending = /* @__PURE__ */ new Map();
var deliveries = new MainDeliveryQueue();
var mainActorNames = /* @__PURE__ */ new Map();
var flows = /* @__PURE__ */ new Map();
var waterMarks = /* @__PURE__ */ new Map();
var playNames = /* @__PURE__ */ new Map();
var queues = /* @__PURE__ */ new Map();
function mainActorSceneActor(sid, turn) {
  const p = pending.get(sid);
  if (p === void 0 || p.settled) return void 0;
  if (p.turn !== void 0 && p.turn !== turn) return void 0;
  return p.actor;
}
function clearMainPlayState(sid, name2, mainActors) {
  pending.delete(sid);
  mainActorNames.delete(sid);
  flows.delete(sid);
  waterMarks.delete(sid);
  queues.delete(sid);
  dropMainDeliveries(sid, "\u6362\u573A\u6E05\u573A", void 0, true);
  if (name2.trim().length > 0) playNames.set(sid, name2.trim());
  else playNames.delete(sid);
  if (mainActors !== void 0 && mainActors.length > 0) {
    const set2 = /* @__PURE__ */ new Set();
    for (const n of mainActors) if (n.length > 0) set2.add(n);
    if (set2.size > 0) mainActorNames.set(sid, set2);
  }
}
function noteMainActor(sid, aiName) {
  if (aiName.length === 0) return;
  let set2 = mainActorNames.get(sid);
  if (set2 === void 0) {
    set2 = /* @__PURE__ */ new Set();
    mainActorNames.set(sid, set2);
  }
  set2.add(aiName);
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
function isMainAnswerPending(sid) {
  return pending.has(sid);
}
function pendingNodeName(sid) {
  return pending.get(sid)?.nodeName ?? "";
}
function rearmPending(sid, fields, resolve2) {
  pending.set(sid, {
    waitKey: fields.waitKey,
    nodeName: fields.nodeName,
    actor: fields.actor,
    jobId: fields.jobId,
    scopes: fields.scopes,
    buffer: [],
    sawTurnStart: false,
    settled: false,
    resolve: resolve2 ?? (() => {
    }),
    ...fields.showprompt !== void 0 ? { showprompt: fields.showprompt } : {},
    projBuffer: [],
    toolNames: /* @__PURE__ */ new Map()
  });
}
function deliverMain(ctx, sid, d) {
  rearmPending(sid, {
    waitKey: d.waitKey,
    nodeName: d.nodeName,
    actor: d.actor,
    scopes: d.scopes,
    jobId: d.jobId,
    ...d.showprompt !== void 0 ? { showprompt: d.showprompt } : {}
  }, d.resolve);
  steerMainAgent(ctx, sid, d.text);
}
function queueOrDeliverMain(ctx, resolved, sid, d) {
  if (deliveries.offer(sid, d)) {
    debugLogMainActor(resolved, `\u4EA4\u4ED8\u6CE8\u5165(via=${d.via}): node=${d.nodeName}\uFF08\u65E0\u5728\u98DE\u8F6E \u2192 \u7ACB\u5373 steer\uFF09`);
    deliverMain(ctx, sid, d);
    return;
  }
  const open2 = deliveries.openTurn(sid);
  const line = `\u6CE8\u5165\u6392\u961F(via=${d.via}): node=${d.nodeName} \u7B49\u4E3B\u4F1A\u8BDD\u7B2C ${open2 ?? "?"} \u8F6E\u6536\u53E3\uFF08\u961F\u5217 ${deliveries.queuedCount(sid)} \u6761\uFF09`;
  console.log(`[femo-plugin] ${line}`);
  debugLogMainActor(resolved, line);
  pushDiag("main-actor", `\u5267\u672C\u8282\u70B9\u300C${d.nodeName}\u300D\u7B49\u4E3B\u6A21\u578B\u628A\u5F53\u524D\u8FD9\u8F6E\u8BF4\u5B8C\uFF08\u7B2C ${open2 ?? "?"} \u8F6E\u6536\u53E3\u540E\u767B\u573A\uFF0Cvia=${d.via}\uFF09`);
}
function mainAgentOf(ctx, sid) {
  const bag = ctx;
  return bag.agents?.get(sid) ?? (typeof bag.get === "function" ? bag.get("agents")?.get(sid) : void 0);
}
function flushNextMainDelivery(ctx, resolved, sid) {
  if (deliveries.queuedCount(sid) === 0) return;
  tryDeliverNext(ctx, resolved, sid, 0);
}
function tryDeliverNext(ctx, resolved, sid, tries) {
  queueMicrotask(() => {
    const next = deliveries.peek(sid);
    if (next === void 0) return;
    const agent = mainAgentOf(ctx, sid);
    const status = agent?.status;
    if (typeof status === "string" && status !== "idle") {
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
      const line = `\u6392\u961F\u6CE8\u5165\u4F5C\u5E9F\uFF08\u8282\u70B9\u5DF2\u6536\u5C3E/\u505C\u6F14\uFF09: node=${next.nodeName} wait_key=${next.waitKey}`;
      console.log(`[femo-plugin] ${line}`);
      debugLogMainActor(resolved, line);
      return;
    }
    const taken = deliveries.takeNext(sid);
    if (taken === void 0) return;
    debugLogMainActor(resolved, `\u8F6E\u6536\u53E3 \u2192 \u4EA4\u4ED8\u6392\u961F\u6CE8\u5165(via=${taken.via}): node=${taken.nodeName}`);
    pushDiag("main-actor", `\u8F6E\u6536\u53E3 \u2192 \u5267\u672C\u8282\u70B9\u300C${taken.nodeName}\u300D\u767B\u573A\uFF08via=${taken.via}\uFF09`);
    deliverMain(ctx, sid, taken);
  });
}
function dropMainDeliveries(sid, reason, resolved, forgetTurn = false) {
  const dropped = forgetTurn ? deliveries.forget(sid) : deliveries.dropAll(sid);
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
function abandonMainAnswer(sid, reason, projections) {
  dropMainDeliveries(sid, reason);
  const p = pending.get(sid);
  if (p === void 0) return false;
  const proj = projections !== void 0 ? projections.get(sid) : void 0;
  if (proj !== void 0 && p.sawTurnStart && p.turn !== void 0) {
    p.projBuffer.push({ type: "turn/end", data: { turn: p.turn }, surface: void 0 });
    const turn = p.turn;
    sectionGate.commit(sid, turn, projectionActorKey(p.actor), () => flushProjection(proj, p));
  }
  pending.delete(sid);
  p.settled = true;
  p.resolve();
  console.log(`[femo-plugin] main-actor answer abandoned: node=${p.nodeName} (${reason})`);
  return true;
}
function mainRetrySteerText(play, nodeName, actor, attempt, feedback) {
  return `[femo-plugin\xB7\u8282\u70B9\u91CD\u8BD5] \u5267\u672C\u300A${play}\u300B\u8282\u70B9\u300C${nodeName}\u300D\uFF08\u4F60\u626E\u6F14 ${actor}\uFF09\u7684\u4E0A\u4E00\u8F6E\u8F93\u51FA\u672A\u901A\u8FC7\u5267\u672C\u6821\u9A8C\uFF08\u7B2C ${attempt} \u6B21\u53CD\u9988\uFF09\uFF1A
${feedback}
\u8BF7\u91CD\u65B0\u8F93\u51FA\u8BE5\u8282\u70B9\u7684\u53F0\u8BCD\uFF08${SET_VARIABLE_TEACHING}\uFF09\u3002`;
}
function stageNotice(sid, nodeName, actor, prompt, delta, final, context = "") {
  const play = playNames.get(sid);
  const parts = final ? [`[femo-plugin\xB7\u5267\u7EC8\u8865\u9057] \u5267\u672C\u300A${play ?? "\u5267\u672C"}\u300B\u5DF2\u8DD1\u5B8C\uFF0C\u4EE5\u4E0B\u662F\u6700\u540E\u4E00\u622A\u4F60\u53EF\u89C1\u7684\u5267\u4E2D\u53D1\u8A00\u3002`] : [`[femo-plugin\xB7\u4E0A\u573A] \u5267\u672C\u300A${play ?? "\u5267\u672C"}\u300B\u8FDB\u884C\u5230\u8282\u70B9\u300C${nodeName}\u300D\uFF0C\u8F6E\u5230 ${actor} \u8BF4\u8BDD\u3002`];
  const flowLines = delta.map((l) => `${l.actor}\uFF1A${l.text}`).join("\n");
  const field = context.trim().length > 0 ? context : flowLines;
  if (field.length > 0) parts.push(`\u3016\u573A\u4E0A\u4FE1\u606F\u3017
${field}`);
  if (!final) parts.push(`\u3016\u672C\u8282\u70B9\u6307\u4EE4\u3017
${prompt}`);
  if (!final) parts.push(`\u3016\u8981\u6C42\u3017\u73B0\u5728\u8F6E\u5230\u4F60\u7684\u5267\u4E2D\u56DE\u5408\uFF1A\u53EA\u8F93\u51FA\u53F0\u8BCD\u6B63\u6587\u3002${SET_VARIABLE_TEACHING}\u3002`);
  return parts.join("\n\n");
}
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
  const actor = typeof request.ai_name === "string" && request.ai_name.length > 0 ? request.ai_name : `@${nodeName}`;
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
      broker.steerLease(waitKey, mainRetrySteerText(playNames.get(sid) ?? "\u5267\u672C", nodeName, actor, verdict.attempt, verdict.feedback));
      verdict = await broker.park(waitKey);
    }
    debugLogMainActor(resolved, `\u505C\u9760\u7ED3\u675F: node=${nodeName} verdict=${verdict.kind}`);
  } catch (error) {
    debugLogMainActor(resolved, `!! \u5F02\u5E38: ${error instanceof Error ? error.message : String(error)}`);
    pending.delete(sid);
    recordError(SessionId4(sid), `\u4E3B\u6A21\u578B\u4E0B\u573A\u6CE8\u5165\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
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
    apiRetry.clearChild(sid);
  }
}
function flushProjection(proj, p) {
  if (p.projBuffer.length === 0) return;
  const items = p.projBuffer.splice(0);
  for (const item of items) {
    projectionAppend(proj, item.type, item.data, item.surface, p.scopes, { skipGod: true });
  }
}
function broadcastMainChunk(p, sid, step, chunk) {
  broadcastStreamChunk({ sid, node_name: p.nodeName, actor: p.actor, step }, chunk);
}
function broadcastMainToolResult(p, sid, raw) {
  const msg = raw.message ?? void 0;
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
  const name2 = callId !== void 0 ? p.toolNames.get(callId) : void 0;
  broadcastSse("femo_stream", {
    kind: "tool_result",
    sid,
    node_name: p.nodeName,
    actor: p.actor,
    step: typeof raw.step === "number" ? raw.step : 0,
    ...name2 !== void 0 ? { name: name2 } : {},
    text: text.length > 2e3 ? `${text.slice(0, 2e3)}\u2026` : text
  });
}
var mainLiveFrames = /* @__PURE__ */ new Map();
function installMainActorStreamBridge(ctx) {
  onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === void 0) return;
    const sid = String(agent?.session?.id ?? agent?.id ?? "");
    if (sid.length === 0) return;
    const p = pending.get(sid);
    if (p === void 0 || p.settled || !p.sawTurnStart) return;
    let live = mainLiveFrames.get(sid);
    if (live === void 0 || live.actor !== p.actor) {
      live = { actor: p.actor, frames: new LiveStreamFrames({ sid, node_name: p.nodeName, actor: p.actor, turn: p.turn }) };
      mainLiveFrames.set(sid, live);
      projTrace("frame", `\u5EFA\u7ACB main \u76F4\u64AD\u4F4D actor=${p.actor} turn=${p.turn === void 0 ? "(\u672A\u5B9A)" : t4(p.turn)} node=${p.nodeName}`);
    }
    projTrace("frame", `\u6536 main \u539F\u751F\u5E27 type=${frame.type ?? "-"} \u2192 actor=${p.actor} turn=${p.turn === void 0 ? "(\u672A\u5B9A)" : t4(p.turn)}`);
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
  const p = pending.get(sid);
  if (p === void 0 || p.settled) {
    if (event.type === "turn/end") flushNextMainDelivery(ctx, resolved, sid);
    return;
  }
  const proj = projections !== void 0 ? projections.get(sid) : void 0;
  if (event.type === "turn/start") {
    p.sawTurnStart = true;
    p.buffer = [];
    if (proj !== void 0) {
      const turn = event.data?.turn;
      if (typeof turn === "number") p.turn = turn;
      if (p.turn !== void 0) {
        const visible = p.scopes.length > 0 ? { visible: p.scopes } : {};
        projectionAppend(proj, "femo-plugin/chat", {
          // scene:true = 戏内下场轮（前端按演员轮公式贴段首定位；戏外主会话轮
          // 走 v9.2 的"首个回答"公式，两者分开——用户 2026-09-11 拍板）。
          kind: "live",
          actor: p.actor,
          turn: p.turn,
          main: true,
          scene: true,
          ...visible,
          seq: Date.now()
        }, void 0, p.scopes, { skipGod: true });
        sectionGate.begin(sid, p.turn, projectionActorKey(p.actor));
        p.projBuffer.push({
          type: "turn/start",
          data: { ...event.data ?? {} },
          surface: void 0
        });
        p.projBuffer.push({
          type: "femo-plugin/chat",
          data: { kind: "speaker", actor: p.actor, text: p.actor, turn: p.turn, ...visible, seq: Date.now() },
          surface: void 0
        });
        if (p.showprompt !== void 0) {
          p.projBuffer.push({
            type: "femo-plugin/chat",
            data: { kind: "prompt", text: `\u{1F4E2} ${p.showprompt}`, turn: p.turn, ...visible, seq: Date.now() },
            surface: void 0
          });
        }
      }
    }
    return;
  }
  if (event.type === "step/start") {
    if (proj !== void 0 && p.sawTurnStart && p.turn !== void 0) {
      p.projBuffer.push({
        type: "step/start",
        data: { ...event.data ?? {} },
        surface: void 0
      });
    }
    return;
  }
  if (event.type === "assistant/chunk") {
    if (!p.sawTurnStart) return;
    const raw = event.data ?? {};
    const chunk = raw.chunk;
    if (chunk === void 0) return;
    broadcastMainChunk(p, sid, typeof raw.step === "number" ? raw.step : 0, chunk);
    if (proj !== void 0 && (chunk.type === "block-start" || chunk.type === "block-end")) {
      p.projBuffer.push({
        type: "assistant/chunk",
        data: { ...raw, _srcSeq: `main#${Number(event.seq)}` },
        surface: void 0
      });
    }
    return;
  }
  if (event.type === "assistant/message" || event.type === "tool/call" || event.type === "tool/result") {
    if (!p.sawTurnStart) return;
    p.buffer.push(event);
    if (proj !== void 0) {
      p.projBuffer.push({
        type: event.type,
        data: { ...event.data, _srcSeq: `main#${Number(event.seq)}` },
        surface: MAIN_SURFACE_OP_EVENTS.has(event.type) ? { surfaceOp: "append" } : void 0
      });
      if (event.type === "tool/call") {
        const d = event.data;
        if (typeof d.callId === "string" && typeof d.name === "string") p.toolNames.set(d.callId, d.name);
      } else if (event.type === "tool/result") {
        broadcastMainToolResult(p, sid, event.data);
      }
    }
    return;
  }
  if (event.type === "step/end") {
    if (proj !== void 0 && p.sawTurnStart) {
      p.projBuffer.push({
        type: "step/end",
        data: { ...event.data },
        surface: void 0
      });
    }
    return;
  }
  if (event.type === "turn/end") {
    if (!p.sawTurnStart) return;
    mainLiveFrames.get(sid)?.frames.endTurn();
    if (proj !== void 0 && p.turn !== void 0) {
      p.projBuffer.push({ type: "turn/end", data: { ...event.data }, surface: void 0 });
      const turn = p.turn;
      sectionGate.commit(sid, turn, projectionActorKey(p.actor), () => flushProjection(proj, p));
      projTrace("node", `main \u6BB5\u843D\u91CA\u653E(commit) actor=${p.actor} turn=\u2026${String(turn).slice(-4)} node=${p.nodeName} \u7F13\u51B2\u884C\u6570=${p.projBuffer.length}`);
    }
    pending.delete(sid);
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
  await bridge.send("human_input", {
    job_id: p.jobId,
    wait_key: p.waitKey,
    body: { output, steps }
  });
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
function flushMainFinalDelta(ctx, sessionId, resolved) {
  const sid = String(sessionId);
  const all = flows.get(sid) ?? [];
  const mark = waterMarks.get(sid) ?? 0;
  const delta = all.slice(mark);
  waterMarks.set(sid, all.length);
  if (delta.length === 0) return;
  const notice = stageNotice(sid, "", "", "", delta, true);
  steerMainAgent(ctx, sid, notice);
  debugLogMainActor(resolved, `\u5267\u7EC8\u8865\u9057\u6CE8\u5165: ${delta.length}\u6761 ${notice.length}ch`);
}

// host/pre-step-gate.ts
function isActorChildNoise(message) {
  const source = message.source;
  if (source === void 0) return false;
  if (source.kind !== "subagent-settled" && source.kind !== "agent-message") return false;
  return typeof source.senderSessionId === "string" && source.senderSessionId.startsWith("femo-actor-");
}
function gatePreStep(facts) {
  const { messages, mainAnswerPending, running, tag } = facts;
  const who = typeof tag === "string" && tag.length > 0 ? tag : "(unknown session)";
  const step = Number.isFinite(facts.step) && facts.step > 0 ? facts.step : 1;
  const admitted = messages.filter((message) => !isActorChildNoise(message));
  if (admitted.length !== messages.length) {
    console.log(`[femo-plugin] pre-step dropped ${messages.length - admitted.length} actor-child notice(s) for ${who}`);
    if (admitted.length === 0 && step === 1) return { kind: "reject" };
  }
  if (step > 1) return { kind: "enter", messages: admitted };
  if (mainAnswerPending) return { kind: "enter", messages: admitted };
  if (!running) return { kind: "enter", messages: admitted };
  if (admitted.some((message) => message.source?.kind === "user")) return { kind: "enter", messages: admitted };
  console.log(`[femo-plugin] pre-step REJECTED for running femo agent ${who} (engine owns the conversation)`);
  return { kind: "reject" };
}

// host/engine-events.ts
var diagTs = () => (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
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
      id: randomUUID3(),
      role: "user",
      content: [{ type: "text", text }],
      source: { kind: "plugin", plugin: "femo-plugin" }
    });
    console.log(`[femo-plugin] steered main agent: sid=${sid} len=${text.length}`);
  } catch (error) {
    console.log(`[femo-plugin] steer failed: ${String(error)}`);
  }
}
function rememberEvent(runState, eventType, data) {
  if (eventType === "ai_token" || eventType === "step") return;
  if (eventType === "checkpoint") {
    const idx = runState.lastEvents.findIndex((e) => e.type === "checkpoint");
    if (idx >= 0) {
      runState.lastEvents[idx] = { type: eventType, data };
      return;
    }
  }
  runState.lastEvents.push({ type: eventType, data });
  if (runState.lastEvents.length > 400) runState.lastEvents.shift();
}
function jobMirrorPrearm(runState, jobId, ownerSid) {
  runState.jobs.set(jobId, {
    jobId,
    ownerSid,
    state: "running",
    nodeActors: /* @__PURE__ */ new Map(),
    nodeScopes: /* @__PURE__ */ new Map(),
    nodeShowprompts: /* @__PURE__ */ new Map(),
    giveups: [],
    warnings: []
  });
  runState.sidIndex.set(ownerSid, jobId);
  runState.activeJobId = jobId;
}
function jobMirrorCorrect(runState, jobId, ownerSid) {
  const mirror = runState.jobs.get(jobId);
  if (mirror !== void 0) return;
  jobMirrorPrearm(runState, jobId, ownerSid);
}
function jobMirrorSetState(runState, jobId, state) {
  const mirror = runState.jobs.get(jobId);
  if (mirror === void 0) return;
  if (mirror.state === state) return;
  mirror.state = state;
  broadcastSse("run_state", { sid: mirror.ownerSid, job_id: jobId, state });
}
function isSessionRunning(runState, sessionId) {
  const jobId = runState.sidIndex.get(sessionId);
  if (jobId === void 0) return false;
  const mirror = runState.jobs.get(jobId);
  return mirror !== void 0 && mirror.state === "running" && runState.activeJobId === jobId;
}
function activeJobOfSession(runState, sessionId) {
  const jobId = runState.sidIndex.get(sessionId);
  return jobId === void 0 ? void 0 : runState.jobs.get(jobId);
}
function projectionStateOf(runState, mainSid) {
  const job = activeJobOfSession(runState, mainSid);
  const running = job !== void 0 && job.state === "running" && runState.activeJobId === job.jobId;
  const waiting = running && job.waitingHuman !== void 0;
  const waitScope = waiting ? job.waitingHuman?.waitScope ?? (job.waitingHuman?.nodeName !== void 0 ? job.nodeScopes.get(job.waitingHuman.nodeName) ?? [] : []) : [];
  return { running, waiting, waitScope, ...waiting ? { prompt: job.waitingHuman?.prompt } : {} };
}
function broadcastProjectionState(runState, mainSid) {
  broadcastSse("projection_state", { sid: mainSid, ...projectionStateOf(runState, mainSid) });
}
function registerEngineEventHandlers(ctx, deps) {
  const { resolved, bridge, runState, sessionsStore, projections, godMirror, defaultModel, recordError, broker: broker2 } = deps;
  ctx.on("agent/pre-step", async ({ agent, messages, step, signal }, next) => {
    const decision = await next();
    if (decision === void 0 || signal.aborted) return decision;
    if (decision.kind !== "enter") return decision;
    if (!isFemoAgent(agent)) return decision;
    const sid = String(agent.session.id);
    return gatePreStep({
      messages: decision.messages,
      step,
      mainAnswerPending: isMainAnswerPending(sid),
      running: isSessionRunning(runState, sid),
      tag: sid
    });
  });
  ctx.on("session/event", (session, event) => {
    if (presetOf(session) !== FEMO_PRESET) return;
    if (session.header.parentSession !== void 0) return;
    mainSessionEventHook(ctx, session, event, bridge, resolved, projections);
  });
  godMirror.registerRealtimeListener(ctx);
  ctx.on("session/event", (session, event) => {
    if (session.header.parentSession !== void 0) return;
    const sid0 = String(session.id);
    const windows = projections.get(sid0);
    if (windows?.god === void 0) return;
    const actor = "\u5BFC\u6F14";
    if (event.type === "assistant/message") {
      broadcastSse("femo_stream", { kind: "end", sid: sid0, node_name: "", actor });
      return;
    }
    if (event.type === "turn/end") {
      directorLive.get(sid0)?.frames.endTurn();
      return;
    }
    if (event.type === "tool/call") {
      broadcastSse("femo_stream", { kind: "block_end", sid: sid0, node_name: "", actor, blockKind: "toolcall" });
      return;
    }
    if (event.type !== "assistant/chunk") return;
    const chunk = event.data.chunk;
    if (chunk?.type === "text-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
      broadcastSse("femo_stream", { kind: "delta", sid: sid0, node_name: "", actor, blockKind: "text", index: chunk.index, text: chunk.text });
    } else if (chunk?.type === "reasoning-delta" && typeof chunk.text === "string" && chunk.text.length > 0) {
      broadcastSse("femo_stream", { kind: "delta", sid: sid0, node_name: "", actor, blockKind: "reasoning", index: chunk.index, text: chunk.text });
    } else if (chunk?.type === "tool-call-delta") {
      const name2 = typeof chunk.name === "string" && chunk.name.length > 0 ? chunk.name : void 0;
      const argsDelta = typeof chunk.argumentsDelta === "string" ? chunk.argumentsDelta : "";
      if (name2 !== void 0 || argsDelta.length > 0) {
        broadcastSse("femo_stream", {
          kind: "delta",
          sid: sid0,
          node_name: "",
          actor,
          blockKind: "toolcall",
          index: chunk.index,
          ...name2 !== void 0 ? { name: name2 } : {},
          text: argsDelta
        });
      }
    } else if (chunk?.type === "block-start" && (chunk.blockType === "text" || chunk.blockType === "reasoning")) {
      broadcastSse("femo_stream", { kind: "start", sid: sid0, node_name: "", actor, blockKind: chunk.blockType, index: chunk.index });
    } else if (chunk?.type === "block-end" && (chunk.block?.type === "text" || chunk.block?.type === "reasoning" || chunk.block?.type === "tool-call")) {
      broadcastSse("femo_stream", {
        kind: "block_end",
        sid: sid0,
        node_name: "",
        actor,
        index: chunk.index,
        blockKind: chunk.block?.type === "tool-call" ? "toolcall" : chunk.block?.type
      });
    }
  });
  const directorLive = /* @__PURE__ */ new Map();
  onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === void 0) return;
    if (agent?.session?.header?.parentSession !== void 0) return;
    const sid0 = String(agent?.session?.id ?? agent?.id ?? "");
    if (sid0.length === 0 || projections.get(sid0)?.god === void 0) return;
    const turn = typeof frame.turn === "number" ? frame.turn : void 0;
    let live = directorLive.get(sid0);
    if (live === void 0 || turn !== void 0 && live.turn !== turn) {
      live = {
        turn,
        frames: new LiveStreamFrames({
          sid: sid0,
          node_name: "",
          actor: "\u5BFC\u6F14",
          ...turn !== void 0 ? { turn } : {}
        })
      };
      directorLive.set(sid0, live);
      projTrace("frame", `\u5EFA\u7ACB\u5BFC\u6F14\u76F4\u64AD\u4F4D turn=${turn === void 0 ? "\u65E0" : String(turn).slice(-4)} sid=${sid0.slice(-8)}`);
    }
    projTrace("frame", `\u5BFC\u6F14\u6D41\u6536\u5E27 type=${frame.type ?? "-"}\uFF08sid=${sid0.slice(-8)}\uFF0Cturn=${turn === void 0 ? "\u65E0" : String(turn).slice(-4)}\uFF09`);
    live.frames.frame(frame);
  });
  installMainActorStreamBridge(ctx);
  ctx.on("femo-plugin/event", (eventType, data) => {
    if (eventType === "flow_start") console.log(`[femo-plugin][diag] flow_start event received; activeJobId=${String(runState.activeJobId ?? "-")}`);
    const d0 = data ?? {};
    const jobId = typeof d0.job_id === "number" ? d0.job_id : void 0;
    const mirror = jobId !== void 0 ? runState.jobs.get(jobId) : void 0;
    if (jobId === void 0 || mirror === void 0) {
      pushDiag("ev-in", `${eventType} DROPPED(no-mirror) job=${String(d0.job_id ?? "-")}`);
      if (eventType === "flow_start") console.log("[femo-plugin][diag] flow_start without mirror: broadcast only");
      console.log(`[femo-plugin] event ${eventType} without mirror (job_id=${String(d0.job_id ?? "-")}); broadcast only`);
      broadcastSse(eventType, data);
      rememberEvent(runState, eventType, data);
      return;
    }
    const sessionId = SessionId5(mirror.ownerSid);
    const envelope = { ...d0, sid: mirror.ownerSid, job_id: jobId };
    const broadcastPayload = eventType === "checkpoint" ? (() => {
      const { state: _varsState, ...rest } = envelope;
      return rest;
    })() : envelope;
    broadcastSse(eventType, broadcastPayload);
    rememberEvent(runState, eventType, broadcastPayload);
    const session = sessionsStore?.get(sessionId);
    if (session === void 0) {
      pushDiag("ev-in", `${eventType} DROPPED(no-session) job=${jobId} sid=${String(sessionId)}`);
      if (eventType === "flow_start") console.log(`[femo-plugin][diag] flow_start broadcast done but DROPPED before sessionActors.set: session ${String(sessionId)} not in store`);
      return;
    }
    if (eventType === "human_wait" || eventType === "human_done") {
      pushDiag("ev-in", `${eventType} dispatched job=${jobId} wait_key=${String(d0.wait_key ?? "-")}`);
    }
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
        console.log(`[femo-plugin][diag] flow_start processed: sessionActors[${String(sessionId)}]=${JSON.stringify(actors)} (femoSession=${String(d.session_id)})`);
        jobMirrorCorrect(runState, jobId, String(sessionId));
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
        void godMirror.ensureGodMirrorUpToDate(String(sessionId));
        break;
      }
      case "node_start": {
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const scopeInfo = Array.isArray(d.scope) ? d.scope.filter((x) => typeof x === "string") : void 0;
        if (nodeName !== void 0 && scopeInfo !== void 0) {
          mirror.nodeScopes.set(nodeName, scopeInfo);
        }
        const nodeType = d.node_type;
        if (nodeType === "human") {
          const prompt = typeof d.prompt === "string" && d.prompt.trim().length > 0 ? d.prompt : void 0;
          if (prompt !== void 0) {
            appendChatProjected(ctx, session, projections, `\u{1F4E2} ${prompt}`, "prompt", void 0, nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName));
          }
        } else if (nodeType === "notice") {
          const prompt = typeof d.prompt === "string" && d.prompt.trim().length > 0 ? d.prompt : void 0;
          if (prompt !== void 0) {
            appendChatProjected(ctx, session, projections, `\u{1F4E2} ${prompt}`, "prompt", void 0, nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName));
          }
        }
        break;
      }
      case "context_ready": {
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const aiName = typeof d.ai_name === "string" && d.ai_name.length > 0 ? d.ai_name : void 0;
        if (nodeName !== void 0 && aiName !== void 0) {
          mirror.nodeActors.set(nodeName, aiName);
        }
        const showprompt = typeof d.showprompt === "string" && d.showprompt.trim().length > 0 ? d.showprompt : void 0;
        if (showprompt !== void 0) {
          if (nodeName !== void 0) {
            mirror.nodeShowprompts.set(nodeName, showprompt);
          } else {
            appendChatProjected(ctx, session, projections, `\u{1F4E2} ${showprompt}`, "prompt", void 0, nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName));
          }
        }
        break;
      }
      case "ai_retry": {
        const errors = Array.isArray(d.errors) ? d.errors.map(String) : [];
        const attempt = typeof d.attempt === "number" ? d.attempt : 0;
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        if (errors.length > 0) {
          appendChatProjected(
            ctx,
            session,
            projections,
            `\u26A0\uFE0F ${errors[0]}\uFF08\u7B2C ${attempt} \u6B21\u91CD\u8BD5\uFF09`,
            "notice",
            void 0,
            nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName)
          );
        }
        break;
      }
      case "human_wait": {
        console.log(`[femo-plugin] human_wait received: job=${jobId} node=${String(d.node_name ?? "-")} wait_key=${String(d.wait_key ?? "-")} -> waitingHuman SET`);
        pushDiag("human_wait", `SET job=${jobId} node=${String(d.node_name ?? "-")} wait_key=${String(d.wait_key ?? "-")}`);
        const waitScope = Array.isArray(d.scope) ? d.scope.filter((x) => typeof x === "string") : void 0;
        mirror.waitingHuman = {
          waitKey: String(d.wait_key ?? ""),
          nodeName: typeof d.node_name === "string" ? d.node_name : void 0,
          context: typeof d.context === "string" ? d.context : "",
          memory: typeof d.memory === "string" ? d.memory : "",
          showprompt: typeof d.showprompt === "string" ? d.showprompt : void 0,
          prompt: typeof d.prompt === "string" ? d.prompt : "",
          outVars: Array.isArray(d.out_vars) ? d.out_vars.filter((x) => typeof x === "string") : [],
          waitScope
        };
        broadcastProjectionState(runState, String(sessionId));
        const prompt = typeof d.prompt === "string" ? d.prompt : "";
        const nodeName = typeof d.node_name === "string" ? d.node_name : void 0;
        const waitLineScope = waitScope ?? (nodeName === void 0 ? void 0 : mirror.nodeScopes.get(nodeName));
        appendChatProjected(
          ctx,
          session,
          projections,
          prompt.length > 0 ? `\u{1F3AD} \u7B49\u5F85\u4F60\u7684\u56DE\u5E94\uFF1A${prompt}` : "\u{1F3AD} \u7B49\u5F85\u4F60\u7684\u56DE\u5E94",
          "human_wait",
          void 0,
          waitLineScope
        );
        broker2?.register({
          waitKey: String(d.wait_key ?? ""),
          nodeName: nodeName ?? "",
          kind: "human",
          jobId,
          mainSessionId: String(sessionId),
          steer: (text) => appendChatProjected(
            ctx,
            session,
            projections,
            `\u26A0\uFE0F ${text}`,
            "notice",
            void 0,
            waitLineScope
          )
        });
        break;
      }
      case "human_done": {
        console.log(`[femo-plugin] human_done received: job=${jobId} -> waitingHuman CLEARED`);
        pushDiag("human_done", `CLEARED job=${jobId} (\u8F93\u5165\u88AB\u5F15\u64CE\u6D88\u8D39\uFF1A\u6B63\u5E38\u8F93\u5165/\u7A7A\u8F93\u5165\u8D85\u65F6\u653E\u884C\u5747\u8D70\u6B64\u4FE1\u53F7)`);
        mirror.waitingHuman = void 0;
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
            const size = noteFlowLine(String(sessionId), doneActor, doneOutput, doneScopes);
            debugLogMainActor(resolved, `[\u5BBF\u4E3B] ai_done \u8BB0\u8D26: node=${doneNode} actor=${doneActor} out=${doneOutput.length}ch scopes=${JSON.stringify(doneScopes ?? null)} \u2192 \u6D41\u6C34=${size}`);
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
        const reqNode = typeof d.node_name === "string" ? d.node_name : void 0;
        const reqScope = Array.isArray(d.scope_info) ? d.scope_info.filter((x) => typeof x === "string") : void 0;
        if (reqNode !== void 0 && reqScope !== void 0) {
          mirror.nodeScopes.set(reqNode, reqScope);
        }
        console.log(`[femo-plugin] ai_request received node=${String(d.node_name ?? "")} wait_key=${String(d.wait_key ?? "")} job=${jobId}`);
        if (String(d.source ?? "") === "main") {
          noteMainActor(String(sessionId), typeof d.ai_name === "string" ? d.ai_name : "");
          void runMainModelTurn(ctx, resolved, bridge, session, d, recordError, projections, mirror.nodeScopes, mirror.nodeShowprompts, jobId).catch((error) => {
            recordError(session.id, `\u4E3B\u6A21\u578B\u4E0B\u573A\u6CE8\u5165\u5931\u8D25\uFF1A${String(error)}`);
            void sendActorFailure(bridge, jobId, String(d.wait_key ?? ""), "main_executor_error", String(error)).catch(() => void 0);
          });
          break;
        }
        if (isNativeMode()) {
          void runAiSubagentNative(ctx, resolved, bridge, session, d, recordError, defaultModel, mirror.nodeActors, projections, mirror.nodeShowprompts, jobId).catch((error) => {
            recordError(session.id, `\u5B50 agent \u6267\u884C\u5931\u8D25\uFF1A${String(error)}`);
            void sendActorFailure(bridge, jobId, String(d.wait_key ?? ""), "dispatch_error", String(error)).catch(() => void 0);
          });
          break;
        }
        void runAiSubagent(ctx, resolved, bridge, session, d, recordError, defaultModel, mirror.nodeActors, projections, mirror.nodeShowprompts, jobId).catch((error) => {
          recordError(session.id, `\u5B50 agent \u6267\u884C\u5931\u8D25\uFF1A${String(error)}`);
          void sendActorFailure(bridge, jobId, String(d.wait_key ?? ""), "dispatch_error", String(error)).catch(() => void 0);
        });
        break;
      }
      case "flow_done": {
        console.log(`[femo-cp-diag ${diagTs()}] flow_done ARRIVE sid=${String(sessionId)} job=${jobId} \u2192 Job finished\uFF08\u65AD\u70B9\u4F5C\u5E9F\u7531\u5F15\u64CE finalize \u627F\u62C5\uFF09`);
        jobMirrorSetState(runState, jobId, "finished");
        broadcastProjectionState(runState, String(sessionId));
        if (runState.activeJobId === jobId) runState.activeJobId = void 0;
        broadcastCompat(ctx, session, projections, "\u2705 \u5267\u672C\u5DF2\u8DD1\u5B8C");
        flushMainFinalDelta(ctx, sessionId, resolved);
        break;
      }
      case "flow_error": {
        const abortedOnError = abortJobSubagents(jobId, "\u5267\u672C\u51FA\u9519\uFF1A\u4E2D\u65AD\u5728\u98DE AI \u6F14\u5458");
        if (abortedOnError > 0) console.log(`[femo-plugin] flow_error: aborted ${abortedOnError} in-flight subagent(s) of job ${jobId}`);
        abandonMainAnswer(String(sessionId), "\u5267\u672C\u51FA\u9519\uFF0C\u5728\u98DE\u6CE8\u5165\u4F5C\u5E9F", projections);
        broker2?.abortJob(jobId, "flow error");
        jobMirrorSetState(runState, jobId, "failed");
        broadcastProjectionState(runState, String(sessionId));
        if (runState.activeJobId === jobId) runState.activeJobId = void 0;
        const text = `\u5267\u672C\u51FA\u9519\uFF1A${String(d.error ?? "unknown error")}`;
        recordError(session.id, text);
        broadcastCompat(ctx, session, projections, `\u274C ${text}`);
        const errorGiveups = mirror.giveups;
        mirror.giveups = [];
        const errorSuffix = errorGiveups.length > 0 ? `

\u26A0\uFE0F \u53E6\u6709\u51FA\u73B0\u8FC7\u5267\u672C\u9519\u8BEF\u7684\u8282\u70B9\uFF1A
- ${errorGiveups.map((g) => g.message).join("\n- ")}` : "";
        const errorWarnings = mirror.warnings;
        mirror.warnings = [];
        const errorWarnSuffix = errorWarnings.length > 0 ? `

\u2139\uFE0F \u53E6\u6709\u8B66\u544A\uFF08\u4E0D\u963B\u65AD\uFF0C\u4F9B\u4FEE\u5267\u672C\u53C2\u8003\uFF09\uFF1A
- ${errorWarnings.map((w) => w.message).join("\n- ")}` : "";
        steerMainAgent(ctx, sessionId, `[femo-plugin] \u5267\u672C\u8FD0\u884C\u7ED3\u679C\uFF1A\u274C \u8FD0\u884C\u51FA\u9519\u3002\u9519\u8BEF\u4FE1\u606F\uFF1A${String(d.error ?? "unknown error")}\u2014\u2014\u53EF\u4FEE\u590D\u5267\u672C\u540E\u518D fresh_start\u3002${errorSuffix}${errorWarnSuffix}`);
        break;
      }
      case "flow_paused": {
        const abortedOnPause = abortJobSubagents(jobId, "\u5267\u672C\u6682\u505C\uFF1A\u4E2D\u65AD\u5728\u98DE AI \u6F14\u5458");
        if (abortedOnPause > 0) console.log(`[femo-plugin] flow_paused: aborted ${abortedOnPause} in-flight subagent(s) of job ${jobId}`);
        abandonMainAnswer(String(sessionId), "\u5267\u672C\u6682\u505C\uFF0C\u5728\u98DE\u6CE8\u5165\u4F5C\u5E9F", projections);
        broker2?.abortJob(jobId, "flow paused");
        jobMirrorSetState(runState, jobId, "suspended");
        mirror.waitingHuman = void 0;
        pushDiag("flow_paused", `suspended + waitingHuman CLEARED job=${jobId}`);
        broadcastProjectionState(runState, String(sessionId));
        if (runState.activeJobId === jobId) runState.activeJobId = void 0;
        broadcastCompat(ctx, session, projections, "\u23F8 \u5267\u672C\u5DF2\u6682\u505C\uFF08\u53EF\u7EED\u8DD1\uFF09");
        steerMainAgent(ctx, sessionId, "[femo-plugin] \u5267\u672C\u8FD0\u884C\u7ED3\u679C\uFF1A\u23F8 \u5DF2\u6682\u505C\uFF08\u6302\u8D77\uFF0C\u65AD\u70B9\u4FDD\u7559\uFF09\u3002\u53EF\u7528 resume \u7EED\u8DD1\u6216 fresh_start \u91CD\u8DD1\u3002");
        break;
      }
      case "bridge_run_ended": {
        broker2?.abortJob(jobId, "bridge run ended");
        mirror.waitingHuman = void 0;
        pushDiag("bridge_run_ended", `waitingHuman CLEARED job=${jobId} ok=${String(d.ok ?? "-")}`);
        if (mirror.state === "running") {
          jobMirrorSetState(runState, jobId, "failed");
        }
        if (runState.activeJobId === jobId) runState.activeJobId = void 0;
        if (mirror.state === "finished") {
          const doneGiveups = mirror.giveups;
          mirror.giveups = [];
          const doneSuffix = doneGiveups.length > 0 ? `

\u26A0\uFE0F \u4EE5\u4E0B\u8282\u70B9\u51FA\u73B0\u8FC7\u5267\u672C\u9519\u8BEF\uFF1A
- ${doneGiveups.map((g) => g.message).join("\n- ")}
\u5B8C\u6574\u6E05\u5355\u89C1\u9519\u8BEF\u9762\u677F\u3002` : "";
          const doneWarnings = mirror.warnings;
          mirror.warnings = [];
          const doneWarnSuffix = doneWarnings.length > 0 ? `

\u2139\uFE0F \u4EE5\u4E0B\u8B66\u544A\u51FA\u73B0\u8FC7\uFF08\u4E0D\u963B\u65AD\uFF0C\u4F9B\u4FEE\u5267\u672C\u53C2\u8003\uFF09\uFF1A
- ${doneWarnings.map((w) => w.message).join("\n- ")}` : "";
          steerMainAgent(ctx, sessionId, `[femo-plugin] \u5267\u672C\u8FD0\u884C\u7ED3\u679C\uFF1A\u2705 Job ${jobId} \u5DF2\u5B8C\u6574\u8DD1\u5B8C\u3002\u82E5\u8981\u91CD\u8DD1\u8BF7\u7528 fresh_start\uFF08\u4E0D\u80FD resume \u7EED\u8DD1\uFF09\u3002${doneSuffix}${doneWarnSuffix}`);
        }
        break;
      }
      case "node_retry": {
        if (broker2 === void 0) {
          console.log(`[femo-plugin] node_retry received but broker not wired: wait_key=${String(d.wait_key ?? "")}`);
          break;
        }
        broker2.deliverRetry(
          String(d.wait_key ?? ""),
          String(d.feedback ?? ""),
          Number(d.attempt ?? 1),
          String(d.ai_name ?? "")
        );
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
          mirror.warnings.push({ node: String(d.node_name ?? ""), message });
          break;
        }
        recordError(session.id, message);
        broadcastCompat(ctx, session, projections, `\u26A0\uFE0F ${message}`);
        mirror.giveups.push({ node: String(d.node_name ?? ""), aiName: String(d.ai_name ?? ""), message });
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

// host/host-log.ts
import { dirname as dirname2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var SELF_DIR = dirname2(fileURLToPath2(import.meta.url)).replace(/\\/g, "/");
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

// host/femo-files.ts
import { basename, join as join10 } from "node:path";
var MAX_ENTRIES = 200;
function normKey(path) {
  const unified = path.trim().replace(/\//g, "\\");
  const isUnc = unified.startsWith("\\\\");
  const body = unified.replace(/\\{2,}/g, "\\").replace(/^\\/, "");
  return (isUnc ? `\\\\${body}` : body).toLowerCase();
}
function ledgerPath(femoRoot) {
  return join10(femoRoot, "user_data", "femo_files.json");
}
async function readLedger(femoRoot) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  try {
    const raw = await readFile3(ledgerPath(femoRoot), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return { version: 1, files: {} };
    const files = parsed.files;
    if (files === null || typeof files !== "object" || Array.isArray(files)) return { version: 1, files: {} };
    return { version: 1, files };
  } catch {
    return { version: 1, files: {} };
  }
}
async function writeLedger(femoRoot, ledger) {
  const { mkdir: mkdir3, rename, writeFile: writeFile2 } = await import("node:fs/promises");
  await mkdir3(join10(femoRoot, "user_data"), { recursive: true });
  const target = ledgerPath(femoRoot);
  const tmp = `${target}.tmp`;
  await writeFile2(tmp, JSON.stringify(ledger, null, 2), "utf8");
  await rename(tmp, target);
}
var writeChains = /* @__PURE__ */ new Map();
function withLedgerLock(femoRoot, fn) {
  const prev = writeChains.get(femoRoot) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeChains.set(femoRoot, next.then(
    () => void 0,
    () => void 0
  ));
  return next;
}
async function rememberFemoFile(femoRoot, path, source) {
  const trimmed = path.trim();
  if (trimmed.length === 0) return;
  try {
    await withLedgerLock(femoRoot, async () => {
      const ledger = await readLedger(femoRoot);
      const key = normKey(trimmed);
      const now = Date.now();
      const prev = ledger.files[key];
      ledger.files[key] = {
        path: trimmed,
        name: basename(trimmed),
        source,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastUsedAt: now
      };
      const keys = Object.keys(ledger.files);
      if (keys.length > MAX_ENTRIES) {
        keys.sort((a, b) => ledger.files[a].lastUsedAt - ledger.files[b].lastUsedAt);
        for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) delete ledger.files[stale];
      }
      await writeLedger(femoRoot, ledger);
    });
  } catch (error) {
    console.log(`[femo-plugin] \u26A0\uFE0F FEMO \u6587\u4EF6\u8D26\u672C\u5199\u5165\u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u672C\u6B21\u5BFC\u5165/\u5BFC\u51FA\uFF09: ${String(error)}`);
  }
}
async function listFemoFiles(femoRoot) {
  const { stat: stat3 } = await import("node:fs/promises");
  const ledger = await readLedger(femoRoot);
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
async function forgetFemoFile(femoRoot, path) {
  const trimmed = path.trim();
  if (trimmed.length === 0) throw new Error("path is required");
  return await withLedgerLock(femoRoot, async () => {
    const ledger = await readLedger(femoRoot);
    const key = normKey(trimmed);
    if (ledger.files[key] === void 0) return false;
    delete ledger.files[key];
    await writeLedger(femoRoot, ledger);
    return true;
  });
}
async function readLedgerFemoFile(femoRoot, path) {
  const trimmed = path.trim();
  if (trimmed.length === 0) throw new Error("path is required");
  const ledger = await readLedger(femoRoot);
  const record = ledger.files[normKey(trimmed)];
  if (record === void 0) {
    throw new Error(`\u4E0D\u5728\u5BFC\u5165/\u5BFC\u51FA\u8BB0\u5F55\u4E2D\uFF1A${trimmed}`);
  }
  const { readFile: readFile3 } = await import("node:fs/promises");
  return await readFile3(record.path, "utf8");
}

// host/run-control.ts
import { SessionId as SessionId6 } from "@deepseek-ai/dsh-session";
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
    const killed = abortAllSubagents("\u65B0\u5267\u672C\u5F00\u8DD1\uFF1A\u6E05\u7406\u4E0A\u4E00\u573A\u6B8B\u7559\u5B50\u4EE3\u7406");
    if (killed > 0) console.log(`[femo-plugin] new run: cleaned ${killed} leftover subagent(s)`);
  }
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
        script_name: scriptName,
        // 剧本快照随 Job 档案落盘（引擎侧 get_job_state 带出——femoGen 凭
        // job_id 渲染/续跑的数据源）。未保存=''（引擎缺省，纯文本场无地址可存）。
        script_path: effectivePath ?? ""
      }, 3e4);
      const newJobId = res?.job_id;
      if (typeof newJobId !== "number") {
        throw new Error(`job_start \u56DE\u6267\u7F3A job_id: ${JSON.stringify(res)}`);
      }
      const compileWarnings = Array.isArray(res?.warnings) ? res.warnings : [];
      if (compileWarnings.length > 0) {
        console.log(`[femo-plugin] job_start warnings: ${compileWarnings.length} item(s)`);
        broadcastSse("compile_warnings", { sid, job_id: newJobId, warnings: compileWarnings });
      }
      await setSessionCurrentJob(resolved.femoRoot, sid, newJobId);
      await appendSessionJob(resolved.femoRoot, sid, newJobId);
      jobMirrorPrearm(runState, newJobId, sid);
      pushDiag("run", `job_start OK prearm job=${newJobId} sid=${sid.slice(-12)}\uFF08activeJobId \u5DF2\u6307\u5411\u672C Job\uFF09`);
      broadcastProjectionState(runState, sid);
      if (projections !== void 0) {
        const session = ctx.get("sessions")?.get(SessionId6(sid));
        if (session !== void 0) {
          broadcastCompat(ctx, session, projections, "\u{1F3AC} \u5267\u672C\u5DF2\u5F00\u59CB\uFF08\u5728\u4E0A\u5E1D\u89C6\u89D2\u7A97\u53E3\u67E5\u770B\uFF09");
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
        // 改了 source 的剧本续跑同样该在编译期报错）
        models: await collectLlmModels(ctx, resolved),
        host_ref: sid
      }, 3e4);
      const resumeWarnings = Array.isArray(res?.warnings) ? res.warnings : [];
      if (resumeWarnings.length > 0) {
        console.log(`[femo-plugin] job_resume warnings: ${resumeWarnings.length} item(s)`);
        broadcastSse("compile_warnings", { sid, job_id: targetJobId, warnings: resumeWarnings });
      }
      await setSessionCurrentJob(resolved.femoRoot, sid, targetJobId);
      await appendSessionJob(resolved.femoRoot, sid, targetJobId);
      jobMirrorPrearm(runState, targetJobId, sid);
      pushDiag("run", `job_resume OK prearm job=${targetJobId} sid=${sid.slice(-12)}`);
      broadcastProjectionState(runState, sid);
      if (projections !== void 0) {
        const session = ctx.get("sessions")?.get(SessionId6(sid));
        if (session !== void 0) {
          broadcastCompat(ctx, session, projections, "\u25B6\uFE0F \u5267\u672C\u5DF2\u7EE7\u7EED\uFF08\u5728\u4E0A\u5E1D\u89C6\u89D2\u7A97\u53E3\u67E5\u770B\uFF09");
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
}
function assertRunAllowed(runState, sessionId) {
  const activeId = runState.activeJobId;
  if (activeId === void 0) return;
  const mirror = runState.jobs.get(activeId);
  const owner = mirror?.ownerSid ?? "?";
  const where = owner === sessionId ? "\u672C\u4F1A\u8BDD" : `\u53E6\u4E00\u4F1A\u8BDD\uFF08${owner}\uFF09`;
  throw new Error(`${where}\u7684 Job ${activeId} \u6D3B\u8DC3\u4E2D\uFF0C\u53EF\u5148\u6682\u505C\u6216\u7B49\u5B83\u6302\u8D77`);
}
async function readScriptText(femo, scriptPath) {
  if (femo !== void 0) return femo;
  const { readFileSync } = await import("node:fs");
  return readFileSync(scriptPath, "utf8");
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
  const { mkdirSync: mkdirSync3, writeFileSync } = await import("node:fs");
  if (rawPath.length > 0) {
    const path2 = rawPath.toLowerCase().endsWith(".femo") ? rawPath : `${rawPath}.femo`;
    writeFileSync(path2, content, "utf8");
    console.log(`[femo-plugin] saved script to ${path2}`);
    if (sessionId.length > 0) await saveRecord(path2);
    await rememberFemoFile(resolved.femoRoot, path2, "export");
    writeJson(res, 200, { ok: true, path: path2 });
    return;
  }
  const safe = name2.replace(/[\\/:*?"<>|]/g, "_").replace(/\.femo$/i, "");
  const projectsDir = `${resolved.femoRoot}\\user_data\\projects`;
  mkdirSync3(projectsDir, { recursive: true });
  const path = `${projectsDir}\\${safe}.femo`;
  writeFileSync(path, content, "utf8");
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
  const { readFileSync } = await import("node:fs");
  try {
    const content = readFileSync(path, "utf8");
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
  const sessionId = sidNormalized.trim().length > 0 ? SessionId6(sidNormalized) : void 0;
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
    console.log(`[femo-run-diag ${diagTs2()}] ${tag} REJECT-400 (not femo preset)`);
    writeJson(res, 400, { ok: false, error: "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u662F FEMO\u6A21\u5F0F\uFF1A\u8BF7\u5148\u5728\u4F1A\u8BDD\u4E0A\u65B9\u7684\u6A21\u5F0F\u83DC\u5355\u9009\u62E9\u300CFEMO\u6A21\u5F0F\u300D" });
    return;
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
      writeJson(res, 400, { ok: false, error: `\u5267\u672C\u7F16\u8BD1\u5931\u8D25\uFF1A${String(error instanceof Error ? error.message : error)}` });
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
  const id = SessionId6(`femo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
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

// host/routes.ts
import { SessionId as SessionId8 } from "@deepseek-ai/dsh-session";

// host/projection-input.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { SessionId as SessionId7 } from "@deepseek-ai/dsh-session";
async function handleProjectionInput(ctx, deps, req, res) {
  const { resolved, runState } = deps;
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
  debugLog(`payload: sessionId=${sessionId} textLen=${text.length}`);
  if (sessionId.length === 0 || text.length === 0) {
    writeJson(res, 400, { ok: false, error: "sessionId and text are required" });
    return;
  }
  const sessions = ctx.get("sessions");
  let win = sessions?.get(SessionId7(sessionId));
  if (win === void 0 && sessionId.startsWith("femo-proj-")) {
    const mainSid0 = sessionId.slice("femo-proj-".length).replace(/-[^-]*$/, "");
    let mainSession = mainSid0.length > 0 ? sessions?.get(SessionId7(mainSid0)) : void 0;
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
        const scopeMap = await readTurnScopeFile(resolved.femoRoot, mainSid0);
        const scopeActors = [...new Set(Object.values(scopeMap).flat())];
        await deps.projections.ensure(mainSid0, scopeActors, cwd);
        win = sessions?.get(SessionId7(sessionId));
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
  const mainSid = typeof parentHeader === "string" && parentHeader.length > 0 ? parentHeader : sessionId.startsWith("femo-proj-") ? sessionId.slice("femo-proj-".length).replace(/-[^-]*$/, "") : "";
  const job = activeJobOfSession(runState, mainSid);
  const waiting = job !== void 0 && job.state === "running" && runState.activeJobId === job.jobId && job.waitingHuman !== void 0;
  const idle = job === void 0 || job.state !== "running" || runState.activeJobId !== job.jobId;
  const isGodWindow = sessionId.startsWith("femo-proj-") && sessionId.slice(sessionId.lastIndexOf("-") + 1) === GOD_ACTOR;
  debugLog(`judge: isGod=${isGodWindow} job=${job === void 0 ? "-" : String(job.jobId)} state=${job?.state ?? "-"} active=${String(runState.activeJobId ?? "-")} waitHuman=${job?.waitingHuman === void 0 ? "-" : JSON.stringify(job.waitingHuman)} => idle=${idle} waiting=${waiting}`);
  pushDiag("proj-input", `judge isGod=${isGodWindow} job=${job === void 0 ? "-" : String(job.jobId)} state=${job?.state ?? "-"} active=${String(runState.activeJobId ?? "-")} waitHuman=${job?.waitingHuman === void 0 ? "NONE" : JSON.stringify(job.waitingHuman)} => waiting=${waiting}`);
  if (idle && isGodWindow) {
    const bag = ctx;
    const viaProp = bag.agents?.get(mainSid);
    const viaSvc = typeof bag.get === "function" ? bag.get("agents")?.get(mainSid) : void 0;
    const agent = viaProp ?? viaSvc;
    debugLog(`branch\u2460 idle -> agent.followup mainSid=${mainSid}`);
    if (agent === void 0 || typeof agent.followup !== "function") {
      debugLog("branch\u2460 FAILED: main agent unavailable (agents service)");
      writeJson(res, 200, { ok: false, routed: "main", error: "main agent unavailable" });
      return;
    }
    agent.followup({
      id: randomUUID4(),
      role: "user",
      content: [{ type: "text", text }],
      source: { kind: "user" }
    });
    debugLog(`branch\u2460 followup queued len=${text.length}`);
    console.log(`[femo-plugin] projection input -> main followup: sid=${mainSid} len=${text.length}`);
    writeJson(res, 200, { ok: true, routed: "main", accepted: true });
    return;
  }
  if (waiting) {
    await feedHumanNode(ctx, deps, mainSid, job, text, debugLog);
    writeJson(res, 200, { ok: true, routed: "human-node" });
    return;
  }
  appendEvent(win, "user/message", {
    content: [{ type: "text", text }],
    source: { kind: "user" }
  }, { surfaceOp: "append" });
  pushDiag("proj-input", `branch\u2462 kept-local sid=${sessionId.slice(-12)} waiting=${waiting}\uFF08waiting=false \u4E14\u975E idle=\u5F15\u64CE\u5728\u8DD1\u4F46\u5BBF\u4E3B\u65E0\u4EBA\u7C7B\u7B49\u5F85\u767B\u8BB0\uFF1Bidle=\u5267\u672C\u975E running\uFF09`);
  console.log(`[femo-plugin] projection input kept local: len=${text.length}`);
  writeJson(res, 200, { ok: true, routed: "interjection-todo" });
}
async function feedHumanNode(ctx, deps, mainSid, job, text, debugLog) {
  const { bridge, projections, sessionsStore } = deps;
  const waitKeyUsed = String(job.waitingHuman?.waitKey ?? "");
  debugLog(`branch\u2461 feeding: job=${String(job.jobId)} wait_key=${waitKeyUsed} len=${text.length}`);
  const feedResult = await bridge.send("human_input", {
    job_id: job.jobId,
    wait_key: waitKeyUsed,
    body: { chat_text: text, variables: {} }
  });
  debugLog(`branch\u2461 feed result: ${JSON.stringify(feedResult)}`);
  pushDiag("proj-input", `branch\u2461 human_input delivered job=${String(job.jobId)} wait_key=${waitKeyUsed} \u2192 ${JSON.stringify(feedResult)}`);
  const main = sessionsStore?.get(SessionId7(mainSid));
  if (main !== void 0) {
    appendChatProjected(ctx, main, projections, text, "role", "\u4EBA\u7C7B");
  }
  return feedResult?.delivered ?? false;
}

// host/debug-run.ts
import { basename as basename2, dirname as dirname3, join as join11 } from "node:path";
import { mkdir as mkdir2, open, readFile as readFile2, stat as stat2, writeFile } from "node:fs/promises";
var DEBUG_TIMEOUT_MS = 18e4;
var TAIL_INTERVAL_MS = 150;
var TRANSCRIPT_MAX_LINES = 1500;
var TRANSCRIPT_HEAD_LINES = 600;
var STDERR_MAX_CHARS = 2e3;
var REPORT_SNAPSHOT_MAX = 40;
var REPORT_WARNING_MAX = 20;
var inFlight = false;
var sleep = (ms) => new Promise((resolve2) => {
  setTimeout(resolve2, ms);
});
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
async function spawnDebugger(ctx, resolved, req, mode) {
  const subprocess = ctx.get("subprocess");
  async function sweepDebugSandbox(sandboxDir2, keepDays = 3) {
    try {
      const { readdir: readdir2, stat: stat3, unlink } = await import("node:fs/promises");
      const cutoff = Date.now() - keepDays * 864e5;
      for (const name2 of await readdir2(sandboxDir2)) {
        const fp = join11(sandboxDir2, name2);
        try {
          const st = await stat3(fp);
          if (st.isFile() && st.mtimeMs < cutoff) await unlink(fp);
        } catch {
        }
      }
    } catch {
    }
  }
  if (subprocess === void 0) {
    throw new Error("subprocess \u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u65E0\u6CD5\u62C9\u8D77\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\uFF09");
  }
  const sandboxDir = join11(resolved.femoRoot, "cache", "debug-sandbox");
  await mkdir2(sandboxDir, { recursive: true });
  void sweepDebugSandbox(sandboxDir);
  const stamp = Date.now();
  const sandboxScript = join11(sandboxDir, `web-${stamp}.femo`);
  const logPath = join11(sandboxDir, `web-${stamp}.jsonl`);
  const reportPath = join11(sandboxDir, `web-${stamp}.report.json`);
  await writeFile(sandboxScript, req.femo, "utf8");
  const pythonPath = await subprocess.resolveExecutable(resolved.python);
  let baseDirArg = [];
  const savedScriptPath = req.scriptPath?.trim() ?? "";
  if (savedScriptPath.length > 0) {
    const dir = dirname3(savedScriptPath);
    try {
      await stat2(dir);
      baseDirArg = ["--base-dir", dir];
    } catch {
      console.log(`[femo-plugin] debug-run: scriptPath \u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u56DE\u9000\u6C99\u76D2\u89E3\u6790: ${dir}`);
    }
  }
  const argv = [
    pythonPath,
    join11(resolved.femoRoot, "femo2host", "femoToolcall", "femo_debugger.py"),
    "run",
    sandboxScript,
    "--quiet",
    "--log-jsonl",
    logPath,
    // 终报 JSON：工具路径的唯一权威汇总（人读版 print_report 只进 stdout）。
    "--report",
    reportPath,
    "--runs",
    String(clampRuns(req.runs)),
    ...baseDirArg
  ];
  const seed = normalizeSeed(req.seed);
  if (seed !== void 0) argv.push("--seed", String(seed));
  const debugModule = normalizeModule(req.module);
  if (debugModule !== void 0) argv.push("--module", debugModule);
  const out = [];
  const err = [];
  let procHandle;
  try {
    procHandle = subprocess.spawn({
      argv,
      cwd: resolved.femoRoot,
      stdio: { stdin: "ignore", stdout: mode === "capture" ? "pipe" : "ignore", stderr: "pipe" },
      graceMs: 3e3,
      env: { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
    });
  } catch (error) {
    throw new Error(`\u8C03\u8BD5\u5668\u5B50\u8FDB\u7A0B\u542F\u52A8\u5931\u8D25: ${String(error)}`);
  }
  procHandle.stderr?.on("data", (chunk) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      if (line.trim().length === 0) continue;
      if (mode === "capture") err.push(line);
      else process.stdout.write(`[femo-debug:stderr] ${line}
`);
      pushDiag("engine", `[stderr] ${line}`.slice(0, 400));
    }
  });
  if (mode === "capture") {
    procHandle.stdout?.on("data", (chunk) => {
      out.push(chunk.toString("utf8"));
    });
  }
  return { procHandle, sandboxScript, logPath, reportPath, out, err };
}
async function handleDebugRun(req, res, ctx, resolved) {
  if (inFlight) {
    writeJson(res, 409, { ok: false, error: "\u5DF2\u6709\u8C03\u8BD5\u5E72\u8DD1\u5728\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u518D\u70B9" });
    return;
  }
  const body = await readBody(req);
  const femo = typeof body.femo === "string" ? body.femo : "";
  if (femo.trim().length === 0) {
    writeJson(res, 400, { ok: false, error: "femo \u5267\u672C\u6587\u672C\u4E3A\u7A7A" });
    return;
  }
  const runs = clampRuns(body.runs);
  const seed = normalizeSeed(body.seed);
  const module = normalizeModule(body.module);
  inFlight = true;
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
    let spawned;
    try {
      spawned = await spawnDebugger(ctx, resolved, {
        femo,
        runs,
        ...seed !== void 0 ? { seed } : {},
        ...module !== void 0 ? { module } : {},
        ...typeof body.scriptPath === "string" ? { scriptPath: body.scriptPath } : {}
      }, "stream");
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) });
      return;
    }
    procHandle = spawned.procHandle;
    const logPath = spawned.logPath;
    req.on("close", onClientClose);
    res.on("close", onClientClose);
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
        fh = await open(logPath, "r");
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
    void procHandle.done.then((outcome2) => {
      exited = true;
    }, () => {
      exited = true;
    });
    const started = Date.now();
    let timedOut = false;
    let exitCode = -1;
    while (!exited && !clientGone) {
      await tailOnce();
      if (exited || clientGone) break;
      if (Date.now() - started > DEBUG_TIMEOUT_MS) {
        timedOut = true;
        try {
          procHandle.terminate();
        } catch {
        }
        break;
      }
      await sleep(TAIL_INTERVAL_MS);
    }
    const outcome = await procHandle.done.catch(() => void 0);
    exitCode = outcome?.exitCode ?? -1;
    await tailOnce();
    if (timedOut) send({ kind: "debug_error", error: `\u8C03\u8BD5\u5E72\u8DD1\u8D85\u65F6\uFF08${DEBUG_TIMEOUT_MS / 1e3}s\uFF09\uFF0C\u5DF2\u5F3A\u5236\u7EC8\u6B62` });
    send({ kind: "debug_done", exitCode });
  } finally {
    inFlight = false;
    req.off?.("close", onClientClose);
    res.off?.("close", onClientClose);
    if (streaming && !clientGone && !res.destroyed) res.end();
  }
}
async function collectDebugRun(ctx, resolved, req, signal) {
  if (inFlight) {
    throw new Error("\u5DF2\u6709\u8C03\u8BD5\u5E72\u8DD1\u5728\u8FDB\u884C\u4E2D\uFF08femoGen \u8C03\u8BD5\u7A97\u6216\u53E6\u4E00\u6B21 femo-debug \u8C03\u7528\uFF09\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u518D\u8BD5");
  }
  const runs = clampRuns(req.runs);
  const seed = normalizeSeed(req.seed);
  const timeoutMs = req.timeoutMs ?? DEBUG_TIMEOUT_MS;
  if (signal?.aborted === true) {
    return emptyCollect(runs, seed);
  }
  inFlight = true;
  const startedAt = Date.now();
  let spawned;
  let timedOut = false;
  let aborted = false;
  const onAbort = () => {
    aborted = true;
    if (spawned !== void 0) {
      try {
        spawned.procHandle.terminate();
      } catch {
      }
    }
  };
  try {
    spawned = await spawnDebugger(ctx, resolved, {
      ...req,
      runs,
      ...seed !== void 0 ? { seed } : {}
    }, "capture");
    const local = spawned;
    if (signal !== void 0) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    pushDiag("femo-debug", `\u5E72\u8DD1\u542F\u52A8\uFF1A${runs} \u8F6E${seed !== void 0 ? `\uFF0Cseed=${seed}` : ""}\uFF08\u6C99\u76D2\u811A\u672C ${basename2(local.sandboxScript)}\uFF09`);
    const done = local.procHandle.done.then((outcome2) => outcome2, () => void 0);
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        local.procHandle.terminate();
      } catch {
      }
    }, timeoutMs);
    try {
      await done;
    } finally {
      clearTimeout(timer);
    }
    const outcome = await done;
    const exitCode = outcome?.exitCode ?? -1;
    const rawLog = await readFile2(local.logPath, "utf8").catch(() => "");
    const records = [];
    for (const line of rawLog.split(/\r?\n/)) {
      if (line.trim().length === 0) continue;
      try {
        const rec = JSON.parse(line);
        records.push(rec);
      } catch {
      }
    }
    let report;
    try {
      report = JSON.parse(await readFile2(local.reportPath, "utf8"));
    } catch {
      report = void 0;
    }
    const { lines, dropped } = debugTranscriptLines(records);
    const stderr = local.err.join("\n");
    const elapsedMs = Date.now() - startedAt;
    let partialPath;
    if ((aborted || timedOut) && lines.length > 0) {
      partialPath = local.logPath.replace(/\.jsonl$/, ".partial.md");
      const header = `# \u5E72\u8DD1\u88AB\u4E2D\u65AD\u65F6\u7684\u90E8\u5206\u4FE1\u606F\uFF08${aborted ? "\u8C03\u7528\u65B9\u64A4\u9500\uFF08\u56DE\u5408\u88AB\u4E2D\u65AD/\u7528\u6237\u505C\u6B62\uFF09" : "\u770B\u95E8\u72D7\u8D85\u65F6\u5F3A\u5236\u7EC8\u6B62"}\uFF09

- \u6C99\u76D2\u5267\u672C\uFF1A${local.sandboxScript}
- \u539F\u59CB\u6D41\u6C34(JSONL)\uFF1A${local.logPath}
- \u7528\u65F6\uFF1A${(elapsedMs / 1e3).toFixed(1)}s\u3000\u6D41\u6C34\uFF1A${records.length} \u6761
- \u7EC8\u62A5\uFF1A\u672A\u751F\u6210\uFF08\u5F15\u64CE\u672A\u8DD1\u5B8C\uFF0C\u6CA1\u6709 --report \u4EA7\u51FA\uFF09

## \u6D41\u6C34\uFF08\u4E0E femoGen \u8C03\u8BD5\u7A97\u540C\u6B3E\u6E32\u67D3\uFF09

`;
      try {
        await writeFile(partialPath, header + lines.join("\n") + "\n", "utf8");
      } catch {
        partialPath = void 0;
      }
    }
    pushDiag("femo-debug", `\u5E72\u8DD1\u7ED3\u675F\uFF1Aexit=${exitCode} \u6D41\u6C34 ${records.length} \u6761 \u7EC8\u62A5${report === void 0 ? "\u65E0" : "\u6709"}${timedOut ? "\uFF08\u770B\u95E8\u72D7\u8D85\u65F6\uFF09" : ""}${aborted ? "\uFF08\u88AB\u64A4\u9500\uFF09" : ""} \u7528\u65F6 ${(elapsedMs / 1e3).toFixed(1)}s${partialPath !== void 0 ? `\u3000\u90E8\u5206\u4FE1\u606F\u7559\u6863\uFF1A${partialPath}` : ""}`);
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
      sandboxScript: local.sandboxScript,
      logPath: local.logPath,
      reportPath: local.reportPath
    };
  } finally {
    inFlight = false;
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
        const map = input;
        const keys = Object.keys(map);
        if (keys.length > 0) ins = `\uFF08\u5165\u53C2 ${keys.map((k) => `${k}=${JSON.stringify(map[k])}`).join("\uFF0C")}\uFF09`;
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
    lines.push(`\u672A\u8FBE\u8282\u70B9\uFF08\u672C\u573A\u4E00\u6B21\u6CA1\u8D70\u5230\u2014\u2014\u6B7B\u5206\u652F/\u6F0F\u63A5\u7EBF/\u6761\u4EF6\u6C38\u8FDC\u4E3A\u5047\uFF09\uFF1A${unreached.join("\uFF0C")}`);
  }
  return lines;
}
function debugRunToolOutcome(result) {
  const stderrTail = result.stderr.trim();
  if (result.records.length === 0 && result.report === void 0 && result.exitCode !== 0) {
    if (result.aborted) {
      return {
        ok: false,
        error: "\u672C\u6B21\u5E72\u8DD1\u5728\u4EA7\u51FA\u4EFB\u4F55\u6D41\u6C34\u4E4B\u524D\u5C31\u88AB\u64A4\u9500\uFF08\u56DE\u5408\u88AB\u4E2D\u65AD/\u7528\u6237\u505C\u6B62\uFF1B\u4E5F\u53EF\u80FD\u5361\u5728\u8D77\u8DD1\u9636\u6BB5\u2014\u2014\u770B\u8BCA\u65AD\u6D41\u7684\u300C\u5E72\u8DD1\u542F\u52A8\u300D\u90A3\u884C\u6709\u6CA1\u6709\u51FA\u73B0\uFF09\u3002\u9700\u8981\u7ED3\u679C\u7684\u8BDD\u91CD\u65B0\u8C03\u7528\u4E00\u6B21\uFF08\u8F6E\u6570\u522B\u5F00\u592A\u5927\uFF1Aruns \u662F\u7EBF\u6027\u8017\u65F6\uFF0C\u6BCF\u8F6E\u2248\u4E00\u6B21 femoGen \u8C03\u8BD5\uFF09\u3002"
      };
    }
    const errorLine = stderrTail.split("\n").reverse().find((line) => /^[A-Za-z_][\w.]*(Error|Exception|Warning)?:\s/.test(line.trim()))?.trim();
    return {
      ok: false,
      error: `\u5E72\u8DD1\u672A\u80FD\u8DD1\u8D77\u6765\uFF08\u9000\u51FA\u7801 ${result.exitCode}\uFF09\u2014\u2014${result.timedOut ? "\u770B\u95E8\u72D7\u8D85\u65F6\u5F3A\u5236\u7EC8\u6B62" : "\u7F16\u8BD1/\u88C5\u914D\u9519\u8BEF\u539F\u8BDD"}\uFF1A
` + (errorLine !== void 0 ? `${errorLine}

` : "") + (stderrTail.length > 0 ? stderrTail : "\uFF08stderr \u4E3A\u7A7A\u2014\u2014\u53EF\u76F4\u63A5\u8DD1 femoGen\u300C\u7F16\u8BD1\u300D\u6309\u94AE\u770B\u62A5\u9519\uFF09")
    };
  }
  const parts = [];
  parts.push("\u{1F4CB} \u5267\u672C\u5E72\u8DD1\uFF08\u96F6 token \u7A7A\u8DD1\uFF1AAI/\u4EBA\u7C7B\u8282\u70B9\u5168\u90E8\u7531\u8C03\u8BD5\u5668\u5408\u6210\u66FF\u7B54\uFF0C\u672A\u8C03\u7528\u4EFB\u4F55\u6A21\u578B\uFF09");
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
  parts.push(`\u9000\u51FA\u7801 ${exitCodeNote(result.exitCode)}\u3000\xB7\u3000\u7528\u65F6 ${(result.elapsedMs / 1e3).toFixed(1)}s\u3000\xB7\u3000\u6C99\u76D2\u5267\u672C\uFF1A${result.sandboxScript}\u3000\xB7\u3000\u5B8C\u6574\u6D41\u6C34(JSONL)\uFF1A${result.logPath}` + (result.partialPath !== void 0 ? `\u3000\xB7\u3000\u90E8\u5206\u4FE1\u606F\u7559\u6863\uFF1A${result.partialPath}` : "") + (result.report !== void 0 ? `\u3000\xB7\u3000\u7EC8\u62A5(JSON)\uFF1A${result.reportPath}` : ""));
  if (result.stderr.trim().length > 0 && result.report === void 0) {
    parts.push("");
    parts.push(`\u5F15\u64CE stderr \u5C3E\u90E8\uFF08\u8BCA\u65AD\u7528\uFF09\uFF1A
${result.stderr.trim().slice(-800)}`);
  }
  return { ok: true, text: parts.join("\n") };
}

// host/routes.ts
function registerRoutes(ctx, deps) {
  const { resolved, bridge, runState, projections, sessionsStore, godMirror, recordError } = deps;
  const webServer = ctx.get("webServer");
  if (webServer !== void 0 && typeof webServer.register === "function") {
    let readSessionEventCountFor2 = function(ctx2, id) {
      const sessions = ctx2.get("sessions");
      const s = sessions?.get(SessionId8(id));
      return s?.events?.length ?? -1;
    };
    var readSessionEventCountFor = readSessionEventCountFor2;
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
      path: "/femo-plugin/debug-list-children",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const parent = url.searchParams.get("sessionId") ?? "";
        const subagents = ctx.get("subagents");
        if (subagents?.listChildren === void 0 || parent.length === 0) {
          writeJson(res, 400, { ok: false, error: "listChildren unavailable or sessionId required" });
          return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error("debug timeout 20s")), 2e4);
        void subagents.listChildren(SessionId8(parent), controller.signal).then((rows) => {
          clearTimeout(timer);
          writeJson(res, 200, { ok: true, rows });
        }).catch((error) => {
          clearTimeout(timer);
          writeJson(res, 500, { ok: false, error: String(error).slice(0, 400) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/debug-materialize",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const id = url.searchParams.get("sessionId") ?? "";
        if (id.length === 0) {
          writeJson(res, 400, { ok: false, error: "sessionId required" });
          return;
        }
        const persistence = ctx.get("sessionPersistence");
        const sessions = ctx.get("sessions");
        void (async () => {
          const out = {};
          if (persistence === void 0 || typeof persistence.readStoredLog !== "function") {
            writeJson(res, 400, { ok: false, error: "persistence.readStoredLog unavailable" });
            return;
          }
          const stored = await (async () => {
            const locate = persistence.locate;
            const loc = typeof persistence.locate === "function" ? persistence.locate.call(persistence, { cwd: "D:\\myFiles\\dsh", id: SessionId8(id) }) : locate?.call(persistence, { cwd: "D:\\myFiles\\dsh", id: SessionId8(id) });
            out.locatedPath = loc?.path;
            const read = persistence.readStoredLog.bind(persistence);
            return await read(loc?.path ?? id, SessionId8(id));
          })();
          const rec = stored;
          out.storedKeys = rec !== null && typeof rec === "object" ? Object.keys(rec) : null;
          if (rec !== null && typeof rec === "object") {
            for (const [k, v] of Object.entries(rec)) {
              if (Array.isArray(v)) out[`arr:${k}`] = `array(${v.length}) head=${JSON.stringify(v[0])?.slice(0, 200)}`;
              else if (v !== null && typeof v === "object") out[`obj:${k}`] = Object.keys(v).slice(0, 10);
              else out[k] = String(v).slice(0, 80);
            }
          }
          writeJson(res, 200, { ok: true, out });
        })().catch((error) => writeJson(res, 500, { ok: false, error: String(error).slice(0, 400) }));
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/debug-live-events",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const id = url.searchParams.get("sessionId") ?? "";
        const session = id.length > 0 ? sessionsStore?.get?.(SessionId8(id)) : void 0;
        if (session === void 0) {
          writeJson(res, 404, { ok: false, error: "session not live in host store" });
          return;
        }
        writeJson(res, 200, {
          ok: true,
          id,
          eventCount: session.events?.length ?? -1,
          seq: session.seq,
          inheritedEventCount: session.inheritedEventCount,
          createdAt: session.header?.createdAt
        });
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
          const actors = await readActorUsageFile(resolved.femoRoot, sid);
          writeJson(res, 200, { ok: true, actors: actors ?? {} });
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
          const soul_id = typeof body.soul_id === "string" ? body.soul_id.trim() : "";
          if (soul_id.length === 0) {
            writeJson(res, 400, { ok: false, error: "soul_id is required" });
            return;
          }
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
        void (async () => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const sessionId = url.searchParams.get("sessionId");
          if (sessionId === null || sessionId.length === 0) {
            writeJson(res, 400, { ok: false, error: "sessionId is required" });
            return;
          }
          const rawJobId = url.searchParams.get("jobId");
          const explicitJobId = rawJobId !== null && /^\d+$/.test(rawJobId) ? Number(rawJobId) : void 0;
          if (explicitJobId !== void 0) {
            try {
              const st = await bridge.send("get_job_state", { job_id: explicitJobId }, 15e3);
              if (st?.host_ref !== sessionId) {
                const denied = `Job ${explicitJobId} \u4E0D\u5C5E\u4E8E\u4F1A\u8BDD ${sessionId}\uFF08\u5F52\u5C5E ${st?.host_ref ?? "?"}\uFF09\uFF0C\u62D2\u7EDD\u6682\u505C`;
                recordError(sessionId, `\u23F8 \u6682\u505C\u5931\u8D25\uFF1A${denied}`);
                pushDiag("pause", `DENIED sid=${sessionId} job=${explicitJobId}\uFF08\u5F52\u5C5E ${st?.host_ref ?? "?"}\uFF09`);
                writeJson(res, 403, { ok: false, error: denied });
                return;
              }
              const result = await bridge.send("job_pause", { job_id: explicitJobId }, 15e3);
              console.log(`[femo-plugin] pause (explicit) sid=${sessionId} job=${explicitJobId} -> paused=${result?.paused === true} state=${String(result?.state ?? "-")} confirmed=${result?.confirmed === true}`);
              writeJson(res, 200, { ok: true, paused: result?.paused === true, state: result?.state, confirmed: result?.confirmed === true, job_id: explicitJobId });
            } catch (error) {
              const msg = String(error instanceof Error ? error.message : error);
              console.log(`[femo-plugin] pause (explicit) sid=${sessionId} job=${explicitJobId} FAILED: ${msg}`);
              recordError(sessionId, `\u23F8 \u6682\u505C\u5931\u8D25\uFF1A\u5F15\u64CE\u65E0\u54CD\u5E94\uFF08${msg}\uFF09\u3002\u5F15\u64CE\u53EF\u80FD\u5DF2\u50F5\u6B7B\uFF0C\u91CD\u542F\u5BBF\u4E3B\u540E\u5BF9\u8D26\u6062\u590D`);
              pushDiag("pause", `FAILED (explicit) sid=${sessionId} job=${explicitJobId}: ${msg}`);
              writeJson(res, 404, { ok: false, error: msg });
            }
            return;
          }
          const job = activeJobOfSession(runState, sessionId);
          const jobId = job?.state === "running" && runState.activeJobId === job?.jobId ? job?.jobId : void 0;
          console.log(`[femo-plugin] pause sid=${sessionId} mirrorJob=${String(job?.jobId ?? "-")} activeJobId=${String(runState.activeJobId ?? "-")} -> resolved=${String(jobId ?? "none")}`);
          if (jobId === void 0) {
            writeJson(res, 200, { ok: true, paused: false, note: "\u8BE5\u4F1A\u8BDD\u65E0\u6D3B\u8DC3\u5267\u672C" });
            return;
          }
          try {
            const result = await bridge.send("job_pause", { job_id: jobId }, 15e3);
            console.log(`[femo-plugin] pause (mirror) sid=${sessionId} job=${jobId} -> paused=${result?.paused === true} state=${String(result?.state ?? "-")} confirmed=${result?.confirmed === true}`);
            writeJson(res, 200, { ok: true, paused: result?.paused === true, state: result?.state, confirmed: result?.confirmed === true, job_id: jobId });
          } catch (error) {
            const msg = String(error instanceof Error ? error.message : error);
            recordError(sessionId, `\u23F8 \u6682\u505C\u5931\u8D25\uFF1A\u5F15\u64CE\u65E0\u54CD\u5E94\uFF08${msg}\uFF09\u3002\u5F15\u64CE\u53EF\u80FD\u5DF2\u50F5\u6B7B\uFF0C\u91CD\u542F\u5BBF\u4E3B\u540E\u5BF9\u8D26\u6062\u590D`);
            pushDiag("pause", `FAILED (mirror) sid=${sessionId} job=${jobId}: ${msg}`);
            writeJson(res, 500, { ok: false, error: msg });
          }
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/turn-scopes",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const sessionId = url.searchParams.get("sessionId");
        if (sessionId === null || sessionId.length === 0) {
          writeJson(res, 400, { ok: false, error: "sessionId is required" });
          return;
        }
        let scopes = turnScopesBySession.get(sessionId);
        if (scopes === void 0) {
          void readTurnScopeFile(resolved.femoRoot, sessionId).then((record) => {
            const rebuilt = /* @__PURE__ */ new Map();
            for (const key of Object.keys(record)) {
              const scope = record[key];
              if (Array.isArray(scope)) rebuilt.set(Number(key), scope);
            }
            if (rebuilt.size > 0) turnScopesBySession.set(sessionId, rebuilt);
            const out2 = {};
            for (const [turn, scope] of rebuilt) out2[String(turn)] = scope;
            writeJson(res, 200, { ok: true, scopes: out2 });
          }).catch((error) => {
            writeJson(res, 500, { ok: false, error: String(error) });
          });
          return;
        }
        const out = {};
        for (const [turn, scope] of scopes) out[String(turn)] = scope;
        writeJson(res, 200, { ok: true, scopes: out });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/jobs",
      handler: (_req, res) => {
        bridge.send("list_jobs", {}, 15e3).then((result) => {
          const jobs = result?.jobs ?? [];
          writeJson(res, 200, { ok: true, jobs });
        }).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
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
          const delivered = await bridge.send("human_input", {
            job_id: job.jobId,
            wait_key: waitKey,
            body: { chat_text: chatText, variables }
          });
          writeJson(res, 200, { ok: true, delivered: delivered?.delivered ?? false });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
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
        void readTurnScopeFile(resolved.femoRoot, sessionId).then((record) => {
          const actors = [...new Set(Object.values(record).flat())];
          console.log(`[femo-plugin][diag] GET /actors ${sessionId}: mem miss, turn_scopes fallback=${JSON.stringify(actors)}`);
          writeJson(res, 200, { ok: true, actors });
        }).catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/projection-state",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const sessionId = url.searchParams.get("sessionId") ?? "";
        if (sessionId.length === 0 || !sessionId.startsWith("femo-proj-")) {
          writeJson(res, 200, { ok: true, winKind: "none" });
          return;
        }
        const suffix = sessionId.slice("femo-proj-".length);
        const mainSid = suffix.replace(/-[^-]*$/, "");
        const actorKey = suffix.includes("-") ? suffix.slice(suffix.lastIndexOf("-") + 1) : void 0;
        if (actorKey === void 0 || actorKey.length === 0) {
          writeJson(res, 200, { ok: true, winKind: "none" });
          return;
        }
        const winKind = actorKey === "god" ? "god" : actorKey === "stage" ? "stage" : "actor";
        const state = projectionStateOf(runState, mainSid);
        const resolveActor = (actors) => actors.find((name2) => projectionActorKey(name2) === actorKey);
        const mem = runState.sessionActors.get(mainSid);
        if (mem !== void 0 && mem.length > 0) {
          writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor: resolveActor(mem), ...state });
          return;
        }
        void readTurnScopeFile(resolved.femoRoot, mainSid).then((record) => {
          const actors = [...new Set(Object.values(record).flat())];
          writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor: resolveActor(actors), ...state });
        }).catch(() => {
          writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor: void 0, ...state });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/session-script",
      handler: (req, res) => {
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
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/session-state",
      handler: (req, res) => {
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
            const pendingJobIds = await readSessionJobIds(resolved.femoRoot, mainSid);
            writeJson(res, 200, {
              ok: true,
              pending: true,
              hasScript: script !== void 0,
              script: script ?? void 0,
              scriptPath: record?.path ?? void 0,
              rev: record?.rev ?? 0,
              jobId: pendingJobId,
              ...pendingJobIds !== void 0 ? { jobIds: pendingJobIds } : {},
              checkpoint: {},
              running: false
            });
            return;
          }
          let checkpoint = {};
          let jobState;
          let lastError;
          const jobId = pendingJobId;
          if (jobId !== void 0) {
            const sessionKnown = (() => {
              try {
                return sessionsStore?.get(SessionId8(mainSid)) !== void 0;
              } catch {
                return false;
              }
            })();
            const state = await bridge.send("get_job_state", {
              job_id: jobId,
              ...sessionKnown ? { reconcile_if_stale: true } : {}
            }, 15e3);
            if (state !== void 0 && state.state !== void 0) {
              jobState = state.state;
              if (jobState === "failed" && state.error !== void 0 && state.error.length > 0) {
                lastError = state.error;
              }
              const mirror = runState.jobs.get(jobId);
              const mirrorRunning = mirror !== void 0 && mirror.state === "running";
              const engineRunning = jobState === "running";
              const settleMirror = (finalState) => {
                if (runState.jobs.get(jobId) === void 0) {
                  jobMirrorPrearm(runState, jobId, mainSid);
                }
                jobMirrorSetState(runState, jobId, finalState);
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
                  const finalState = pauseState ?? jobState;
                  settleMirror(finalState);
                  jobState = finalState;
                } else if (pauseState === "running") {
                  settleMirror("running");
                } else {
                  const finalState = pauseState ?? "suspended";
                  settleMirror(finalState);
                  jobState = finalState;
                }
              } else if (mirrorRunning && !engineRunning) {
                jobMirrorSetState(runState, jobId, jobState);
              }
              const labels = state.checkpoint_labels ?? {};
              checkpoint = Object.fromEntries(
                Object.entries(state.checkpoints ?? {}).map(([tid, nid]) => [tid, labels[tid] ?? nid])
              );
            } else if (state !== void 0) {
              const ghostMirror = runState.jobs.get(jobId);
              if (ghostMirror !== void 0 && ghostMirror.state === "running") {
                jobMirrorSetState(runState, jobId, "suspended");
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
            running: isSessionRunning(runState, mainSid),
            ...lastError !== void 0 ? { lastError } : {},
            ...waitingMirror?.waitingHuman !== void 0 ? { waitingHuman: waitingMirror.waitingHuman } : {}
          });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/job",
      handler: (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const raw = url.searchParams.get("job_id");
          const jobId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : void 0;
          if (jobId === void 0) {
            writeJson(res, 400, { ok: false, error: "job_id is required" });
            return;
          }
          if (!bridge.alive) {
            writeJson(res, 503, { ok: false, error: "\u5F15\u64CE\u542F\u52A8\u4E2D\uFF08bridge \u672A\u5C31\u7EEA\uFF09" });
            return;
          }
          try {
            const job = await bridge.send("get_job_state", { job_id: jobId }, 15e3);
            if (job?.state === void 0) {
              writeJson(res, 404, { ok: false, error: String(job?.error ?? "no_such_job") });
              return;
            }
            writeJson(res, 200, { ok: true, job });
          } catch (error) {
            const msg = String(error instanceof Error ? error.message : error);
            writeJson(res, 404, { ok: false, error: msg });
          }
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
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
        for (const event of runState.lastEvents) {
          if (event.type === "femo_stream") continue;
          res.write(`data: ${JSON.stringify({ type: event.type, data: event.data ?? {}, replay: true })}

`);
        }
        sseClients.add(res);
        const cleanup = () => {
          sseClients.delete(res);
        };
        req.on("close", cleanup);
        res.on("close", cleanup);
        const heartbeat = setInterval(() => {
          try {
            res.write(": ping\n\n");
          } catch {
            clearInterval(heartbeat);
          }
        }, 15e3);
        res.on("close", () => clearInterval(heartbeat));
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/pick-directory",
      handler: (_req, res) => {
        void (async () => {
          const picker = ctx.get("directoryPicker");
          if (picker === void 0) {
            writeJson(res, 500, { ok: false, error: "directoryPicker service unavailable" });
            return;
          }
          const cap = picker.capability();
          if (cap.kind === "native" && typeof cap.pick === "function") {
            const dir = await cap.pick(new AbortController().signal);
            writeJson(res, 200, { ok: true, directory: dir });
          } else {
            writeJson(res, 501, { ok: false, error: "directoryPicker backend is browse; path entry unsupported yet", kind: cap.kind });
          }
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
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
        void (async () => {
          const { spawn } = await import("node:child_process");
          const ps = [
            "$ErrorActionPreference='Stop'",
            "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)",
            "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
            // 与 pick-save-path 同款：TopMost 隐形 owner 强制对话框置顶——
            // 无 owner 时对话框压在 dsh 主窗口后，用户只见请求悬挂。
            "$o = New-Object System.Windows.Forms.Form",
            "$o.TopMost = $true",
            "$d = New-Object System.Windows.Forms.OpenFileDialog",
            "$d.Title = 'Import FEMO Script'",
            "$d.Filter = 'FEMO Script (*.femo)|*.femo|All Files (*.*)|*.*'",
            "if ($d.ShowDialog($o) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) } else { exit 2 }"
          ].join("; ");
          const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true });
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
          }, 6e5);
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
          if (code === 0 && picked.length > 0) {
            const { readFileSync } = await import("node:fs");
            let content;
            try {
              content = readFileSync(picked, "utf8");
            } catch (error) {
              writeJson(res, 500, { ok: false, error: `cannot read ${picked}: ${String(error)}` });
              return;
            }
            await rememberFemoFile(resolved.femoRoot, picked, "import");
            writeJson(res, 200, { ok: true, path: picked, content });
            return;
          }
          if (code === 2) {
            writeJson(res, 200, { ok: true, path: null });
            return;
          }
          writeJson(res, 500, { ok: false, error: `pick-script failed (exit ${String(code)})${err.trim().length > 0 ? `: ${err.trim().slice(-400)}` : ""}` });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
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
          const { spawn } = await import("node:child_process");
          const ps = [
            "$ErrorActionPreference='Stop'",
            "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)",
            "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
            // 无 owner 的对话框会被压在 dsh 主窗口后面（用户只见「保存中」永转圈）。
            // 造一个 TopMost 隐形窗当 owner（从不 Show，不占任务栏），强制对话框置顶。
            "$o = New-Object System.Windows.Forms.Form",
            "$o.TopMost = $true",
            "$d = New-Object System.Windows.Forms.SaveFileDialog",
            "$d.Title = 'Save FEMO Script'",
            "$d.Filter = 'FEMO Script (*.femo)|*.femo|All Files (*.*)|*.*'",
            `$d.FileName = '${base.replace(/\.femo$/i, "").replace(/'/g, "''")}.femo'`,
            "if ($d.ShowDialog($o) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) } else { exit 2 }"
          ].join("; ");
          const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true });
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
          }, 6e5);
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
          if (code === 0 && picked.length > 0) {
            writeJson(res, 200, { ok: true, path: picked });
            return;
          }
          if (code === 2) {
            writeJson(res, 200, { ok: true, path: null });
            return;
          }
          writeJson(res, 500, { ok: false, error: `pick-save-path failed (exit ${String(code)})${err.trim().length > 0 ? `: ${err.trim().slice(-400)}` : ""}` });
        })().catch((error) => {
          writeJson(res, 500, { ok: false, error: String(error) });
        });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/debug-log",
      handler: (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const msg = (url.searchParams.get("msg") ?? "").slice(0, 300);
        console.log(`[femo-plugin][front] ${msg}`);
        writeJson(res, 200, { ok: true });
      }
    });
    webServer.register({
      kind: "exact",
      path: "/femo-plugin/projection-windows",
      handler: (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const sessionId = url.searchParams.get("sessionId");
          if (sessionId === null || sessionId.length === 0) {
            writeJson(res, 400, { ok: false, error: "sessionId is required" });
            return;
          }
          let windows = projections.get(sessionId);
          if (windows === void 0) {
            let main = sessionsStore?.get(SessionId8(sessionId));
            if (main === void 0) {
              main = await ensureSessionLive(ctx, SessionId8(sessionId), "projection-windows", sessionsStore);
            }
            const cwd = main?.header?.cwd;
            if (main === void 0 || cwd === void 0) {
              writeJson(res, 503, {
                ok: false,
                kind: "main-not-loaded",
                error: "\u4E3B\u4F1A\u8BDD\u672A\u88C5\u8F7D\uFF08\u81EA\u52A8\u62C9\u6D3B\u5931\u8D25\uFF09\uFF1A\u5148\u6253\u5F00\u4E00\u6B21\u4E3B\u4F1A\u8BDD\uFF08\u620F\u5916 \xB7 \u4E3B\u6A21\u578B\uFF09\u518D\u70B9\u89C6\u89D2\uFF1B\u4E00\u76F4\u5931\u8D25\u8BF7\u770B\u5BBF\u4E3B\u65E5\u5FD7 [femo-run-diag]"
              });
              return;
            }
            const scopeMap = await readTurnScopeFile(resolved.femoRoot, sessionId);
            const scopeActors = [...new Set(Object.values(scopeMap).flat())];
            windows = await projections.ensure(sessionId, scopeActors, cwd);
          }
          await godMirror.ensureGodMirrorUpToDate(sessionId);
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
          ensureMainLive: (mainSid) => ensureSessionLive(ctx, SessionId8(mainSid), "projection-input", sessionsStore)
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

// host/tools.ts
function callerSessionId(deps, agent) {
  if (agent === void 0 || !deps.isFemoMainSession(agent)) return null;
  return String(agent.session.id);
}
var mountTool = {
  name: "femo-mount",
  description: "\u628A\u5267\u672C\u6587\u4EF6\u6302\u8F7D\u5230\u5F53\u524D Femo \u4F1A\u8BDD\uFF1A\u7528\u6237\u4F1A\u5728 femogen \u7F16\u8F91\u5668\u91CC\u7ACB\u523B\u770B\u5230\u8FD9\u4E2A\u5267\u672C\uFF0C\u53EF\u4EE5\u67E5\u770B/\u7F16\u8F91\u3002\u5199\u5267\u672C\u65F6\u7528\u6587\u4EF6\u5DE5\u5177\u628A .femo \u5199\u5230 user_data/projects/ \u4E0B\uFF0C\u7136\u540E\u8C03\u7528\u672C\u5DE5\u5177\u6302\u8F7D\u3002\u53C2\u6570 scriptPath \u662F\u5267\u672C\u6587\u4EF6\u7684\u5B8C\u6574\u8DEF\u5F84\u3002",
  parameters: {
    type: "object",
    properties: {
      scriptPath: {
        type: "string",
        description: "\u5267\u672C\u6587\u4EF6\u5B8C\u6574\u8DEF\u5F84\uFF08.femo\uFF09"
      }
    },
    required: ["scriptPath"],
    additionalProperties: false
  }
};
var runTool = {
  name: "femo-run",
  description: "\u63A7\u5236\u5F53\u524D Femo \u4F1A\u8BDD\u7684\u5267\u672C\u8FD0\u884C\u3002action \u5FC5\u586B\uFF0C\u56DB\u9009\u4E00\uFF1A\n- fresh_start\uFF1A\u4ECE\u5934\u5F00\u6F14\u5DF2\u6302\u8F7D\u7684\u5267\u672C\uFF08\u4E0A\u4E00\u573A\u82E5\u6302\u8D77\u4F1A\u81EA\u52A8\u5B58\u6863\uFF0C\u53EF\u7EED\u8DD1\u627E\u56DE\uFF09\uFF1B\u8FD4\u56DE\u503C\u5E26\u672C\u6B21\u5F00\u6F14\u7684 job_id\n- pause\uFF1A\u6682\u505C\u5E76\u6302\u8D77\u672C\u4F1A\u8BDD\u5F53\u524D\u6B63\u5728\u8FD0\u884C\u7684\u5267\u672C\uFF08\u65AD\u70B9\u4FDD\u7559\uFF0C\u53EF resume \u7EED\u8DD1\uFF09\uFF1B\u4E0D\u9700\u8981 job_id\u2014\u2014\u81EA\u52A8\u505C\u672C\u4F1A\u8BDD\u6B63\u5728\u8DD1\u7684 Job\n- resume\uFF1A\u4ECE\u6302\u8D77\u5904\u7EED\u8DD1\uFF0C\u5FC5\u987B\u5E26 job_id \u6307\u540D\u8981\u7EED\u8DD1\u54EA\u4E2A Job\uFF08\u4E00\u4E2A\u4F1A\u8BDD\u53EF\u80FD\u6302\u8D77\u591A\u4E2A Job\uFF1B\u516D\u5173\u88C1\u51B3\uFF0C\u6539\u4E86\u5267\u672C/\u65E0\u65AD\u70B9\u4F1A\u660E\u786E\u62A5\u9519\uFF09\n- list_jobs\uFF1A\u5217\u51FA\u5168\u90E8 Job\uFF08\u72B6\u6001/\u573A\u6B21/\u5F52\u5C5E\u2014\u2014\u67E5\u627E\u6302\u8D77 Job \u7684 job_id \u7528\uFF09\n\u8FD0\u884C\u540E\u5267\u672C\u7531\u5F15\u64CE\u9A71\u52A8\uFF0C\u89D2\u8272\u53D1\u8A00\u663E\u793A\u5728\u6295\u5F71\u7A97\uFF0C\u4E0D\u8FDB\u5165\u4F60\u7684\u4E0A\u4E0B\u6587\uFF1B\u7F16\u8BD1\u9519\u8BEF\u968F\u672C\u5DE5\u5177\u8FD4\u56DE\u503C\u7ED9\u51FA\uFF1B\u8DD1\u5230\u4E00\u534A\u62A5\u9519\u6216\u5168\u90E8\u8DD1\u5B8C\u65F6\uFF0C\u4F1A\u6709\u4E00\u6761 [femo-plugin] \u5F00\u5934\u7684\u63D2\u4EF6\u6D88\u606F\u76F4\u63A5\u53D1\u8FDB\u4F60\u7684\u5BF9\u8BDD\u6D41\u3002",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["fresh_start", "pause", "resume", "list_jobs"],
        description: "\u5BF9\u5267\u672C\u8FD0\u884C\u7684\u63A7\u5236\u52A8\u4F5C\uFF1Afresh_start=\u4ECE\u5934\u5F00\u6F14 / pause=\u6682\u505C\u5E76\u6302\u8D77 / resume=\u4ECE\u6302\u8D77\u5904\u7EED\u8DD1 / list_jobs=\u5217\u51FA\u5168\u90E8 Job"
      },
      job_id: {
        type: "number",
        description: "resume \u5FC5\u586B\uFF1A\u8981\u7EED\u8DD1\u7684 Job \u7F16\u53F7\uFF08\u5148 list_jobs \u67E5\u8BE2\uFF09\u3002fresh_start / pause / list_jobs \u4E0D\u9700\u8981\u4F20\u672C\u53C2\u6570"
      }
    },
    required: ["action"],
    additionalProperties: false
  }
};
var debugTool = {
  name: "femo-debug",
  description: "\u96F6 token \u7A7A\u8DD1\uFF08\u5E72\u8DD1\uFF09\u672C\u4F1A\u8BDD\u5F53\u524D\u6302\u8F7D\u7684\u5267\u672C\uFF1A\u4E0D\u8C03\u7528\u4EFB\u4F55 AI/\u4EBA\u7C7B\u2014\u2014\u6240\u6709 AI \u52A8\u4F5C\u4E0E\u4EBA\u7C7B\u8F93\u5165\u7531\u8C03\u8BD5\u5668\u5408\u6210\u66FF\u7B54\uFF0C\u5F15\u64CE\u6309\u771F\u5B9E\u7BA1\u7EBF\uFF08\u8D4B\u503C\u6821\u9A8C/\u6761\u4EF6\u8FB9/\u5FAA\u73AF/\u5E76\u884C/\u6A21\u5757/@func\uFF09\u8DD1\u5B8C\u6574\u6D41\u7A0B\u3002\n\u7528\u9014\uFF1A\u6B63\u5F0F\u8FD0\u884C\u524D\u81EA\u68C0\u5267\u672C\u2014\u2014\u8BED\u6CD5\u4E0E\u63A5\u7EBF\u3001\u5206\u652F\u8D70\u5411\u3001\u53D8\u91CF\u8D4B\u503C\u3001\u5FAA\u73AF\u80FD\u4E0D\u80FD\u9000\u51FA\u3001\u6B7B\u5FAA\u73AF\u3001\u4E00\u6B21\u90FD\u6CA1\u8D70\u5230\u7684\u8282\u70B9\uFF0C\u90FD\u80FD\u4ECE\u8FD4\u56DE\u91CC\u770B\u51FA\u6765\u3002\u5199\u5B8C\u6216\u6539\u5B8C\u5267\u672C\u5148\u5E72\u8DD1\u4E00\u904D\uFF0C\u6709\u95EE\u9898\u7167\u7740\u6D41\u6C34\u6539\uFF0C\u6539\u5B8C\u518D\u8DD1\uFF0C\u76F4\u5230\u5E72\u8DD1\u5E72\u51C0\u518D femo-run\u3002\n\u5267\u672C\u5206\u6A21\u5757\u65F6\uFF0C\u53EF\u7528 module \u53C2\u6570\u53EA\u5E72\u8DD1\u67D0\u4E2A\u6A21\u5757\uFF08\u6A21\u5757\u5355\u6D4B\uFF0C\u5D4C\u5957\u7528\u70B9\u8DEF\u5F84 \u5916\u5C42.\u5185\u5C42\uFF09\u2014\u2014\u6539\u4E86\u54EA\u4E2A\u6A21\u5757\u5C31\u5148\u5355\u6D4B\u54EA\u4E2A\uFF0C\u518D\u8DD1\u6574\u5267\u672C\u3002\n\u8FD4\u56DE\u4E24\u90E8\u5206\uFF1A\u2460\u9010\u6761\u8C03\u8BD5\u6D41\u6C34\uFF08\u8282\u70B9\u8FDB\u51FA\u3001\u53D8\u91CF old\u2192new\u3001AI \u5408\u6210\u8D4B\u503C\u4E0E\u6765\u6E90\u3001\u4EBA\u7C7B\u5408\u6210\u8F93\u5165\u3001\u91CD\u8BD5\u3001\u544A\u8B66\uFF09\uFF1B\u2461\u7EC8\u62A5\uFF08\u6BCF\u8F6E\u7ED3\u5C40\u4E0E\u62A5\u9519\u3001\u8282\u70B9\u6267\u884C\u987A\u5E8F\u3001\u8FB9\u8986\u76D6\u3001\u53D8\u91CF\u5FEB\u7167 diff\u3001\u672A\u8FBE\u8282\u70B9\uFF09\u3002\u7F16\u8BD1\u5931\u8D25\u65F6\u628A\u7F16\u8BD1\u5668\u62A5\u9519\u539F\u8BDD\u8FD4\u56DE\u3002\n\u7279\u6027\uFF1A\u4E0D\u5360 Job\u3001\u4E0D\u5199\u751F\u4EA7\u53F0\u8D26\uFF08\u5F15\u64CE\u7528\u72EC\u7ACB DB \u6C99\u76D2\u8DD1\uFF09\u3001\u53EF\u4E0E\u6B63\u5F0F\u6F14\u51FA\u5E76\u884C\u3001\u53EF\u53CD\u590D\u8C03\u7528\uFF1B\u540C\u4E00\u65F6\u523B\u53EA\u5141\u8BB8\u4E00\u6761\u5E72\u8DD1\uFF08\u8C03\u8BD5\u7A97\u6B63\u5728\u8DD1\u65F6\u4F1A\u660E\u786E\u62A5\u9519\uFF09\u3002\n\u8017\u65F6\uFF1A\u5355\u8F6E\u5E72\u8DD1\u2248\u4F60\u5728 femoGen \u70B9\u4E00\u6B21\u300C\u8C03\u8BD5\u300D\uFF08\u5C0F\u5267\u672C\u51E0\u79D2\uFF0C\u5927\u5267\u672C\u6BCF\u8F6E\u53EF\u80FD\u5341\u51E0\u79D2\uFF09\uFF1Bruns \u662F\u7EBF\u6027\u53E0\u52A0\u2014\u2014runs=6 \u5C31\u662F\u516D\u4EFD\u65F6\u95F4\uFF08\u5B9E\u6D4B\u4E00\u4E2A 9KB \u5267\u672C 6 \u8F6E\u8DD1\u4E86 63 \u79D2\uFF09\u3002\u5148\u5355\u8F6E\u8DD1\u901A\uFF0C\u53EA\u6709\u786E\u5B9E\u8981\u649E\u968F\u673A\u5206\u652F/\u6982\u7387\u6C89\u9ED8\u65F6\u518D\u52A0\u8F6E\u6570\uFF1B\u522B\u628A\u5B83\u5F53\u79D2\u7EA7\u81EA\u68C0\u7528\u3002\n\u6CE8\u610F\uFF1A\u8DD1\u7684\u662F\u300C\u5F53\u524D\u6302\u8F7D\u7684\u5267\u672C\u300D\uFF08\u5148 femo-mount \u6302\u8F7D\u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165\u2014\u2014\u6302\u8F7D\u540E\u6539\u52A8\u8981\u91CD\u65B0\u6302\u8F7D\uFF09\uFF1B\u5408\u6210\u8F93\u5165\u662F\u8C03\u8BD5\u5668\u6309 out \u58F0\u660E/\u521D\u503C\u7C7B\u578B\u731C\u7684\uFF0C\u53EA\u7528\u4E8E\u9A8C\u8BC1\u6D41\u7A0B\uFF0C\u4E0D\u4EE3\u8868\u5185\u5BB9\u8D28\u91CF\u3002",
  parameters: {
    type: "object",
    properties: {
      runs: {
        type: "number",
        description: "\u8DD1\u51E0\u8F6E\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4 1\uFF0C\u4E0A\u9650 20\uFF09\u3002\u6BCF\u8F6E\u6362\u79CD\u5B50\u2014\u2014\u591A\u8DD1\u51E0\u8F6E\u80FD\u649E\u51FA\u6982\u7387\u578B\u5206\u652F/\u968F\u673A\u6C89\u9ED8\u7684\u8DEF\u5F84\u3002\u6CE8\u610F\u8017\u65F6\uFF1A\u6BCF\u8F6E \u2248 \u4E00\u6B21\u5B8C\u6574 femoGen \u8C03\u8BD5\uFF0C\u662F\u7EBF\u6027\u53E0\u52A0\uFF08\u5927\u5267\u672C\u6BCF\u8F6E\u53EF\u80FD\u5341\u51E0\u79D2\uFF09"
      },
      seed: {
        type: "number",
        description: "\u8D77\u59CB\u968F\u673A\u79CD\u5B50\uFF08\u53EF\u9009\uFF1B\u540C\u4E00\u4E2A seed \u53EF\u590D\u73B0\u540C\u4E00\u573A\u5E72\u8DD1\uFF0C\u6392\u67E5\u968F\u673A\u5206\u652F\u65F6\u7528\uFF09"
      },
      module: {
        type: "string",
        description: "\u53EA\u5E72\u8DD1\u67D0\u4E2A module\uFF08\u53EF\u9009\uFF1B\u6A21\u5757\u5355\u6D4B\uFF09\u3002\u4F20\u5267\u672C\u91CC\u7684\u6A21\u5757\u540D\uFF0C\u5D4C\u5957\u6A21\u5757\u7528\u70B9\u8DEF\u5F84\u5982 \u5916\u5C42.\u5185\u5C42\u3002\u53EA\u8DD1\u8BE5\u6A21\u5757\u81EA\u5DF1\u7684\u6D41\u7A0B\uFF08\u5408\u6210 wrapper \u76F4\u8FDB\uFF0C\u6BCD\u94FE\u53D8\u91CF\u4E0E\u5168\u5C40\u53D8\u91CF\u7167\u5E38\u53EF\u89C1\uFF09\uFF0C\u7EC8\u62A5\u7684\u8FB9\u8986\u76D6/\u672A\u8FBE\u8282\u70B9\u4E5F\u6309\u8BE5\u6A21\u5757\u81EA\u5DF1\u7684 flow \u7B97\u3002\u6301\u7EED\u5FAA\u73AF\u578B\u6A21\u5757\uFF08\u65E0 [OUT]/[BREAK] \u51FA\u53E3\uFF09\u8DD1\u6EE1\u6B65\u6570\u9884\u7B97\u5373\u505C\uFF0Cmax_steps \u7ED3\u5C40\u4E0D\u7B97\u9519\u8BEF\u3002\u7F3A\u7701=\u8DD1\u6574\u5267\u672C"
      }
    },
    additionalProperties: false
  }
};
var viewScriptTool = {
  name: "femo-script",
  description: "\u67E5\u770B\u5F53\u524D Femo \u4F1A\u8BDD\u6302\u8F7D\u7684\u5267\u672C\u5B8C\u6574\u5185\u5BB9\uFF08\u6700\u7EC8\u751F\u6548\u7248\u672C\uFF1A\u7F16\u8F91\u5668\u539F\u6587\u4F18\u5148\uFF0C\u5426\u5219\u8BFB\u5267\u672C\u6587\u4EF6\u5730\u5740\u6307\u5411\u7684\u5185\u5BB9\uFF09\u3002\u8FD4\u56DE\u5267\u672C\u5168\u6587\u3001\u6765\u6E90\uFF08file=\u6587\u4EF6\u5730\u5740 / session-text=\u4F1A\u8BDD\u5185\u539F\u6587\uFF09\u548C\u884C\u6570\u3002\u5199\u5267\u672C/\u6539\u5267\u672C\u524D\u5148\u8C03\u7528\u672C\u5DE5\u5177\uFF0C\u4E86\u89E3\u5F53\u524D\u6302\u8F7D\u7684\u5267\u672C\u662F\u4EC0\u4E48\uFF1B\u4F1A\u8BDD\u672A\u6302\u8F7D\u5267\u672C\u65F6\u4F1A\u660E\u786E\u62A5\u9519\u3002",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false
  }
};
var soulTool = {
  name: "femo-soul",
  description: "\u7BA1\u7406\u89D2\u8272\u5E93\uFF08souls\uFF09\uFF1A\n- list\uFF1A\u67E5\u770B\u5E93\u4E2D\u5168\u90E8\u89D2\u8272\uFF08soul_id + \u540D\u5B57\uFF09\u3002\u5199\u5267\u672C\u9009\u89D2\u524D\u5148\u8C03\u7528\u672C\u5DE5\u5177\u67E5\u5E93\uFF1B\n- create\uFF1A\u65B0\u5EFA\u89D2\u8272\u3002\u53C2\u6570 soul_id\uFF08\u5267\u672C\u91CC\u7528 soul:xxx \u5F15\u7528\uFF0C\u4E0D\u80FD\u542B\u7A7A\u683C/\u9017\u53F7\uFF09\u3001soul_name\uFF08\u663E\u793A\u540D\uFF09\u3001description\uFF08\u89D2\u8272\u7684\u7075\u9B42\u8BBE\u5B9A\uFF0C\u6CE8\u5165\u7ED9\u626E\u6F14\u5B83\u7684 AI\uFF09\u3002\n\u89D2\u8272\u662F\u5168\u5C40\u7684\uFF08\u6240\u6709\u5267\u672C\u53EF\u7528\uFF09\u3002soul \u975E\u5FC5\u987B\uFF1A\u65E0\u89D2\u8272\u8BBE\u5B9A\u7684\u7B80\u5355\u5267\u672C\uFF08\u5982 goal \u6A21\u5F0F\uFF09\u53EF\u4EE5\u4E0D\u5199 soul\uFF1B\u9700\u8981\u89D2\u8272\u8BBE\u5B9A\u7684\u5267\u672C\uFF0C\u5E93\u91CC\u6CA1\u6709\u7684\u89D2\u8272\u5148\u7528\u672C\u5DE5\u5177 create \u65B0\u5EFA\uFF0C\u518D\u5728\u5267\u672C\u91CC\u5F15\u7528\u3002",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "create"],
        description: "list=\u67E5\u770B\u5168\u90E8\u89D2\u8272 / create=\u65B0\u5EFA\u89D2\u8272"
      },
      soul_id: {
        type: "string",
        description: "create \u5FC5\u586B\uFF1A\u89D2\u8272\u552F\u4E00\u6807\u8BC6\uFF08\u5267\u672C\u91CC soul:xxx \u5F15\u7528\uFF1B\u4E0D\u80FD\u542B\u7A7A\u683C/\u9017\u53F7\uFF09"
      },
      soul_name: {
        type: "string",
        description: "create \u5FC5\u586B\uFF1A\u89D2\u8272\u663E\u793A\u540D"
      },
      description: {
        type: "string",
        description: "create \u5FC5\u586B\uFF1A\u89D2\u8272\u7684\u7075\u9B42\u8BBE\u5B9A\uFF08system prompt \u7247\u6BB5\uFF0C\u626E\u6F14\u8BE5\u89D2\u8272\u7684 AI \u4F1A\u770B\u5230\uFF09"
      }
    },
    required: ["action"],
    additionalProperties: false
  }
};
var chronicaTool = {
  name: "femo-chronica",
  description: "\u67E5\u8BE2 Femo \u6F14\u51FA\u53F0\u8D26\uFF08Chronica.wor \u7F16\u5E74\u53F2\uFF09\uFF1A\u8FD4\u56DE\u6307\u5B9A\u573A\u6B21\u7684\u3010\u5BF9\u8BDD\u6D41\u3011\uFF08showprompt \u65C1\u767D + AI \u53D1\u8A00 + \u4EBA\u7C7B\u8F93\u5165\uFF0C\u6309\u65F6\u95F4\u4EA4\u7EC7\uFF09\u4E0E\u3010\u5E55\u540E\u6307\u4EE4\u3011\u9644\u5F55\uFF08\u8282\u70B9 prompt\uFF0C\u4E0D\u5C5E\u5BF9\u8BDD\u6D41\uFF09\u3002\n- \u65E0\u53C2\u6570 = \u6700\u65B0\u4E00\u573A\u7684\u4E24\u5E55\u5168\u6587\u2014\u2014\u5267\u672C\u8DD1\u5B8C\u540E\u770B\u7ED3\u679C\u3001\u590D\u76D8\u90FD\u7528\u8FD9\u4E2A\uFF1B\n- list=\u53EA\u5217\u6700\u8FD1 N \u573A\u4E00\u89C8\uFF08\u573A\u6B21\u53F7/\u5267\u540D/\u53D1\u8A00\u6570\uFF0C\u4F18\u5148\u4E8E show\uFF09\uFF1B\n- show=\u6307\u5B9A\u573A\u6B21\u53F7\uFF1Bscope=\u6BCF\u884C\u9644\u5E26\u53EF\u89C1\u7528\u6237/\u53EF\u89C1\u89D2\u8272\uFF08\u6392\u67E5\u89C6\u91CE\u7C7B\u95EE\u9898\u7528\uFF09\uFF1B\n- full=\u53D1\u8A00\u5168\u6587\u4E0D\u622A\u65AD\uFF08\u9ED8\u8BA4\u5BF9\u8BDD\u6D41\u884C\u622A 110 \u5B57\u3001\u6307\u4EE4 90 \u5B57\uFF1B\u7EC6\u8BFB\u8BD7\u4F5C/\u957F\u53F0\u8BCD\u65F6\u5F00\uFF09\u3002",
  parameters: {
    type: "object",
    properties: {
      show: {
        type: "number",
        description: "\u573A\u6B21\u53F7\uFF08\u53EF\u9009\uFF1B\u7F3A\u7701=\u6700\u65B0\u4E00\u573A\uFF09"
      },
      list: {
        type: "number",
        description: "\u53EA\u5217\u6700\u8FD1 N \u573A\u4E00\u89C8\uFF08\u53EF\u9009\uFF1B\u7ED9\u4E86\u5C31\u5FFD\u7565 show\uFF09"
      },
      scope: {
        type: "boolean",
        description: "\u6BCF\u884C\u9644\u5E26\u53EF\u89C1\u6027\u4FE1\u606F\uFF08\u53EF\u9009\uFF1B\u6392\u67E5\u89C6\u91CE\u7C7B\u95EE\u9898\u7528\uFF09"
      },
      full: {
        type: "boolean",
        description: "\u53D1\u8A00\u5168\u6587\u4E0D\u622A\u65AD\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4\u622A\u65AD\uFF09"
      }
    },
    additionalProperties: false
  }
};
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
    const scriptPath = typeof args.scriptPath === "string" && args.scriptPath.trim().length > 0 ? args.scriptPath.trim() : "";
    if (scriptPath.length === 0) {
      return { ok: false, error: "scriptPath \u662F\u5FC5\u586B\u53C2\u6570" };
    }
    await deps.mountScript(String(agent.session.id), scriptPath);
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
        return { ok: true, action, job_id: result.jobId, note: `\u5DF2\u4ECE\u5934\u5F00\u59CB\u8FD0\u884C\u5267\u672C\uFF08Job ${result.jobId}\uFF09${result.note ? `\uFF1B${result.note}` : ""}` };
      }
      case "pause": {
        const result = await deps.pauseScript(sid);
        if (result.paused !== true) {
          return { ok: true, action, note: "\u8BE5\u4F1A\u8BDD\u6CA1\u6709\u6B63\u5728\u8FD0\u884C\u7684\u5267\u672C" };
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
        return { ok: true, action, job_id: result.jobId, note: `\u5DF2\u4ECE\u6302\u8D77\u5904\u7EED\u8DD1\uFF08Job ${result.jobId}\uFF09` };
      }
      case "list_jobs": {
        const jobs = await deps.listJobs();
        return { ok: true, action, jobs };
      }
    }
  });
  register(debugTool, async (args, agent, exec) => {
    const runsArg = typeof args.runs === "number" && Number.isFinite(args.runs) ? Math.trunc(args.runs) : 1;
    const seedArg = typeof args.seed === "number" && Number.isFinite(args.seed) ? Math.trunc(args.seed) : void 0;
    const moduleArg = typeof args.module === "string" && args.module.trim().length > 0 ? args.module.trim() : void 0;
    const result = await deps.debugRun(String(agent.session.id), {
      runs: runsArg,
      ...seedArg !== void 0 ? { seed: seedArg } : {},
      ...moduleArg !== void 0 ? { module: moduleArg } : {},
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
      return { ok: false, error: "\u4F1A\u8BDD\u672A\u6302\u8F7D\u5267\u672C\uFF1A\u8BF7\u5148 femo-mount \u6302\u8F7D\uFF0C\u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165\u5267\u672C" };
    }
    return {
      ok: true,
      source: record.path !== void 0 ? "file" : "session-text",
      ...record.path !== void 0 ? { path: record.path } : {},
      lines: record.finalText.split("\n").length,
      script: record.finalText
    };
  }, (value) => {
    const head = `\u{1F4DC} \u6302\u8F7D\u5267\u672C\uFF08${value.source ?? ""}${value.path !== void 0 ? `: ${value.path}` : ""}\uFF0C${value.lines ?? "?"} \u884C\uFF09`;
    return `${head}

${value.script ?? ""}`;
  });
  register(soulTool, async (args) => {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (action === "list") {
      const { souls } = await deps.soulList();
      return { ok: true, souls };
    }
    if (action === "create") {
      const soulId = typeof args.soul_id === "string" ? args.soul_id.trim() : "";
      const soulName = typeof args.soul_name === "string" ? args.soul_name.trim() : "";
      const description = typeof args.description === "string" ? args.description : "";
      if (soulId.length === 0 || soulName.length === 0 || description.length === 0) {
        return { ok: false, error: "create \u9700\u8981 soul_id / soul_name / description \u4E09\u4E2A\u53C2\u6570\uFF08\u5168\u90E8\u5FC5\u586B\uFF09" };
      }
      if (/[\s,，]/.test(soulId)) {
        return { ok: false, error: `soul_id "${soulId}" \u4E0D\u80FD\u542B\u7A7A\u683C\u6216\u9017\u53F7\uFF08\u5267\u672C\u91CC soul:xxx \u5F15\u7528\u7528\uFF09` };
      }
      await deps.soulCreate(soulId, soulName, description);
      return { ok: true, note: `\u5DF2\u521B\u5EFA\u89D2\u8272 ${soulName}\uFF08soul_id=${soulId}\uFF0C\u5267\u672C\u91CC\u7528 soul:${soulId} \u5F15\u7528\uFF09` };
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
    const opts = {};
    if (typeof args.show === "number" && Number.isFinite(args.show)) opts.show = Math.trunc(args.show);
    if (typeof args.list === "number" && Number.isFinite(args.list) && args.list > 0) opts.list = Math.trunc(args.list);
    if (args.scope === true) opts.scope = true;
    if (args.full === true) opts.full = true;
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

// host/index.ts
var name = "femo-plugin";
var inject = ["agents", "sessions", "agentDefaultModel", "tools", "webServer"];
async function apply(ctx, config) {
  const resolved = resolveConfig(config);
  if (!resolved.enabled) {
    console.log("[femo-plugin] disabled by config");
    return;
  }
  const defaultModel = ctx.get("agentDefaultModel");
  const registerSessionEventType2 = sessionNS.registerSessionEventType;
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
    errors: /* @__PURE__ */ new Map(),
    lastEvents: []
  };
  initDiagFeed(resolved.femoRoot);
  installHostLogCapture();
  installNativeWindowing(ctx, {
    native: isNativeDshBuild(sessionNS),
    mirrorDir: `${resolved.femoRoot}\\user_data\\host-history\\projections\\proj-mirror`
  });
  const sessionsStore = ctx.get("sessions");
  const rebuildJobIndexFromRecords = async () => {
    const { readdir: readdir2 } = await import("node:fs/promises");
    const sessionsDir = `${resolved.femoRoot}\\user_data\\host-history\\drafts`;
    let names = [];
    try {
      names = await readdir2(sessionsDir);
    } catch {
      return;
    }
    let rebuilt = 0;
    for (const name2 of names) {
      if (!name2.endsWith(".json")) continue;
      const sid = name2.slice(0, -".json".length);
      const jobId = await readSessionCurrentJob(resolved.femoRoot, sid);
      if (jobId !== void 0) {
        runState.sidIndex.set(sid, jobId);
        rebuilt += 1;
      }
    }
    if (rebuilt > 0) console.log(`[femo-plugin] job index rebuilt from session records: ${rebuilt} entr(y|ies)`);
  };
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
        await rebuildJobIndexFromRecords();
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
    void rebuildJobIndexFromRecords();
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
  const projections = createProjectionRegistry(ctx);
  const godMirror = createGodMirror({ femoRoot: resolved.femoRoot, sessionsStore, projections, mainActorSceneActor });
  const recordError = (sessionId, text) => {
    const key = String(sessionId);
    const list = runState.errors.get(key) ?? [];
    list.push({ ts: Date.now(), text });
    if (list.length > 50) list.shift();
    runState.errors.set(key, list);
    console.log(`[femo-plugin] error on ${key}: ${text}`);
  };
  registerPersonaHooks(ctx, resolved.femoRoot);
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
  ctx.effect(() => apiRetry.install(ctx, {
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
      const session = sessionsStore?.get(SessionId9(target.mainSessionId));
      if (session === void 0) return;
      const mirror = activeJobOfSession(runState, target.mainSessionId);
      const actor = mirror?.nodeActors.get(target.node) ?? target.node;
      appendChatProjected(
        ctx,
        session,
        projections,
        `\u23F3 \u6F14\u5458 ${actor} \u8C03\u7528\u5931\u8D25\uFF08${failure.code}\uFF09\uFF0C${delayText}\u91CD\u8BD5\uFF08\u7B2C ${attempt}/5 \u6B21\uFF09`,
        "notice",
        actor,
        mirror?.nodeScopes.get(target.node)
      );
    },
    onExhausted: (target, failure) => {
      if (target.kind === "main") {
        console.log(`[femo-api-retry] main \u8FDE\u7EED 5 \u6B21 API \u5931\u8D25\uFF0C\u8282\u70B9\u300C${target.node}\u300D\u6267\u884C\u5931\u8D25\u4E0A\u62A5\u5F15\u64CE\uFF08\u672C\u573A\u6302\u8D77\u53EF\u7EED\u8DD1\uFF09\uFF1A${failure.code} ${failure.message.slice(0, 200)}`);
        return;
      }
      const session = sessionsStore?.get(SessionId9(target.mainSessionId));
      if (session === void 0) return;
      const mirror = activeJobOfSession(runState, target.mainSessionId);
      const actor = mirror?.nodeActors.get(target.node) ?? target.node;
      const text = `\u6F14\u5458 ${actor} \u8FDE\u7EED 5 \u6B21 API \u5931\u8D25\uFF0C\u8282\u70B9\u300C${target.node}\u300D\u6267\u884C\u5931\u8D25\uFF1A${failure.code} ${failure.message}\uFF08\u672C\u573A\u5C06\u6302\u8D77\uFF0C\u53EF\u70B9\u300C\u7EE7\u7EED\u300D\u91CD\u6F14\uFF09`;
      recordError(SessionId9(target.mainSessionId), text);
      appendChatProjected(ctx, session, projections, `\u274C ${text}`, "notice", actor, mirror?.nodeScopes.get(target.node));
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
    godMirror,
    recordError
  });
  setTimeout(() => {
    bridge.start(ctx, resolved);
  }, 1e3);
  ctx.effect(() => () => {
    bridgeDisposed = true;
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
  const resolveMounted = async (sessionId) => {
    const sid = SessionId9(sessionId);
    const session = sessionsStore?.get(sid);
    if (session === void 0) {
      throw new Error(`\u4F1A\u8BDD ${sessionId} \u4E0D\u5B58\u5728`);
    }
    if (presetOf(session) !== FEMO_PRESET) {
      throw new Error("\u5F53\u524D\u4F1A\u8BDD\u4E0D\u662F FEMO\u6A21\u5F0F");
    }
    assertRunAllowed(runState, sessionId);
    const scriptText = await readSessionScriptText(resolved.femoRoot, sessionId);
    if (scriptText === void 0) {
      throw new Error("\u4F1A\u8BDD\u672A\u6302\u8F7D\u5267\u672C\uFF1A\u8BF7\u5148 femo-mount \u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165\u5267\u672C");
    }
    const prev = await readSessionScript(resolved.femoRoot, sessionId);
    const effectivePath = prev?.path;
    const baseDir = effectivePath !== void 0 ? effectivePath.replace(/[\\/][^\\/]*$/, "") : "";
    try {
      await bridge.send("check", { femo: scriptText, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 3e4);
    } catch (error) {
      throw new Error(`\u5267\u672C\u7F16\u8BD1\u5931\u8D25\uFF1A${String(error instanceof Error ? error.message : error)}`);
    }
    return { sid, scriptText, effectivePath };
  };
  const toolDeps = {
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
    mountScript: async (sessionId, scriptPath) => {
      runState.errors.delete(sessionId);
      const { readFile: readFile3 } = await import("node:fs/promises");
      let text;
      try {
        text = await readFile3(scriptPath, "utf8");
      } catch (error) {
        throw new Error(`\u65E0\u6CD5\u8BFB\u53D6\u5267\u672C\u6587\u4EF6 ${scriptPath}\uFF1A${String(error instanceof Error ? error.message : error)}`);
      }
      const baseDir = scriptPath.replace(/[\\/][^\\/]*$/, "");
      try {
        await bridge.send("check", { femo: text, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 3e4);
      } catch (error) {
        recordError(SessionId9(sessionId), `[\u7F16\u8F91\u5668\xB7mount] ${String(error instanceof Error ? error.message : error)}`);
      }
      await writeSessionScript(resolved.femoRoot, sessionId, { path: scriptPath, text });
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
              note = `\u4E0A\u4E00\u573A Job ${oldJobId} \u5DF2\u6302\u8D77\u5B58\u6863\uFF0C\u53EF femo-run resume + job_id \u6216 list_jobs \u627E\u56DE`;
            }
          }
        } catch {
        }
        await startJobOnSession(ctx, resolved, bridge, runState, sid, scriptText, effectivePath, true, void 0, projections);
        const activeId2 = runState.activeJobId;
        return { ok: true, jobId: activeId2 ?? -1, ...note !== void 0 ? { note } : {} };
      }
      await startJobOnSession(ctx, resolved, bridge, runState, sid, scriptText, effectivePath, false, jobId, projections);
      const activeId = runState.activeJobId;
      return { ok: true, jobId: activeId ?? jobId ?? -1 };
    },
    pauseScript: async (sessionId) => {
      const job = activeJobOfSession(runState, sessionId);
      const targetId = job?.state === "running" && runState.activeJobId === job.jobId ? job.jobId : void 0;
      if (targetId === void 0) {
        console.log(`[femo-plugin] femo-run pause ${sessionId} -> no running job (mirror=${String(job?.jobId ?? "-")}, active=${String(runState.activeJobId ?? "-")})`);
        return { paused: false };
      }
      const result = await bridge.send("job_pause", { job_id: targetId }, 15e3);
      console.log(`[femo-plugin] femo-run pause ${sessionId} job=${String(targetId)} -> paused=${result?.paused === true} state=${String(result?.state ?? "-")}`);
      return { paused: result?.paused === true, state: result?.state, jobId: targetId };
    },
    listJobs: async () => {
      const result = await bridge.send("list_jobs", {}, 15e3);
      return result?.jobs ?? [];
    },
    isFemoMainSession: (agent) => isFemoAgent(agent),
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
        throw new Error("\u4F1A\u8BDD\u672A\u6302\u8F7D\u5267\u672C\uFF1A\u8BF7\u5148 femo-mount \u6302\u8F7D\uFF0C\u6216\u7528 femoGen \u7F16\u8F91\u5668\u5199\u5165\u5267\u672C");
      }
      const prev = await readSessionScript(resolved.femoRoot, sessionId);
      const started = Date.now();
      const result = await collectDebugRun(ctx, resolved, {
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
      const args = [];
      if (opts.list !== void 0) args.push("--list", String(opts.list));
      else if (opts.show !== void 0) args.push(String(opts.show));
      if (opts.scope === true) args.push("--scope");
      if (opts.full === true) args.push("--full");
      const subprocess = ctx.get("subprocess");
      if (subprocess === void 0) {
        throw new Error("subprocess \u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u65E0\u6CD5\u89E3\u6790 python \u53EF\u6267\u884C\u6587\u4EF6\uFF09");
      }
      const pythonPath = await subprocess.resolveExecutable(resolved.python);
      const [{ execFile }, { promisify }, { join: join12 }] = await Promise.all([
        import("node:child_process"),
        import("node:util"),
        import("node:path")
      ]);
      try {
        const { stdout } = await promisify(execFile)(
          pythonPath,
          [join12(resolved.femoRoot, "femo2host", "femoToolcall", "chronica.py"), ...args],
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
  void rebuildJobIndexFromRecords();
  ctx.effect(() => registerFemoTools(ctx, toolDeps, projections), "femo-plugin: main-model tools");
}
export {
  Config,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
