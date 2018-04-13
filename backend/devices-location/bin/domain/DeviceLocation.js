'use strict'

const Rx = require('rxjs');
const DeviceLocationDA = require('../data/DeviceLocationDA');

class DeviceLocation {
    constructor() {
    }

    getDeviceLocationReport({ root, args, jwt }, authToken) {        
        return DeviceLocationDA.getDeviceLocationReport$(args);
    }


}

module.exports = DeviceLocation;