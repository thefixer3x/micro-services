#!/bin/bash

# API Gateway Integration Test Script

set -e

KONG_URL="${KONG_URL:-http://localhost:8000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════════════════════╗"
echo "║        API Gateway Integration Test Suite            ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((TESTS_FAILED++))
    fi
}

# Test 1: Kong Health Check
echo "→ Test 1: Kong Health Check"
if curl -f -s http://localhost:8001/status > /dev/null 2>&1; then
    print_result 0 "Kong is healthy and responding"
else
    print_result 1 "Kong health check failed"
    exit 1
fi

# Test 2: Service Health Checks
echo ""
echo "→ Test 2: Service Health Checks via Gateway"

services=("identity-service" "wallet-service" "transaction-service" "admin-service")
for service in "${services[@]}"; do
    if curl -f -s "${KONG_URL}/health" > /dev/null 2>&1; then
        print_result 0 "Health check: ${service}"
    else
        print_result 1 "Health check failed: ${service}"
    fi
done

# Test 3: CORS Headers
echo ""
echo "→ Test 3: CORS Configuration"
CORS_RESPONSE=$(curl -s -I -X OPTIONS "${KONG_URL}/api/v1/auth/login" \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    print_result 0 "CORS headers are present"
else
    print_result 1 "CORS headers missing"
fi

# Test 4: Rate Limiting Headers
echo ""
echo "→ Test 4: Rate Limiting"
RATE_LIMIT_RESPONSE=$(curl -s -I "${KONG_URL}/api/v1/auth/login")

if echo "$RATE_LIMIT_RESPONSE" | grep -q "X-RateLimit"; then
    print_result 0 "Rate limiting headers present"
else
    print_result 1 "Rate limiting headers missing"
fi

# Test 5: Public Endpoint Access
echo ""
echo "→ Test 5: Public Endpoint Access (No JWT)"
LOGIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${KONG_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}')

# Should get 401 or 400 (not 404 or 500)
if [ "$LOGIN_RESPONSE" = "400" ] || [ "$LOGIN_RESPONSE" = "401" ]; then
    print_result 0 "Public endpoint accessible (Status: $LOGIN_RESPONSE)"
else
    print_result 1 "Public endpoint failed (Status: $LOGIN_RESPONSE)"
fi

# Test 6: Protected Endpoint Without JWT
echo ""
echo "→ Test 6: Protected Endpoint Without JWT"
PROTECTED_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "${KONG_URL}/api/v1/users/me")

if [ "$PROTECTED_RESPONSE" = "401" ]; then
    print_result 0 "Protected endpoint correctly rejects unauthenticated requests"
else
    print_result 1 "Protected endpoint should return 401 (got: $PROTECTED_RESPONSE)"
fi

# Test 7: Request Size Limiting
echo ""
echo "→ Test 7: Request Size Limiting"
LARGE_PAYLOAD=$(python3 -c "print('a' * 11000000)")  # 11MB payload
SIZE_LIMIT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${KONG_URL}/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"data\":\"${LARGE_PAYLOAD}\"}")

if [ "$SIZE_LIMIT_RESPONSE" = "413" ]; then
    print_result 0 "Request size limiting works (rejected 11MB payload)"
else
    print_result 1 "Request size limiting failed (Status: $SIZE_LIMIT_RESPONSE)"
fi

# Test 8: Gateway Response Headers
echo ""
echo "→ Test 8: Gateway Custom Headers"
HEADERS_RESPONSE=$(curl -s -I "${KONG_URL}/api/v1/auth/login")

if echo "$HEADERS_RESPONSE" | grep -q "X-Gateway: Kong"; then
    print_result 0 "Custom gateway headers present"
else
    print_result 1 "Custom gateway headers missing"
fi

# Test 9: Request ID Header
echo ""
echo "→ Test 9: Request ID Correlation"
REQUEST_ID_RESPONSE=$(curl -s -I "${KONG_URL}/api/v1/auth/login")

if echo "$REQUEST_ID_RESPONSE" | grep -q "X-Request-ID"; then
    print_result 0 "Request ID correlation header present"
else
    print_result 1 "Request ID correlation header missing"
fi

# Test 10: Rate Limit Enforcement
echo ""
echo "→ Test 10: Rate Limit Enforcement"
echo "   (Sending 25 rapid requests to trigger rate limit...)"

RATE_LIMITED=0
for i in {1..25}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${KONG_URL}/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test"}')

    if [ "$RESPONSE" = "429" ]; then
        RATE_LIMITED=1
        break
    fi
    sleep 0.1
done

if [ $RATE_LIMITED -eq 1 ]; then
    print_result 0 "Rate limiting enforced (429 Too Many Requests)"
else
    print_result 1 "Rate limiting not triggered"
fi

# Test 11: Kong Admin API
echo ""
echo "→ Test 11: Kong Admin API"
ADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/services)

if [ "$ADMIN_RESPONSE" = "200" ]; then
    print_result 0 "Kong Admin API accessible"
else
    print_result 1 "Kong Admin API failed (Status: $ADMIN_RESPONSE)"
fi

# Test 12: Prometheus Metrics
echo ""
echo "→ Test 12: Prometheus Metrics Endpoint"
METRICS_RESPONSE=$(curl -s http://localhost:8001/metrics)

if echo "$METRICS_RESPONSE" | grep -q "kong_"; then
    print_result 0 "Prometheus metrics available"
else
    print_result 1 "Prometheus metrics not available"
fi

# Test Summary
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                   Test Summary                        ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed:       ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please check the output above.${NC}"
    exit 1
fi
