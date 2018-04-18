'use strict'

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

const graphQlService = require('./services/gateway/GraphQlService')();
const eventSourcing = require('./tools/EventSourcing')();
const eventStoreService = require('./services/event-store/EventStoreService')();
const mongoDB = require('./data/MongoDB')();
const Rx = require('rxjs');

const start = () => {
    Rx.Observable.concat(
        eventSourcing.eventStore.start$(),
        eventStoreService.start$(),
        mongoDB.start$()
    ).subscribe(
        (evt) => console.log(evt),
        (error) => {
            console.error('Failed to start',error);
            process.exit(1);
        },
        () => console.log('Devices-location started')
    );
};

start();
graphQlService.start();
// mongoDB.init$().subscribe(
//     (str) => console.log(str),
//     (error) => console.error(`Failed to connect to MongoDB`,error),
//     () => console.log('Mongo db init completed')
// );
// graphQlService.start();
// eventSourceService.start();

