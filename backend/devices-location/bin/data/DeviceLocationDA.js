'use strict'

const mongoDB = require('./MongoDB')();
const Rx = require('rxjs');
const collectionName = 'DeviceLocation';

class DeviceLocationDA {

    /**
     * gets DeviceLocation
     * @param {string} type 
     */
    static getDevicesLocation$(page, count) {
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.fromPromise(collection.find({}).skip(page*count).limit(count).toArray());
    }

    /**
     * Updates the location of a device based on data reported
     * @param {*} deviceLocationReported Data reported by the device
     */
    static updateDeviceLocation$(deviceLocationReported){
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                deviceId: deviceLocationReported.deviceId
            },
            { geojson: deviceLocationReported.geojson, plate: deviceLocationReported.plate, deviceId: deviceLocationReported.deviceId, timeStamp: deviceLocationReported.timeStamp},
            {
                upsert: true,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined);
    }

}

module.exports = DeviceLocationDA;