'use strict'

let mongoDB = undefined;
const Rx = require('rxjs');
const collectionName = 'DeviceLocation';

class DeviceDA {

    static start$(mongoDbInstance) {
        return Rx.Observable.create(observer => {
          if (mongoDbInstance) {
            mongoDB = mongoDbInstance;
            observer.next("using given mongo instance");
          } else {
            mongoDB = require("./MongoDB").singleton();
            observer.next("using singleton system-wide mongo instance");
          }
          observer.complete();
        });
      }
    

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
        // if(true){            
        //      return Rx.Observable.throw(new Error('Error'));
        // } 

        let filter = {};
        if(filterText){
            filter['$or'] = [ { id: {$regex: filterText, $options: 'i'} }, { hostname: {$regex: filterText, $options: 'i'} } ];
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

        //return Rx.Observable.fromPromise(collection.findOne({ id: deviceId }));
        return Rx.Observable.defer(() => collection.findOne({ id: deviceId }));
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
        ).map(result => result && result.value ? result.value : undefined);
    }

    /**
     * Cleans groupnames that are not being used
     * @param {*}
     */
    static getGroupnamesFromAllDevices$() {
        const collection = mongoDB.db.collection(collectionName);

        return Rx.Observable.defer(() => 
            collection.aggregate([
                {$match: {groupName: {'$ne': null}}},
                {$group: {_id:'$groupName'}},   
                {$project: {_id:0, groupName: '$_id'}}
            ]).toArray()
        );
    }

}

/**
 * @returns {DeviceDA}
 */
module.exports = DeviceDA;