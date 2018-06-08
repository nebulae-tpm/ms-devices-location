'use strict'

const Rx = require('rxjs');
const DeviceDA = require('../data/DeviceDA');
const HistoricalDeviceLocationDA = require('../data/HistoricalDeviceLocationDA');
const DeviceGroupDA = require('../data/DeviceGroupDA');
const broker = require('../tools/broker/BrokerFactory')();
const MATERIALIZED_VIEW_TOPIC = "materialized-view-updates";
const HISTORICAL_DEVICE_LOCATION_QUANTITY = 90;

let instance;

class Device {
    constructor() {
    }

    /**
     * Gets the devices location save in DB
     * @param {*} param0 
     * @param {*} authToken 
     */
    getDevices$({ root, args, jwt }, authToken) {
        return DeviceDA.getDevices$(args.filterText, args.groupName, args.limit)
            //.mergeMap(devicesLocations => Rx.Observable.from(devicesLocations))
            .concatMap(device =>
                Rx.Observable.forkJoin(
                    Rx.Observable.of(device),
                    HistoricalDeviceLocationDA.getLastHistoricalDeviceLocationPathById$(device.id, HISTORICAL_DEVICE_LOCATION_QUANTITY)
                )
            )
            .map(([deviceLocation, historicalDeviceLocation]) => {
                const deviceLocationEvent = {
                    id: deviceLocation.id,
                    currentLocation: deviceLocation.loc ? {
                        lng: deviceLocation.loc.geojson.coordinates[0],
                        lat: deviceLocation.loc.geojson.coordinates[1],
                        timestamp: deviceLocation.timestamp
                    } : undefined,
                    hostname: deviceLocation.hostname,
                    groupName: deviceLocation.groupName,
                    type: deviceLocation.type,
                    ramUsageAlarmActivated: deviceLocation.ramUsageAlarmActivated,
                    sdUsageAlarmActivated: deviceLocation.sdUsageAlarmActivated,
                    cpuUsageAlarmActivated: deviceLocation.cpuUsageAlarmActivated,
                    temperatureAlarmActivated: deviceLocation.temperatureAlarmActivated,
                    online: deviceLocation.online,
                    locationPath: historicalDeviceLocation
                }
                return deviceLocationEvent;
            })
            .toArray();
    }

    /**
     * Updates the last location of a device. If the device does not exist, a new device location is created.
     * @param {*} data Device data (Location, time, deviceId)
     * @param {*} authToken Auth token
     */
    updateDeviceLocation$(data, authToken) {
        const deviceData = { id: data.aid, loc: data.data.loc, timestamp: data.data.timestamp, version: data.etv };
        const historicalDeviceLocation = { id: data.aid, loc: data.data.loc, timestamp: data.data.timestamp, version: data.etv };

        return HistoricalDeviceLocationDA
            .saveHistoricalDeviceLocation$(historicalDeviceLocation)
            .mergeMap(historicalDeviceLocation => DeviceDA.getDeviceById$(deviceData.id))
            .mergeMap(deviceDB => {
                if (!deviceDB || !deviceDB.timestamp || deviceDB.timestamp < deviceData.timestamp) {
                    return DeviceDA.updateDeviceData$(deviceData.id, deviceData)
                }
                return Rx.Observable.of(undefined);
            })
            .mergeMap(updateDeviceData =>
                Rx.Observable.forkJoin(
                    updateDeviceData ? Rx.Observable.of(updateDeviceData) : DeviceDA.getDeviceById$(data.aid),
                    HistoricalDeviceLocationDA.getLastHistoricalDeviceLocationPathById$(data.aid, HISTORICAL_DEVICE_LOCATION_QUANTITY)
                )
            )
            .map(([deviceLocation, historicalDevicesLocation]) => {
                const deviceLocationEvent = {
                    id: deviceLocation.id,
                    currentLocation: deviceLocation.loc ? {
                        lng: deviceLocation.loc.geojson.coordinates[0],
                        lat: deviceLocation.loc.geojson.coordinates[1],
                        timestamp: deviceLocation.timestamp
                    } : undefined,
                    hostname: deviceLocation.hostname,
                    groupName: deviceLocation.groupName,
                    type: deviceLocation.type,
                    ramUsageAlarmActivated: deviceLocation.ramUsageAlarmActivated,
                    sdUsageAlarmActivated: deviceLocation.sdUsageAlarmActivated,
                    cpuUsageAlarmActivated: deviceLocation.cpuUsageAlarmActivated,
                    temperatureAlarmActivated: deviceLocation.temperatureAlarmActivated,
                    online: deviceLocation.online,
                    locationPath: historicalDevicesLocation
                }
                return deviceLocationEvent;
            }).mergeMap(formattedLoc => broker.send$(MATERIALIZED_VIEW_TOPIC, 'deviceLocationEvent', formattedLoc));
    }

    /**
     * Updates device alarm state according to the received event.
     * 
     * @param {*} evt Event of the device
     * @param {*} authToken Auth token
     */
    updateDeviceAlarmsState$(evt, authToken) {        
        let deviceData;
        switch (evt.et) {
            case 'DeviceRamuUsageAlarmActivated':
                deviceData = {
                    ramUsageAlarmActivated: true
                }
                break;
            case 'DeviceRamUsageAlarmDeactivated':
                deviceData = {
                    ramUsageAlarmActivated: false
                }
                break;
            case 'DeviceSdUsageAlarmActivated':
                deviceData = {
                    sdUsageAlarmActivated: true
                }
                break;
            case 'DeviceSdUsageAlarmDeactivated':
                deviceData = {
                    sdUsageAlarmActivated: false
                }
                break;
            case 'DeviceCpuUsageAlarmActivated':
                deviceData = {
                    cpuUsageAlarmActivated: true
                }
                break;
            case 'DeviceCpuUsageAlarmDeactivated':
                deviceData = {
                    cpuUsageAlarmActivated: false
                }
                break;
            case 'DeviceTemperatureAlarmActivated':
                deviceData = {
                    temperatureAlarmActivated: true
                }
                break;
            case 'DeviceTemperatureAlarmDeactivated':
                deviceData = {
                    temperatureAlarmActivated: false
                }
                break;
            case 'DeviceConnected':
                console.log('1 - UpdateDeviceAlarmState: ', JSON.stringify(evt));
                deviceData = {
                    online: evt.data.connected
                }
                break;
            case 'DeviceDisconnected':
                console.log('2 - UpdateDeviceAlarmState: ', JSON.stringify(evt));
                return Rx.Observable.empty();
            default:
                return Rx.Observable.empty();
        }

        deviceData['id'] = evt.aid;
        return this.updateDevice$(deviceData, authToken);
    }

    /**
     * Updates the device information. If the device does not exist, a new device location is created without location.
     * @param {*} data Device data (type, hostname, serial)
     * @param {*} authToken Auth token
     */
    updateDeviceData$(deviceDeviceState, authToken) {
        let deviceData = {
            id: deviceDeviceState.aid, 
            hostname: (deviceDeviceState.data.hostname ? deviceDeviceState.data.hostname: undefined), 
            groupName: (deviceDeviceState.data.groupName ? deviceDeviceState.data.groupName: undefined), 
            version: deviceDeviceState.etv };
        //Remove undefined values
        deviceData = JSON.parse(JSON.stringify(deviceData));
        
        let obs = Rx.Observable.of(undefined);
        if(deviceDeviceState.data.groupName){
            const deviceGroup = { name: deviceDeviceState.data.groupName};
            obs = DeviceGroupDA.updateDeviceGroup$(deviceGroup);
        }

        return Rx.Observable.forkJoin(
            obs,
            this.updateDevice$(deviceData, authToken)
        )
        //return this.updateDevice$(deviceData, authToken);
    }

    /**
     * Updates the device data, If the device does not exist, a new device location is created without location.
     * @param {*} data Device data (type, serial, hostname)
     * @param {*} authToken Auth token
     */
    updateDevice$(deviceData, authToken) {

        return Rx.Observable.forkJoin(
            DeviceDA.updateDeviceData$(deviceData.id, deviceData),
            HistoricalDeviceLocationDA.getLastHistoricalDeviceLocationPathById$(deviceData.id, HISTORICAL_DEVICE_LOCATION_QUANTITY)
        ).map(([deviceLocation, historicalDeviceLocation]) => {
            const deviceLocationReportedEvent = {
                id: deviceLocation.id,
                currentLocation: deviceLocation.loc ? {
                    lng: deviceLocation.loc.geojson.coordinates[0],
                    lat: deviceLocation.loc.geojson.coordinates[1],
                    timestamp: deviceLocation.timestamp
                } : undefined,
                hostname: deviceLocation.hostname,
                groupName: deviceLocation.groupName,
                type: deviceLocation.type,
                ramUsageAlarmActivated: deviceLocation.ramUsageAlarmActivated,
                sdUsageAlarmActivated: deviceLocation.sdUsageAlarmActivated,
                cpuUsageAlarmActivated: deviceLocation.cpuUsageAlarmActivated,
                temperatureAlarmActivated: deviceLocation.temperatureAlarmActivated,
                online: deviceLocation.online,
                locationPath: historicalDeviceLocation
            }
            return deviceLocationReportedEvent;
        }).mergeMap(formattedLoc => broker.send$(MATERIALIZED_VIEW_TOPIC, 'deviceLocationEvent', formattedLoc));
    }

    /**
     * Gets the device groups
     * @param {*} param0 
     * @param {*} authToken 
     */
    getDeviceGroups$({ root, args, jwt }, authToken) {
        return DeviceGroupDA.getDeviceGroups$().toArray();
    }

    /**
     * Updates the device group
     * @param {*} param0 
     * @param {*} authToken 
     */
    updateDeviceGroup$(deviceDeviceState, authToken) {
        if(deviceDeviceState.data.groupName){
            const deviceGroup = { name: deviceDeviceState.data.groupName};
            return DeviceGroupDA.updateDeviceGroup$(deviceGroup);
        }
        return Rx.Observable.of(undefined);        
    }

    /**
     * Cleans historial of device location
     * @param {*} cleanDeviceLocationHistory 
     * @param {*} authToken 
     */
    cleanDeviceLocationHistory$(cleanDeviceLocationHistory, authToken){
        console.log('cleanDeviceLocationHistory => ', new Date());
        return HistoricalDeviceLocationDA.removeHistoricalDeviceLocation$(cleanDeviceLocationHistory);
    }

    /**
     * Removes groupnames that are not being used
     * @param {*} cleanDeviceLocationHistory 
     * @param {*} authToken 
     */
    cleanGroupNames$(cleanDeviceGroupNames, authToken){
        console.log('cleanGroupNames => ', new Date());
        return DeviceDA.getGroupnamesFromAllDevices$()
        .mergeMap(groupNames => Rx.Observable.from(groupNames))
        .pluck('groupName')
        .toArray()
        .mergeMap(groupNames => DeviceGroupDA.removeAllGroupNamesExceptInArray$(groupNames));
    }

}

module.exports = () => {
    if (!instance) {
        instance = new Device();
        console.log('EventSourcingService Singleton created');
    }
    return instance;
};