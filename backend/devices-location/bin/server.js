'use strict'

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

const graphQlService = require('./services/gateway/GraphQlService')();
const mongoDB = require('./data/MongoDB')();



mongoDB.init$().subscribe(
    (str) => console.log(str),
    (error) => console.error(`Failed to connect to MongoDB`,error),
    () => console.log('Mongo db init completed')
);
graphQlService.start();

