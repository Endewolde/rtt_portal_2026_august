#!/bin/bash

echo "🔐 Removing source files..."

# Remove raw JS source
rm -rf resources/js/

# Remove tests
rm -rf tests/

echo "✅ Source files removed. App is ready to run."
