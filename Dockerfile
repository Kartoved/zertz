FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy pre-built dist and server
COPY dist ./dist
COPY server ./server

# Expose port
EXPOSE 5050

# Start server
CMD ["node", "server/server.js"]
