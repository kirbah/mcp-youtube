#!/bin/bash
# This script installs the necessary environment for the project.

# Run install_nvm.sh
# First, make the script executable
chmod +x install_nvm.sh
# Then, execute it
./install_nvm.sh

# The install_nvm.sh script already sources nvm and installs node, npm ci and npm run build.
# Just to be sure, I'll explicitly run them here as well.
# Source nvm again to ensure it's available in this subshell environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Verify Node.js installation (optional, for logging)
echo "Node version after running install_nvm.sh:"
node -v
echo "npm version after running install_nvm.sh:"
npm -v
echo "nvm current:"
nvm current

# Ensure dependencies are installed and the project is built
echo "Running npm ci..."
npm ci
echo "Running npm run build..."
npm run build
echo "Environment setup complete."
