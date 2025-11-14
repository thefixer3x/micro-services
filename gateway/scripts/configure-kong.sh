#!/bin/bash

# Kong Configuration Script
# This script helps configure Kong API Gateway using the Admin API

set -e

KONG_ADMIN_URL="${KONG_ADMIN_URL:-http://localhost:8001}"
KONG_CONFIG_FILE="${KONG_CONFIG_FILE:-./gateway/kong.yml}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║         Kong API Gateway Configuration Tool          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check if Kong is running
check_kong_health() {
    echo "→ Checking Kong health..."
    if curl -f -s "${KONG_ADMIN_URL}/status" > /dev/null 2>&1; then
        echo "✓ Kong is healthy and running"
        return 0
    else
        echo "✗ Kong is not responding at ${KONG_ADMIN_URL}"
        echo "  Please ensure Kong is running: docker-compose up -d kong-gateway"
        exit 1
    fi
}

# Apply Kong declarative configuration
apply_config() {
    echo ""
    echo "→ Applying Kong configuration from ${KONG_CONFIG_FILE}..."

    if [ ! -f "${KONG_CONFIG_FILE}" ]; then
        echo "✗ Configuration file not found: ${KONG_CONFIG_FILE}"
        exit 1
    fi

    # Using deck (Kong's declarative configuration tool)
    # If deck is not installed, use Kong's Admin API directly
    if command -v deck &> /dev/null; then
        echo "  Using deck to sync configuration..."
        deck sync --kong-addr "${KONG_ADMIN_URL}" -s "${KONG_CONFIG_FILE}"
        echo "✓ Configuration applied successfully using deck"
    else
        echo "  Note: 'deck' CLI tool not found. Install it for easier configuration management:"
        echo "  https://docs.konghq.com/deck/latest/installation/"
        echo ""
        echo "  Alternatively, apply configuration manually using Kong Admin API"
    fi
}

# List all configured services
list_services() {
    echo ""
    echo "→ Configured Services:"
    curl -s "${KONG_ADMIN_URL}/services" | jq -r '.data[] | "  • \(.name) -> \(.protocol)://\(.host):\(.port)\(.path)"'
}

# List all configured routes
list_routes() {
    echo ""
    echo "→ Configured Routes:"
    curl -s "${KONG_ADMIN_URL}/routes" | jq -r '.data[] | "  • \(.name): \(.paths[0]) [\(.methods | join(", "))]"'
}

# List all enabled plugins
list_plugins() {
    echo ""
    echo "→ Enabled Plugins:"
    curl -s "${KONG_ADMIN_URL}/plugins" | jq -r '.data[] | "  • \(.name) on \(.service.name // "global")"'
}

# Display Kong status
show_status() {
    echo ""
    echo "→ Kong Status:"
    curl -s "${KONG_ADMIN_URL}/status" | jq '.'
}

# Test health check endpoints
test_health_checks() {
    echo ""
    echo "→ Testing service health checks through Kong..."

    KONG_PROXY_URL="${KONG_PROXY_URL:-http://localhost:8000}"

    services=("identity-service" "wallet-service" "transaction-service" "admin-service")

    for service in "${services[@]}"; do
        echo -n "  • ${service}: "
        if curl -f -s "${KONG_PROXY_URL}/health" -H "Host: ${service}" > /dev/null 2>&1; then
            echo "✓ OK"
        else
            echo "✗ FAILED"
        fi
    done
}

# Main execution
main() {
    check_kong_health

    case "${1:-status}" in
        apply)
            apply_config
            list_services
            ;;
        services)
            list_services
            ;;
        routes)
            list_routes
            ;;
        plugins)
            list_plugins
            ;;
        status)
            show_status
            ;;
        health)
            test_health_checks
            ;;
        all)
            show_status
            list_services
            list_routes
            list_plugins
            test_health_checks
            ;;
        *)
            echo "Usage: $0 {apply|services|routes|plugins|status|health|all}"
            echo ""
            echo "Commands:"
            echo "  apply    - Apply Kong configuration from kong.yml"
            echo "  services - List all configured services"
            echo "  routes   - List all configured routes"
            echo "  plugins  - List all enabled plugins"
            echo "  status   - Show Kong status"
            echo "  health   - Test health checks for all services"
            echo "  all      - Show all information"
            exit 1
            ;;
    esac

    echo ""
    echo "✓ Done!"
}

main "$@"
