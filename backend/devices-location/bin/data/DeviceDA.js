'use strict'

const mongoDB = require('./MongoDB')();
const Rx = require('rxjs');
const collectionName = 'DeviceLocation';

class DeviceDA {

    /**
   * Extracts the next value from a mongo cursos if available, returns undefined otherwise
   * @param {*} cursor
   */
    static async extractNextFromMongoCursor(cursor) {
        const hasNext = await cursor.hasNext();
        if (hasNext) {
            const obj = await cursor.next();
            return obj;
        }
        return undefined;
    }

    /**
     * gets DeviceLocation according to the filter
     * @param {string} type 
     */
    static getDevices$(filterText, groupName, limit) {
        let filter = {};
        if(filterText){
            filter['$or'] = [ { id: filterText }, { hostname: filterText } ];
        }

        if(groupName){
            filter['groupName'] = groupName;
        }
        
        filter['loc'] = { $exists: true };

        return Rx.Observable.create(async observer => {
            const collection = mongoDB.db.collection(collectionName);
            const cursor = collection.find(filter);
            if (limit) {
                cursor.limit(limit);
            }

            let obj = await this.extractNextFromMongoCursor(cursor);
            while (obj) {
                observer.next(obj);
                obj = await this.extractNextFromMongoCursor(cursor);
            }

            observer.complete();
        });

        // const collection = mongoDB.db.collection(collectionName);
        // return Rx.Observable.fromPromise(collection.find({ loc: { $exists: true } }).skip(page * count).limit(count).toArray());
    }

    /**
     * gets device by ID
     * @param {*} deviceId ID of the device
     */
    static getDeviceById$(deviceId) {
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.fromPromise(collection.findOne({ id: deviceId }));
    }

    /**
     * Updates the location of a device based on data reported
     * @param {*} deviceLocationReported Data reported by the device
     */
    static updateDeviceLocation$(id, deviceLocationReported) {
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                id: id
            },
            {
                $set: {
                    loc: deviceLocationReported.loc,
                    id: deviceLocationReported.aid,
                    timestamp: deviceLocationReported.timestamp,
                    version: deviceLocationReported.version
                }
            },
            {
                upsert: true,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined);
    }

    /**
     * Updates the device data
     * @param {*} deviceData Data reported by the device
     */
    static updateDeviceData$(id, deviceData) {
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                id: id
            },
            { $set: deviceData },
            {
                upsert: true,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined);
    }

    /**
     * Updates the device data
     * @param {*} deviceData Data reported by the device
     */
    static updateCurrentDeviceLocation$(deviceData) {
        console.log('updateCurrentLocation ==> ', deviceData);
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                id: deviceData.id
            },
            { $set: deviceData },
            {
                upsert: false,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined)
        .do(currentLocation => console.log('************ CURRENT LOCATION ', currentLocation));
    }

}

module.exports = DeviceDA;