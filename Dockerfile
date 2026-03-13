# Build Environment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first to leverage Docker cache
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Accept build arguments to bake into Vite build
ARG VITE_OPENROUTER_API_KEY
ENV VITE_OPENROUTER_API_KEY=$VITE_OPENROUTER_API_KEY

ARG VITE_N8N_WEBHOOK_URL
ENV VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL

# Build the Vite React application
RUN npm run build

# Production Environment
FROM nginx:alpine

# Copy built assets from builder phase
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 internally
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
