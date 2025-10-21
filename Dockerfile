# # Build stage
# FROM node:20-alpine AS builder

# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install dependencies
# RUN npm ci

# # Copy source code
# COPY . .

# # Build the application
# RUN npm run build

# # Production stage
# FROM nginx:alpine

# # Copy built files from builder stage
# COPY --from=builder /app/dist /usr/share/nginx/html

# # Copy nginx configuration (optional, if you need custom config)
# # COPY nginx.conf /etc/nginx/conf.d/default.conf

# EXPOSE 80

# CMD ["nginx", "-g", "daemon off;"]

# Dockerfile 예시
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 9003

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "9003"]