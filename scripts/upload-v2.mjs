#!/usr/bin/env node
import { put } from '@vercel/blob';
import fs from 'fs';

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('Missing BLOB_READ_WRITE_TOKEN');
  process.exit(1);
}

const v2Data = fs.readFileSync('/tmp/gw-6.v2.json', 'utf8');

console.log('[Upload] Uploading gw-6.v2.json to Vercel Blob...');

const blob = await put('gw-6.v2.json', v2Data, {
  access: 'public',
  token,
  addRandomSuffix: false,
  contentType: 'application/json'
});

console.log('[Upload] ✅ Uploaded:', blob.url);
console.log('[Upload] Done!');

