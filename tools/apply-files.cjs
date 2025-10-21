#!/usr/bin/env node
/**
 * File applier with:
 *  - write/overwrite files
 *  - merge (JSON shallow)
 *  - regex updates: { path, content_update:"regex", updates:[{pattern,replacement,multiple?}] }
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const changesPath = path.join(root, 'tools', 'assistant-changes.json');

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function mergeJSON(baseObj, patchObj) {
  const out = { ...baseObj };
  for (const [k, v] of Object.entries(patchObj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...(out[k] || {}), ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function applyRegexUpdates(dst, updates) {
  if (!fs.existsSync(dst)) {
    console.error(`regex update: file not found ${dst}`);
    return false;
  }
  let text = fs.readFileSync(dst, 'utf8');
  let changed = 0;
  for (const u of updates) {
    const re = new RegExp(u.pattern, 's'); // dotall
    if (!re.test(text)) {
      // try global if asked multiple
      const reG = new RegExp(u.pattern, 'gs');
      if (reG.test(text)) {
        text = text.replace(reG, u.replacement);
        changed++;
        continue;
      }
      console.warn(`pattern not found in ${dst}: ${u.pattern.substring(0, 60)}...`);
      continue;
    }
    if (u.multiple) {
      const reG = new RegExp(u.pattern, 'gs');
      text = text.replace(reG, u.replacement);
    } else {
      text = text.replace(re, u.replacement);
    }
    changed++;
  }
  if (changed > 0) {
    fs.writeFileSync(dst, text, 'utf8');
    console.log(`regex updated ${dst} (${changed} changes)`);
    return true;
  }
  console.log(`regex no-op ${dst}`);
  return false;
}

(function main() {
  if (!fs.existsSync(changesPath)) {
    console.error(`Missing ${changesPath}`);
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(changesPath, 'utf8'));
  const files = spec.files || [];
  let written = 0;

  for (const f of files) {
    const dst = path.join(root, f.path);
    ensureDirFor(dst);

    if (f.content_update === 'merge') {
      let base = {};
      if (fs.existsSync(dst)) {
        try { base = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch {}
      }
      const merged = mergeJSON(base, f.content);
      fs.writeFileSync(dst, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      console.log('merged', f.path);
      written++;
      continue;
    }

    if (f.content_update === 'regex') {
      applyRegexUpdates(dst, f.updates || []);
      written++;
      continue;
    }

    // default full write
    fs.writeFileSync(dst, f.content, 'utf8');
    console.log('wrote', f.path);
    written++;
  }

  console.log(`Done. ${written} file(s) updated. Description: ${spec.description || '—'}`);
})();
