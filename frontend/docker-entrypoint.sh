#!/bin/sh
set -eu

API_BASE_VALUE="${FRONTEND_API_BASE:-http://localhost:8000}"

cat > /app/public/env.js <<EOF
window.__env = window.__env || {
  API_BASE: '${API_BASE_VALUE}'
};
EOF

npm install
npm start
