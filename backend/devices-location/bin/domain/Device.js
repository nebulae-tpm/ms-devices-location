'use strict'

const Rx = require('rxjs');
const DeviceDA = require('../data/DeviceDA');
const HistoricalDeviceLocationDA = require('../data/HistoricalDeviceLocationDA');
const DeviceGroupDA = require('../data/DeviceGroupDA');
const broker = require('../tools/broker/BrokerFactory')();
const MATERIALIZED_VIEW_TOPIC = "materialized-view-updates";
const { CustomError, DefaultError } = require('../tools/CustomError');
const HISTORICAL_DEVICE_LOCATION_QUANTITY = 90;

let instance;

class Device {
    constructor() {
        this.materializedViewsEventEmitted$ = new Rx.Subject();

        this.materializedViewsEventEmitted$
            .groupBy(device => device.id)
            .mergeMap(group$ => group$.debounceTime(2000))
            .mergeMap(device => this.sendDeviceEvent$(device))
            .subscribe(
                (result) => {},
                (err) => { console.log(err) },
                () => { }
            );
    }

    /**
     * Gets the devices location save in DB
     * @param {*} param0 
     * @param {*} authToken 
     */
    getDevices$({ root, args, jwt, fieldASTs }, authToken) {
        const requestedFields = this.getProjection(fieldASTs);          
        return DeviceDA.getDevices$(args.filterText, args.groupName, args.limit)
            //.mergeMap(devicesLocations => Rx.Observable.from(devicesLocations))
            .concatMap(device =>
                Rx.Observable.forkJoin(
                    Rx.Observable.of(device),
                    (requestedFields && requestedFields.locationPath ? 
                    HistoricalDeviceLocationDA.getLastHistoricalDeviceLocationPathById$(device.id, HISTORICAL_DEVICE_LOCATION_QUANTITY):
                    Rx.Observable.of(undefined))
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
            .toArray()
            .mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse))
            .catch(err => this.errorHandler$(err));
    }

    /**
     * Updates the last location of a device. If the device does not exist, a new device location is created.
     * @param {*} data Device data (Location, time, deviceId)
     * @param {*} authToken Auth token
     */
    updateDeviceLocation$(data, authToken) {
        const deviceData = { id: data.aid, loc: data.data.loc, timestamp: data.data.timestamp, version: data.etv };
        const historicalDeviceLocation = { id: data.aid, loc: data.data.loc, timestamp: data.data.timestamp, version: data.etv };

        console.log('updateDeviceLocation => ', JSON.stringify(data));
        return HistoricalDeviceLocationDA
            .saveHistoricalDeviceLocation$(historicalDeviceLocation)
            .mergeMap(historicalDeviceLocation => DeviceDA.getDeviceById$(deviceData.id))
            .mergeMap(deviceDB => {
                if (!deviceDB || !deviceDB.timestamp || deviceDB.timestamp < deviceData.timestamp) {
                    return DeviceDA.updateDeviceData$(deviceData.id, deviceData)
                }
                return Rx.Observable.of(undefined);
            })
            .mergeMap(deviceData =>
                deviceData ? Rx.Observable.of(deviceData) : DeviceDA.getDeviceById$(data.aid)
            )
            .do(device => this.materializedViewsEventEmitted$.next(device));
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
                deviceData = {
                    online: evt.data.connected
                }
                break;
            case 'DeviceDisconnected':
                return Rx.Observable.empty();
            default:
                return Rx.Observable.empty();
        }

        deviceData['id'] = evt.aid;

        return Rx.Observable.of(deviceData)
        .mergeMap(device => DeviceDA.updateDeviceData$(device.id, device))
        .do(device => this.materializedViewsEventEmitted$.next(device));
    }

    /**
     * Updates the device information. If the device does not exist, a new device location is created without location.
     * @param {*} data Device data (type, hostname, serial)
     * @param {*} authToken Auth token
     */
    updateDeviceData$(deviceDeviceState, authToken) {
        let deviceData = {
            id: deviceDeviceState.aid, 
            hostname: (deviceDeviceState.data.hostname ? deviceDeviceState.data.hostname : undefined),
            groupName: (deviceDeviceState.data.groupName ? deviceDeviceState.data.groupName : undefined),
            version: deviceDeviceState.etv
        };
        //Remove undefined values
        deviceData = JSON.parse(JSON.stringify(deviceData));
        
        let obs = Rx.Observable.of(undefined);
        if (deviceDeviceState.data.groupName) {
            const deviceGroup = { name: deviceDeviceState.data.groupName };
            obs = DeviceGroupDA.updateDeviceGroup$(deviceGroup);
        }

        return obs.mergeMap(val => DeviceDA.updateDeviceData$(deviceData.id, deviceData))
        .do(device => this.materializedViewsEventEmitted$.next(device));
    }

    /**
     * Gets the device and its device location history and send an event 
     * @param {*} data Device data (type, serial, hostname)
     */
    sendDeviceEvent$(deviceData) {    
        return Rx.Observable.forkJoin(
            DeviceDA.getDeviceById$(deviceData.id),
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
        }).mergeMap(formattedLoc => 
            broker.send$(MATERIALIZED_VIEW_TOPIC, 'deviceLocationEvent', formattedLoc)
        );
    }

    /**
     * Gets the device groups
     * @param {*} param0 
     * @param {*} authToken 
     */
    getDeviceGroups$({ root, args, jwt }, authToken) {
        return DeviceGroupDA.getDeviceGroups$()
        .toArray()
        .mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse))
        .catch(err => this.errorHandler$(err));
    }

    /**
     * Updates the device group
     * @param {*} param0 
     * @param {*} authToken 
     */
    updateDeviceGroup$(deviceDeviceState, authToken) {
        if (deviceDeviceState.data.groupName) {
            const deviceGroup = { name: deviceDeviceState.data.groupName };
            return DeviceGroupDA.updateDeviceGroup$(deviceGroup);
        }
        return Rx.Observable.of(undefined);        
    }

    /**
     * Cleans historial of device location
     * @param {*} cleanDeviceLocationHistory 
     * @param {*} authToken 
     */
    cleanDeviceLocationHistory$(cleanDeviceLocationHistory, authToken) {
        return HistoricalDeviceLocationDA.removeHistoricalDeviceLocation$(cleanDeviceLocationHistory);
    }

    /**
     * Removes groupnames that are not being used
     * @param {*} cleanDeviceLocationHistory 
     * @param {*} authToken 
     */
    cleanGroupNames$(cleanDeviceGroupNames, authToken) {
        return DeviceDA.getGroupnamesFromAllDevices$()
        .mergeMap(groupNames => Rx.Observable.from(groupNames))
        .pluck('groupName')
        .toArray()
        .mergeMap(groupNames => DeviceGroupDA.removeAllGroupNamesExceptInArray$(groupNames));
    }

    /**
     * Builds the response structure to send through GraphQL
     * @param {*} rawResponse 
     */
    buildSuccessResponse$(rawResponse) {
        return Rx.Observable.of(rawResponse).map(resp => ({
            data: resp,
            result: { code: 200 }
        }))
    }

    /**
     * Builds the error response 
     * @param {*} err 
     */
    errorHandler$(err) {
        return Rx.Observable.of(err).map(err => {
          const exception = { data: null, result: {} };
          if (err instanceof CustomError) {
            exception.result = {
              code: err.code,
              error: err.getContent()
            };
          } else {
            const defaultError = new DefaultError(err.message);
            exception.result = {
              code: defaultError.code,
              error: {
                name: 'Error',
                code: defaultError.code,
                msg: defaultError.getContent()
              }
            };
          }
          return exception;
        });
    }

    /**
     * Gets the fields requested through Graphql
     * @param {*} fieldASTs 
     */
    getProjection (fieldASTs) {
        if(!fieldASTs){
            return undefined;
        }

        return fieldASTs.fieldNodes[0].selectionSet.selections.reduce((projections, selection) => {
          projections[selection.name.value] = true;
          return projections;
        }, {});
    }
}

/**
 * @returns {Device}
 */
module.exports = () => {
    if (!instance) {
        instance = new Device();
        console.log('EventSourcingService Singleton created');
    }
    return instance;
};