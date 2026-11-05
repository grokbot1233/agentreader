# Glama "Runs from source" / awesome-mcp-servers introspection image.
# Builds a stdio MCP server that answers initialize + tools/list with no secrets.
# Paid tool calls hit https://api.axiomworks.co.uk and return x402 payment-required JSON when unpaid.
#
#   docker build -t agentreader-mcp .
#   docker run -i --rm agentreader-mcp
#
# Or without Docker:
#   node glama-mcp/index.js
FROM node:22-slim
WORKDIR /app

# Minimal package for the stdio shim (does not need the full Worker deps)
COPY glama-mcp/package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY glama-mcp/index.js ./

USER node
ENTRYPOINT ["node", "index.js"]
