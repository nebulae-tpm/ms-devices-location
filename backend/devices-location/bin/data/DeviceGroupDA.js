'use strict'

const mongoDB = require('./MongoDB')();
const Rx = require('rxjs');
const collectionName = 'DeviceGroup';

class DeviceGroupDA {

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
     * gets device groups
     * @param {string} type 
     */
    static getDeviceGroups$(page, count) {
        return Rx.Observable.create(async observer => {
            const collection = mongoDB.db.collection(collectionName);
            const cursor = collection.find();
            //.skip(page * count).limit(count)

            let obj = await this.extractNextFromMongoCursor(cursor);
            while (obj) {
                observer.next(obj);
                obj = await this.extractNextFromMongoCursor(cursor);
            }

            observer.complete();
        });
    }

    /**
     * Updates the device group passed by parameter
     * @param {*} deviceGroup name of the device group
     */
    static updateDeviceGroup$(deviceGroup) {
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.bindNodeCallback(collection.findOneAndUpdate.bind(collection))(
            {
                name: deviceGroup.name
            },
            { $set: deviceGroup },
            {
                upsert: true,
                returnOriginal: false
            }
        ).map(result => result && result.value ? result.value : undefined);
    }

    /**
     * Remove all groupnames except the values that are in the array
     * @param {*} groupNames
     */
    static removeAllGroupNamesExceptInArray$(groupNames) {
        const collection = mongoDB.db.collection(collectionName);
        
        return Rx.Observable.defer(() => 
            collection.remove({"name": {$nin: groupNames}})
        );
    }

}

module.exports = DeviceGroupDA;