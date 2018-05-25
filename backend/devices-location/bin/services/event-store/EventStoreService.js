const Rx = require('rxjs');
const device = require('../../domain/Device')();
const eventSourcing = require('../../tools/EventSourcing')();

/**
 * Singleton instance
 */
let instance;

class EventStoreService {

    constructor() {
        this.functionMap = this.generateFunctionMap();
        this.subscriptions = [];
    }


    /**
     * Starts listening to the EventStore
     * Returns observable that resolves to each subscribe agregate/event
     *    emit value: { aggregateType, eventType, handlerName}
     */
    start$() {
        //default error handler
        const onErrorHandler = (error) => {
            console.error('Error handling  EventStore incoming event', error);
            process.exit(1);
        };
        //default onComplete handler
        const onCompleteHandler = () => {
            () => console.log('EventStore incoming event subscription completed');
        }

        return Rx.Observable.from([
            { aggregateType: 'Device', eventType: 'DeviceDeviceStateReported', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceLocationReported', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceRamuUsageAlarmActivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceRamUsageAlarmDeactivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceSdUsageAlarmActivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceSdUsageAlarmDeactivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceCpuUsageAlarmActivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceCpuUsageAlarmDeactivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceTemperatureAlarmActivated', onErrorHandler, onCompleteHandler },
            { aggregateType: 'Device', eventType: 'DeviceTemperatureAlarmDeactivated', onErrorHandler, onCompleteHandler },
        ]).map(params => this.subscribeEventHandler(params));
    }

    /**
     * Stops listening to the Event store
     * Returns observable that resolves to each unsubscribed subscription as string     
     */
    stop$() {
        Rx.Observable.from(this.subscriptions)
            .map(subscription => {
                subscription.subscription.unsubscribe();
                return `Unsubscribed: aggregateType=${aggregateType}, eventType=${eventType}, handlerName=${handlerName}`;
            })
    }

    /**
     * Create a subscrition to the event store and returns the subscription info     
     * @param {{aggregateType, eventType, onErrorHandler, onCompleteHandler}} params
     * @return { aggregateType, eventType, handlerName  }
     */
    subscribeEventHandler({ aggregateType, eventType, onErrorHandler, onCompleteHandler }) {        
        const handler = this.functionMap[eventType];
        const subscription = eventSourcing.eventStore.getEventListener$(aggregateType)
            // .do(val => {
            //     console.log('Event sourcing => '+ JSON.stringify(val));
            // })
            .filter(evt => evt.et === eventType)
            .mergeMap(evt => handler.fn.call(handler.obj, evt)) 
            .subscribe(
                (evt) => console.log(`EventStoreService: ${eventType} process: ${evt}`),
                onErrorHandler,
                onCompleteHandler
            );
        this.subscriptions.push({ aggregateType, eventType, handlerName: handler.fn.name, subscription });
        return { aggregateType, eventType, handlerName: `${handler.obj.name}.${handler.fn.name}` };
    }

    /**
     * Generates a map that assocs each Event with its handler
     */
    generateFunctionMap() {
        return {
            'DeviceLocationReported': { fn: device.updateDeviceLocation$, obj: device },
            'DeviceDeviceStateReported': { fn: device.updateDeviceData$, obj: device },
            'DeviceRamuUsageAlarmActivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceRamUsageAlarmDeactivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceSdUsageAlarmActivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceSdUsageAlarmDeactivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceCpuUsageAlarmActivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceCpuUsageAlarmDeactivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceTemperatureAlarmActivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceTemperatureAlarmDeactivated': { fn: device.updateDeviceAlarmsState$, obj: device }
        };
    }

}



module.exports = () => {
    if (!instance) {
        instance = new EventStoreService();
        console.log('EventStoreService Singleton created');
    }
    return instance;
};