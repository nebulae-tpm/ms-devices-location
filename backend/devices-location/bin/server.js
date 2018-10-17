'use strict'

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

const graphQlService = require('./services/gateway/GraphQlService')();
const eventSourcing = require('./tools/EventSourcing')();
const eventStoreService = require('./services/event-store/EventStoreService')();
const mongoDB = require('./data/MongoDB').singleton();
const DeviceDA = require('./data/DeviceDA');
const DeviceGroupDA = require('./data/DeviceGroupDA');
const HistoricalDeviceLocation = require('./data/HistoricalDeviceLocationDA');
const Rx = require('rxjs');

const start = () => {
    Rx.Observable.concat(
        eventSourcing.eventStore.start$(),
        eventStoreService.start$(),
        mongoDB.start$(),
        Rx.Observable.forkJoin(
            DeviceDA.start$(),
            DeviceGroupDA.start$(),
            HistoricalDeviceLocation.start$()
        ),
        graphQlService.start$()
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

