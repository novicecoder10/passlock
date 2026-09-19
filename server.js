const express = require('express');
const cors = require('cors');
const dbManager = require('./db-manager');

class ApiServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 19842; // Unique port for password manager
    this.setupRoutes();
  }

  setupRoutes() {
    // Enable CORS for localhost/browser extensions
    this.app.use(cors({
      origin: '*' // Since we authenticate with a secure custom token, * is safe and required to support varying extension IDs
    }));

    this.app.use(express.json());

    // Middleware to verify authorization token and lock status
    const authMiddleware = (req, res, next) => {
      // 1. Check lock status first
      if (!dbManager.isUnlocked) {
        return res.status(401).json({ error: 'vault_locked', message: 'Vault is locked. Please unlock the desktop application.' });
      }

      // 2. Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ error: 'unauthorized', message: 'Missing or malformed Authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const validToken = dbManager.getApiToken();

      if (token !== validToken) {
        return res.status(403).json({ error: 'unauthorized', message: 'Invalid API token' });
      }

      next();
    };

    // Public endpoint: Check lock status
    this.app.get('/status', (req, res) => {
      res.json({
        locked: !dbManager.isUnlocked
      });
    });

    // Protected endpoint: Get matching logins for a domain
    this.app.get('/logins', authMiddleware, (req, res) => {
      const { domain } = req.query;
      
      if (!domain) {
        return res.status(400).json({ error: 'bad_request', message: 'Missing domain parameter' });
      }

      try {
        const logins = dbManager.getLogins();
        const searchDomain = domain.toLowerCase();

        // Filter logins by domain matching in the URL or Title
        const matches = logins
          .filter(login => {
            if (login.type !== 'website') return false;
            
            const rawUrl = (login.url || '').toLowerCase().trim();
            const rawTitle = (login.title || '').toLowerCase().trim();
            const cleanSearch = searchDomain.replace(/^www\./, '');

            if (!rawUrl && !rawTitle) return false;

            // Normalize URL protocol
            let hostStr = rawUrl;
            if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
              hostStr = 'https://' + rawUrl;
            }

            try {
              const urlHost = new URL(hostStr).hostname.toLowerCase().replace(/^www\./, '');
              return urlHost.includes(cleanSearch) || cleanSearch.includes(urlHost) || rawTitle.includes(cleanSearch);
            } catch (e) {
              return rawUrl.includes(cleanSearch) || cleanSearch.includes(rawUrl) || rawTitle.includes(cleanSearch);
            }
          })
          .map(login => ({
            id: login.id,
            title: login.title,
            username: login.username,
            password: login.password
          }));

        res.json({ logins: matches });
      } catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message });
      }
    });
  }

  // Start the HTTP server
  start() {
    if (this.server) return;

    this.server = this.app.listen(this.port, '127.0.0.1', () => {
      console.log(`API Server: Listening on http://127.0.0.1:${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error('API Server error:', err);
    });
  }

  // Stop the HTTP server
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('API Server: Stopped');
      });
      this.server = null;
    }
  }
}

module.exports = new ApiServer();
