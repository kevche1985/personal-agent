#!/bin/zsh
# Starts the Personal Agent backend and frontend dev server
cd "$(dirname "$0")"

# Ensure Redis is running
brew services start redis 2>/dev/null

# Backend
echo "Starting backend on port 3000..."
cd backend && node src/server.js &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Frontend
echo "Starting frontend on port 5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ Personal Agent is running"
echo "  Dashboard:  http://localhost:5173"
echo "  API:        http://localhost:3000/api/health"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait $BACKEND_PID $FRONTEND_PID
