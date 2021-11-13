FROM node:lts-alpine
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

#RUN npm install
# If you are building your code for production
RUN npm ci --only=production

EXPOSE 5000
CMD [ "npm", "start", "--silent" ]

# Bundle app source
COPY . .
