'use strict'

const mongoDB = require('./MongoDB')();
const Rx = require('rxjs');
const collectionName = 'HistoricalDeviceLocation';

class HistoricalDeviceLocationDA {

    /**
     * Saves historical device location.
     * @param {*} id Device ID
     * @param {*} count quantity of elements to return
     */
    static saveHistoricalDeviceLocation$(historicalDeviceLocation) {
        const collection = mongoDB.db.collection(collectionName);        
        return Rx.Observable.defer(() => collection.insertOne(historicalDeviceLocation));
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

        return Rx.Observable.defer(() => collection.find({id: id}, jsonProjection).sort(sort).limit(count).toArray())        
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
        
        return Rx.Observable.defer(() => collection.find({id}, jsonProjection).sort(sort).toArray())                
        .mergeMap(historicalDevicesLocation => Rx.Observable.from(historicalDevicesLocation))
        .map(historicalDeviceLocation => {
            return {
                lng: historicalDeviceLocation.loc.geojson.coordinates[0],
                lat: historicalDeviceLocation.loc.geojson.coordinates[1],
                timestamp: historicalDeviceLocation.timestamp};
            }
        );
    }

    /**
     * Cleans historical device location by 
     * @param {*} cleanHistoricalDeviceLocation 
     */
    static removeHistoricalDeviceLocation$(cleanHistoricalDeviceLocation) {
        const keepLastNLocations = cleanHistoricalDeviceLocation.data.keepLastNLocations ?
        cleanHistoricalDeviceLocation.data.keepLastNLocations : 90;

        const collection = mongoDB.db.collection(collectionName);

        return Rx.Observable.defer(() => 
            collection.aggregate([
                {$sort: {'timestamp': -1}},   
                {$group: {_id:'$id', historical:{$push: '$_id'}}},   
                {$project: {_id:0, deviceId: '$_id', keepHistorical: {$slice: ['$historical', 0, keepLastNLocations]}}}
            ]).toArray()
        )
        .mergeMap(result => Rx.Observable.from(result))
        .pluck('keepHistorical')
        .reduce((acc, array) => [...acc, ...array], [])
        .mergeMap(result => Rx.Observable.defer(() => collection.remove( { '_id' : { $nin: result } } )));
    }
}

module.exports = HistoricalDeviceLocationDA;