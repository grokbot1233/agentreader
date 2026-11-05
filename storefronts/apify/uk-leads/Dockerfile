FROM apify/actor-node:20
COPY package.json ./
RUN npm install --omit=dev
COPY main.js ./
CMD npm start
