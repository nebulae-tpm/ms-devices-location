const Rx = require('rxjs');
const device = require('../../domain/Device')();
const eventSourcing = require('../../tools/EventSourcing')();
const mbeKey = "ms-devices-location_mbe_devices-location";

/**
 * Singleton instance
 */
let instance;

class EventStoreService {

    constructor() {
        this.functionMap = this.generateFunctionMap();
        this.subscriptions = [];
        this.aggregateEventsArray = this.generateAggregateEventsArray();
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

        return Rx.Observable.from(this.aggregateEventsArray)
            .map(aggregateEvent => {
                return { ...aggregateEvent, onErrorHandler, onCompleteHandler };
            })
            .map(params => this.subscribeEventHandler(params));
    }

    /**
     * Stops listening to the Event store
     * Returns observable that resolves to each unsubscribed subscription as string     
     */
    stop$() {
        return Rx.Observable.from(this.subscriptions)
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
        const subscription =
            //MANDATORY:  AVOIDS ACK REGISTRY DUPLICATIONS
            eventSourcing.eventStore.ensureAcknowledgeRegistry$(aggregateType)
                .mergeMap(() => eventSourcing.eventStore.getEventListener$(aggregateType,mbeKey))
                .filter(evt => evt.et === eventType)
                .mergeMap(evt => Rx.Observable.concat(
                    handler.fn.call(handler.obj, evt),
                    //MANDATORY:  ACKWOWLEDGE THIS EVENT WAS PROCESSED
                    eventSourcing.eventStore.acknowledgeEvent$(evt, mbeKey),
                ))
                .subscribe(
                    (evt) => console.log(`EventStoreService: ${eventType} process: ${evt}`),
                    onErrorHandler,
                    onCompleteHandler
                );
        this.subscriptions.push({ aggregateType, eventType, handlerName: handler.fn.name, subscription });
        return { aggregateType, eventType, handlerName: `${handler.obj.name}.${handler.fn.name}` };
    }

    /**
    * Starts listening to the EventStore
    * Returns observable that resolves to each subscribe agregate/event
    *    emit value: { aggregateType, eventType, handlerName}
    */
    syncState$() {
        return Rx.Observable.from(this.aggregateEventsArray)
            .concatMap(params => this.subscribeEventRetrieval$(params))
    }

    /**
     * Create a subscrition to the event store and returns the subscription info     
     * @param {{aggregateType, eventType, onErrorHandler, onCompleteHandler}} params
     * @return { aggregateType, eventType, handlerName  }
     */
    subscribeEventRetrieval$({ aggregateType, eventType }) {
        const handler = this.functionMap[eventType];
        //MANDATORY:  AVOIDS ACK REGISTRY DUPLICATIONS
        return eventSourcing.eventStore.ensureAcknowledgeRegistry$(aggregateType)
            .switchMap(() => eventSourcing.eventStore.retrieveUnacknowledgedEvents$(aggregateType, mbeKey))
            .filter(evt => evt.et === eventType)
            .concatMap(evt => Rx.Observable.concat(
                handler.fn.call(handler.obj, evt),
                //MANDATORY:  ACKWOWLEDGE THIS EVENT WAS PROCESSED
                eventSourcing.eventStore.acknowledgeEvent$(evt, mbeKey)
            ));
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
            'DeviceTemperatureAlarmDeactivated': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceConnected': { fn: device.updateDeviceAlarmsState$, obj: device },
            'DeviceDisconnected': { fn: device.updateDeviceAlarmsState$, obj: device },
            'ClearDeviceLocationHistorial': { fn: device.cleanHistoricalDeviceLocation$, obj: device }
        };
    }

    /**
    * Generates a map that assocs each AggretateType withs its events
    */
    generateAggregateEventsArray() {
        return [
            { aggregateType: 'Device', eventType: 'DeviceDeviceStateReported' },
            { aggregateType: 'Device', eventType: 'DeviceLocationReported' },
            { aggregateType: 'Device', eventType: 'DeviceRamuUsageAlarmActivated' },
            { aggregateType: 'Device', eventType: 'DeviceRamUsageAlarmDeactivated' },
            { aggregateType: 'Device', eventType: 'DeviceSdUsageAlarmActivated' },
            { aggregateType: 'Device', eventType: 'DeviceSdUsageAlarmDeactivated' },
            { aggregateType: 'Device', eventType: 'DeviceCpuUsageAlarmActivated' },
            { aggregateType: 'Device', eventType: 'DeviceCpuUsageAlarmDeactivated' },
            { aggregateType: 'Device', eventType: 'DeviceTemperatureAlarmActivated' },
            { aggregateType: 'Device', eventType: 'DeviceTemperatureAlarmDeactivated', },
            { aggregateType: 'Device', eventType: 'DeviceConnected' },
            { aggregateType: 'Device', eventType: 'DeviceDisconnected' },
            { aggregateType: 'Cronjob', eventType: 'ClearDeviceLocationHistorial' },
        ];
    }

}



module.exports = () => {
    if (!instance) {
        instance = new EventStoreService();
        console.log('EventStoreService Singleton created');
    }
    return instance;
};