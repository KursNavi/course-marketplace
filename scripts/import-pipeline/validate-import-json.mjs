#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const schemaDir = path.join(repoRoot, 'schemas/import');
const schemas = new Map();

function loadSchema(name) {
  if (!schemas.has(name)) {
    schemas.set(name, JSON.parse(fs.readFileSync(path.join(schemaDir, name), 'utf8')));
  }
  return schemas.get(name);
}

function pointerGet(root, pointer) {
  return pointer.split('/').slice(1).reduce((node, part) => node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], root);
}

function inferSchemaName(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(text);
  if (data.provider_import && data.course_import && data.run) return ['import-run.schema.json', data];
  if (data.provider) return ['provider-import.schema.json', data];
  if (data.courses) return ['course-import.schema.json', data];
  throw new Error('Konnte kein passendes Import-Schema erkennen. Erwartet provider, courses oder import-run Struktur.');
}

function validate(data, schema, location = '$', rootSchema = schema, errors = []) {
  if (schema.$ref) {
    if (schema.$ref.startsWith('#/')) return validate(data, pointerGet(rootSchema, schema.$ref), location, rootSchema, errors);
    return validate(data, loadSchema(schema.$ref), location, loadSchema(schema.$ref), errors);
  }

  if (schema.anyOf) {
    const alternatives = schema.anyOf.map((candidate) => validate(data, candidate, location, rootSchema, []));
    if (alternatives.some((candidateErrors) => candidateErrors.length === 0)) return errors;
    errors.push(`${location}: entspricht keiner erlaubten Schema-Alternative (${alternatives.flat().join('; ')})`);
    return errors;
  }

  if (Object.hasOwn(schema, 'const') && data !== schema.const) {
    errors.push(`${location}: muss exakt ${JSON.stringify(schema.const)} sein, erhalten ${JSON.stringify(data)}`);
    return errors;
  }

  if (schema.type) {
    const ok = schema.type === 'array' ? Array.isArray(data)
      : schema.type === 'null' ? data === null
      : schema.type === 'number' ? typeof data === 'number' && Number.isFinite(data)
      : schema.type === 'object' ? data && typeof data === 'object' && !Array.isArray(data)
      : typeof data === schema.type;
    if (!ok) {
      errors.push(`${location}: erwarteter Typ ${schema.type}, erhalten ${Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data}`);
      return errors;
    }
  }

  if (schema.type === 'string') {
    if (schema.minLength && data.length < schema.minLength) errors.push(`${location}: muss mindestens ${schema.minLength} Zeichen enthalten`);
    if (schema.format === 'uri' && !URL.canParse(data)) errors.push(`${location}: muss eine gültige URL sein`);
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(data))) errors.push(`${location}: muss ein gültiger date-time Wert sein`);
  }

  if (schema.type === 'number' && Object.hasOwn(schema, 'minimum') && data < schema.minimum) {
    errors.push(`${location}: muss >= ${schema.minimum} sein`);
  }

  if (schema.type === 'array') {
    if (schema.minItems && data.length < schema.minItems) errors.push(`${location}: muss mindestens ${schema.minItems} Eintrag enthalten`);
    data.forEach((item, index) => validate(item, schema.items ?? {}, `${location}[${index}]`, rootSchema, errors));
  }

  if (schema.type === 'object') {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(data, key)) errors.push(`${location}.${key}: Pflichtfeld fehlt`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) errors.push(`${location}.${key}: unbekanntes Feld`);
      }
    }
    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(data, key)) validate(data[key], propertySchema, `${location}.${key}`, rootSchema, errors);
    }
  }

  return errors;
}

export function validateImportJson(filePath) {
  const absolutePath = path.resolve(filePath);
  const [schemaName, data] = inferSchemaName(absolutePath);
  const errors = validate(data, loadSchema(schemaName));
  return { schemaName, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/import-pipeline/validate-import-json.mjs <json-file>');
    process.exit(1);
  }

  try {
    const { schemaName, errors } = validateImportJson(filePath);
    if (errors.length > 0) {
      console.error(`Import-JSON ist ungültig gegen ${schemaName}:`);
      errors.forEach((error) => console.error(`- ${error}`));
      process.exit(1);
    }
    console.log(`Import-JSON ist gültig gegen ${schemaName}: ${filePath}`);
  } catch (error) {
    console.error(`Import-JSON konnte nicht validiert werden: ${error.message}`);
    process.exit(1);
  }
}
