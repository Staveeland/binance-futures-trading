#!/usr/bin/env npx ts-node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../docs');
const PORT = 9091;

let isRunning = false;
let lastRunTime = 0;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: Trigger bot
  if (req.url === '/api/run' && req.method === 'POST') {
    if (isRunning) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bot is already running', status: 'busy' }));
      return;
    }

    // Rate limit: minimum 30 seconds between runs
    const now = Date.now();
    if (now - lastRunTime < 30000) {
      const waitTime = Math.ceil((30000 - (now - lastRunTime)) / 1000);
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Please wait ${waitTime}s`, status: 'rate_limited' }));
      return;
    }

    isRunning = true;
    lastRunTime = now;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started', message: 'Bot triggered!' }));

    // Run the bot in background
    const child = spawn('npx', ['tsx', 'src/run-and-update.ts'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });

    child.on('close', () => {
      isRunning = false;
      console.log('✅ Bot run complete');
    });

    child.on('error', (err) => {
      isRunning = false;
      console.error('❌ Bot error:', err);
    });

    return;
  }

  // API: Status
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      isRunning, 
      lastRunTime: lastRunTime ? new Date(lastRunTime).toISOString() : null 
    }));
    return;
  }

  // Static files
  const urlPath = (req.url || '/').split('?')[0]; // Strip query params
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(DOCS_DIR, filePath);

  const extname = path.extname(filePath);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[extname] || 'text/plain' });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Futures Dashboard Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://192.168.1.93:${PORT}`);
  console.log(`\n📡 API endpoints:`);
  console.log(`   POST /api/run    - Trigger bot manually`);
  console.log(`   GET  /api/status - Check if bot is running\n`);
});
