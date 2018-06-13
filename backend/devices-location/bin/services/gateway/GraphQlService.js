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
        this.aggregateEventsArray = this.generateAggregateEventsArray();
    }

    start$() {
        const onErrorHandler = error => {
            console.error('Error handling  GraphQl incoming event', error);
            process.exit(1);
          };
      
          //default onComplete handler
          const onCompleteHandler = () => {
            () => console.log('GraphQlService incoming event subscription completed');
          };

          console.log('GraphQl Service starting ...');


          return Rx.Observable.from(this.aggregateEventsArray)
            .map(aggregateEvent => {
                return { ...aggregateEvent, onErrorHandler, onCompleteHandler };
            })
            .map(params => this.subscribeEventHandler(params));
    }

    subscribeEventHandler({
        aggregateType,
        messageType,
        onErrorHandler,
        onCompleteHandler
      }) {
        const handler = this.functionMap[messageType];
        const subscription = broker
          .getMessageListener$([aggregateType], [messageType])
          //decode and verify the jwt token
          .map(message => {
            return {
              authToken: jsonwebtoken.verify(message.data.jwt, jwtPublicKey),
              message
            };
          })
          //ROUTE MESSAGE TO RESOLVER
          .mergeMap(({ authToken, message }) =>
            handler.fn
              .call(handler.obj, message.data, authToken)
              .map(response => {
                return {
                  response,
                  correlationId: message.id,
                  replyTo: message.attributes.replyTo
                };
              })
          )
          //send response back if neccesary
          .mergeMap(({ response, correlationId, replyTo }) => {
            if (replyTo) {
              return broker.send$(
                replyTo,
                'gateway.graphql.Query.response',
                response,
                { correlationId }
              );
            } else {
              return Rx.Observable.of(undefined);
            }
          })
          .subscribe(
            msg => {
              console.log(`GraphQlService process: ${msg}`);
            },
            onErrorHandler,
            onCompleteHandler
          );
        this.subscriptions.push({
          aggregateType,
          messageType,
          handlerName: handler.fn.name,
          subscription
        });
        return {
          aggregateType,
          messageType,
          handlerName: `${handler.obj.name}.${handler.fn.name}`
        };
      }

    stop$() {
        return Rx.Observable.create(observer => {
            this.subscription.unsubscribe();
            observer.next('GraphQlService stopped listening to messages')
            observer.complete();
        });
    }

    generateFunctionMap() {
        return {
            'gateway.graphql.query.getDevicesLocation': {
                fn: device.getDevices$,
                obj: device
            },
            'gateway.graphql.query.getDeviceGroups': {
                fn: device.getDeviceGroups$,
                obj: device
            }
        };
    }

    /**
    * Generates a map that assocs each AggretateType withs its events
    */
   generateAggregateEventsArray() {
    return [
        { aggregateType: 'Device', messageType: 'gateway.graphql.query.getDevicesLocation' },
        { aggregateType: 'Device', messageType: 'gateway.graphql.query.getDeviceGroups' }
    ];
}

}

module.exports = () => {
    if (!instance) {
        instance = new GraphQlService();
        console.log('NEW instance GraphQlService !!');
    }
    return instance;
};

