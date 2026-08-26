# 使用node為base Image
FROM node:latest

ENV NODE_ENV production

# 移動到工作用的dir
WORKDIR /usr/src/app

# 將package.json 放入該資料夾內 (安裝依賴)
COPY package*.json .

# 安裝node_module
RUN npm install

# 把剩下的東西放入work_dir
COPY . .

# expose 和 執行
EXPOSE 3000
CMD ["npm","start"]