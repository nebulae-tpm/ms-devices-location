'use strict'

const mongoDB = require('./MongoDB')();
const Rx = require('rxjs');

class DeviceLocationDA {

    /**
     * gets DeviceLocation
     * @param {string} type 
     */
    static getDeviceLocationReport$() {
        console.log("getDeviceLocationReport");
        const collection = mongoDB.db.collection('DeviceLocation');
        return Rx.Observable.fromPromise(collection.findOne({ deviceId: 1}));    
    }


    static createDeviceLocation$(deviceLocationReported){
        console.log("createDeviceLocation");
        const collection = mongoDB.db.collection('DeviceLocation');
        return Rx.Observable.fromPromise(collection
            .insertOne({ geojson: deviceLocationReported.geojson,  deviceId: deviceLocationReported.deviceId, version: deviceLocationReported.version}));
    }

}

module.exports = DeviceLocationDA;