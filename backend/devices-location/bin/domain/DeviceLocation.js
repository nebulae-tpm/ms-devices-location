'use strict'

const Rx = require('rxjs');
const DeviceLocationDA = require('../data/DeviceLocationDA');
const broker = require('../tools/broker/BrokerFactory')();

let instance;

class DeviceLocation {
    constructor() {
    }

    /**
     * Gets the devices location save in DB
     * @param {*} param0 
     * @param {*} authToken 
     */
    getDevicesLocation$({ root, args, jwt }, authToken) {
        console.log('Getting device location report ...'+ args);        
        return DeviceLocationDA.getDevicesLocation$(args.page, args.count)
        .mergeMap(devicesLocations => Rx.Observable.from(devicesLocations))
        .map(deviceLocation => {
            const deviceLocationReportedEvent = {
                deviceId: deviceLocation.deviceId, 
                timeStamp: deviceLocation.timeStamp,
                lat: deviceLocation.geojson.geometry.coordinates[1],
                lng: deviceLocation.geojson.geometry.coordinates[0]
            }
            return deviceLocationReportedEvent;
        }).toArray();
    }

    /**
     * Updates the last location of a device. If the device does not exist, a new device location is created.
     * @param {*} data Device data (Location, time, deviceId)
     * @param {*} authToken Auth token
     */
    updateDeviceLocation$(data, authToken) {
        console.log('Update location');
        const deviceLocation = {deviceId: data.deviceId, geojson: data.geojson, timeStamp: data.timeStamp};  
        return DeviceLocationDA.updateDeviceLocation$(deviceLocation)
        .map(deviceLocation => {
            const deviceLocationReportedEvent = {
                deviceId: deviceLocation.deviceId, 
                timeStamp: deviceLocation.timeStamp,
                lat: deviceLocation.geojson.geometry.coordinates[1],
                lng: deviceLocation.geojson.geometry.coordinates[0]
            }
            broker.send$('MaterializedViewUpdates','deviceLocationReportedEvent',deviceLocationReportedEvent);
            return deviceLocationReportedEvent;
        });
    }

}

module.exports = () => {
    if (!instance) {
        instance = new DeviceLocation();
        console.log('EventSourcingService Singleton created');
    }
    return instance;
};