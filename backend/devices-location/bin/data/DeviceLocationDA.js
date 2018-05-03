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
        return Rx.Observable.fromPromise(collection.find({loc: {$exists: true}}).skip(page*count).limit(count).toArray());
    }

    /**
     * Updates the location of a device based on data reported
     * @param {*} deviceLocationReported Data reported by the device
     */
    static updateDeviceLocation$(deviceLocationReported){
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                id: deviceLocationReported.aid
            },
            {
                $set: { 
                loc: deviceLocationReported.loc, 
                id: deviceLocationReported.aid, 
                timestamp: deviceLocationReported.timestamp, 
                version: deviceLocationReported.version}
            },
            {
                upsert: true,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined);
    }

    /**
     * Updates the device data
     * @param {*} deviceDataReported Data reported by the device
     */
    static updateDeviceData$(deviceDataReported){
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                id: deviceDataReported.aid
            },
            { $set :{ 
                hostname: deviceDataReported.hostname, 
                id: deviceDataReported.aid, 
                type: deviceDataReported.type, 
                version: deviceDataReported.version
            }},
            {
                upsert: true,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined);
    }

}

module.exports = DeviceLocationDA;