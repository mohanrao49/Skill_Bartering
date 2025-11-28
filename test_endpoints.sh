#!/bin/bash
# Test script for login and registration endpoints

echo "Testing Backend Endpoints..."
echo "================================"
echo ""

echo "1. Testing Health Check:"
curl -s http://localhost:5001/api/health | python3 -m json.tool
echo ""
echo ""

echo "2. Testing Login Endpoint:"
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skillswap.com","password":"password123"}' | python3 -m json.tool
echo ""
echo ""

echo "3. Testing Register Endpoint:"
curl -s -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser3","email":"test3@test.com","password":"test123"}' | python3 -m json.tool
echo ""
echo ""

echo "Test complete!"

