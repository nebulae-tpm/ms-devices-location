'use strict'

const DeviceLocation = require('../../domain/DeviceLocation');
const broker = require('../../tools/broker/BrokerFactory')();
const Rx = require('rxjs');
const jsonwebtoken = require('jsonwebtoken');
const jwtPublicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');

let instance;

class EventSourceService {

    constructor() {
        this.deviceLocation = new DeviceLocation();
        this.functionMap = this.generateFunctionMap();        
    }

    generateFunctionMap() {
        return {
            'deviceLocationReportedEvent': this.deviceLocation.updateDeviceLocation
        };
    }

    start() {
        broker.getMessageListener$(['Device'], Object.keys(this.functionMap))
            //decode and verify the jwt token
            .map(message => { 
                return { authToken: jsonwebtoken.verify(message.data.jwt, jwtPublicKey), message }; 
            })
            //ROUTE MESSAGE TO RESOLVER
            .mergeMap(({ authToken, message }) =>
                this.functionMap[message.type](message.data, authToken)
                    .map(response => {
                        return { response, correlationId: message.id, replyTo: message.attributes.replyTo };
                    })                          
            )
            //send response back if neccesary
            .subscribe(
                ({ response, correlationId, replyTo }) => {
                    console.log('Event sourcing subscribe -> ', { response, correlationId, replyTo });
                    //broker.send$('MaterializedViewUpdates','deviceLocationReportedEvent',response);
                },
                (error) => console.error('Error listening to messages', error),
                () => {
                    console.log(`Message listener stopped`);
                }
            );
    }

    stop() {

    }

}

module.exports = () => {
    if (!instance) {
        instance = new EventSourceService();
        console.log('NEW instance EventSourceService !!');
    }
    return instance;
};

