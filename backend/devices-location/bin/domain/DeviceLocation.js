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
        return DeviceLocationDA.getDevicesLocation$(args.page, args.count)
        .mergeMap(devicesLocations => Rx.Observable.from(devicesLocations))
        .map(deviceLocation => {
            console.log('deviceLocation1 => ', deviceLocation);       
            const deviceLocationReportedEvent = {
                id: deviceLocation.id, 
                timestamp: deviceLocation.timestamp,
                lat: deviceLocation.loc.geojson.coordinates[1],
                lng: deviceLocation.loc.geojson.coordinates[0],
                hostname: deviceLocation.hostname,
                type: deviceLocation.type
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
        const deviceLocation = {aid: data.aid, loc: data.data.loc, timestamp: data.data.timestamp, version: data.etv};  
        return DeviceLocationDA.updateDeviceLocation$(deviceLocation)
        .map(deviceLocation => {
            const deviceLocationReportedEvent = {
                id: deviceLocation.id, 
                timestamp: deviceLocation.timestamp,
                lat: deviceLocation.loc ? deviceLocation.loc.geojson.coordinates[1]: "",
                lng: deviceLocation.loc ? deviceLocation.loc.geojson.coordinates[0]: "",
                hostname: deviceLocation.hostname,
                type: deviceLocation.type
            }            
            return deviceLocationReportedEvent;
        }).mergeMap(formattedLoc => broker.send$('MaterializedViewUpdates','deviceLocationReportedEvent',formattedLoc));
    }

    /**
     * Updates the device data. If the device does not exist, a new device location is created without location.
     * @param {*} data Device data (type, hostname)
     * @param {*} authToken Auth token
     */
    updateDeviceData$(data, authToken) {
        const deviceData = {aid: data.aid, hostname: data.data.hostname, type: data.data.type, version: data.etv};  
        return DeviceLocationDA.updateDeviceData$(deviceData)
        .map(deviceLocation => {
            const deviceLocationReportedEvent = {
                id: deviceLocation.id, 
                timestamp: deviceLocation.timestamp,
                lat: deviceLocation.loc ? deviceLocation.loc.geojson.coordinates[1]: "",
                lng: deviceLocation.loc ? deviceLocation.loc.geojson.coordinates[0]: "",
                hostname: deviceLocation.hostname,
                type: deviceLocation.type
            }            
            return deviceLocationReportedEvent;
        }).mergeMap(formattedLoc => broker.send$('MaterializedViewUpdates','deviceLocationReportedEvent',formattedLoc));
    }

}

module.exports = () => {
    if (!instance) {
        instance = new DeviceLocation();
        console.log('EventSourcingService Singleton created');
    }
    return instance;
};