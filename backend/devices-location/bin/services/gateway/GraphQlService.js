'use strict'

const device = require('../../domain/Device')();
const broker = require('../../tools/broker/BrokerFactory')();
const Rx = require('rxjs');
const jsonwebtoken = require('jsonwebtoken');
const jwtPublicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');

let instance;

class GraphQlService {

    constructor() {
        this.functionMap = this.generateFunctionMap();
        this.subscriptions = [];
    }

    generateFunctionMap() {
        return {
            'gateway.graphql.query.getDevicesLocation': device.getDevices$,
            'gateway.graphql.query.getDeviceGroups': device.getDeviceGroups$
        };
    }

    start$() {
        return Rx.Observable.create(observer => {
            this.subscription = broker.getMessageListener$(['Device'], Object.keys(this.functionMap))
                .do(val => console.log('Request received -> ', new Date()))
                //decode and verify the jwt token
                .map(message => { return { authToken: jsonwebtoken.verify(message.data.jwt, jwtPublicKey), message }; })
                //ROUTE MESSAGE TO RESOLVER
                .do(val => console.log('Request verified -> ', new Date()))
                .mergeMap(({ authToken, message }) =>
                    this.functionMap[message.type](message.data, authToken)
                        .map(response => {
                            return { response, correlationId: message.id, replyTo: message.attributes.replyTo };
                        })
                )
                //send response back if neccesary
                .mergeMap(({ response, correlationId, replyTo }) => {
                    if (replyTo) {
                        return broker.send$(replyTo, 'gateway.graphql.Query.response', response, { correlationId });
                    }else{
                        return Rx.Observable.of(undefined);
                    }
                })
                .subscribe(
                    (result) => {
                        // console.log('Query response => ', result);
                    },
                    (error) => console.error('Error listening to messages', error),
                    () => {
                        console.log(`Message listener stopped`);
                    }
                );
            observer.next('GraphQlService is listening to Device topic');
            observer.complete();

        });

    }

    stop$() {
        return Rx.Observable.create(observer => {
            this.subscription.unsubscribe();
            observer.next('GraphQlService stopped listening to messages')
            observer.complete();
        });
    }

}

module.exports = () => {
    if (!instance) {
        instance = new GraphQlService();
        console.log('NEW instance GraphQlService !!');
    }
    return instance;
};

