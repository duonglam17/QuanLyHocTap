FROM node:20-alpine

WORKDIR /app

# Sao chép file cấu hình phụ thuộc trước để tận dụng Docker cache
COPY package*.json ./

RUN npm install --omit=dev

# Sao chép toàn bộ mã nguồn
COPY . .

# Tạo thư mục uploads nếu chưa tồn tại
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh

CMD ["node", "src/server.js"]

