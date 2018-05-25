'use strict'

const mongoDB = require('./MongoDB')();
const Rx = require('rxjs');
const collectionName = 'HistoricalDeviceLocation';

class HistoricalDeviceLocationDA {

    /**
     * Saves historical device location
     * @param {*} id Device ID
     * @param {*} count quantity of elements to return
     */
    static saveHistoricalDeviceLocation$(historicalDeviceLocation) {
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.fromPromise(collection.insertOne(historicalDeviceLocation));
    }


    /**
     * gets historical device location by ID 
     * @param {*} id Device ID
     * @param {*} count quantity of elements to return
     */
    static getLastHistoricalDeviceLocationPathById$(id, count) {        
        const jsonProjection = {_id:0, "loc.geojson.coordinates":1,"timestamp":1} ;        
        const sort = {"timestamp": -1} ;
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.fromPromise(collection.find({id: id}, jsonProjection).sort(sort).limit(count).toArray())
        .mergeMap(historicalDevicesLocation => Rx.Observable.from(historicalDevicesLocation))
        .map(historicalDeviceLocation => {
            return {
                lng: historicalDeviceLocation.loc.geojson.coordinates[0],
                lat: historicalDeviceLocation.loc.geojson.coordinates[1],
                timestamp: historicalDeviceLocation.timestamp};
            }
        )
        .toArray();
    }

    /**
     * gets historical device location by ID 
     * @param {*} id Device ID
     */
    static getHistoricalDeviceLocationPathById$(id) {
        const jsonProjection = {_id:0, "loc.coordinates":1,"timestamp":1} ;
        const sort = {"timestamp": -1} ;
        const collection = mongoDB.db.collection(collectionName);
        return Rx.Observable.fromPromise(collection.find({id}, jsonProjection).sort(sort).toArray())
        .mergeMap(historicalDevicesLocation => Rx.Observable.from(historicalDevicesLocation))
        .map(historicalDeviceLocation => {
            return {
                lng: historicalDeviceLocation.loc.geojson.coordinates[0],
                lat: historicalDeviceLocation.loc.geojson.coordinates[1],
                timestamp: historicalDeviceLocation.timestamp};
            }
        );
    }
}

module.exports = HistoricalDeviceLocationDA;