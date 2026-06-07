# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app

# Expose the standard port (Hugging Face default is 7860)
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

# Install backend dependencies
COPY package*.json ./
RUN npm ci --only=production
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --only=production

# Copy backend codebase and build output
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy local config file if it exists, otherwise initialize empty
COPY config.json* ./
RUN [ -f config.json ] || echo '{}' > config.json
RUN echo '[]' > history.json && touch app.log

# Command to run the Express backend
CMD ["npm", "start", "--prefix", "backend"]
