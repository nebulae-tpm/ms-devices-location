const withFilter = require('graphql-subscriptions').withFilter;
const PubSub = require('graphql-subscriptions').PubSub;
const broker = require('../../broker/BrokerFactory')();
const pubsub = new PubSub();
const Rx = require('rxjs');

module.exports = {
  Query: {
    getDevicesLocation(root, args, context, fieldASTs) {
      return broker
        .forwardAndGetReply$(
          'Device',
          'gateway.graphql.query.getDevicesLocation',
          { root, args, jwt: context.encodedToken, fieldASTs },
          2000
        )
        .mergeMap(response => getResponseFromBackEnd$(response))
        .toPromise();
    },
    getDeviceGroups(root, args, context) {
      return broker
        .forwardAndGetReply$(
          'Device',
          'gateway.graphql.query.getDeviceGroups',
          { root, args, jwt: context.encodedToken },
          2000
        )
        .mergeMap(response => getResponseFromBackEnd$(response))
        .toPromise();
    }
  },
  Subscription: {
    deviceLocationEvent: {
      subscribe: withFilter((payload, variables, context, info) => {
        return pubsub.asyncIterator('deviceLocationEvent');
      },
        (payload, variables, context, info) => {
          //If no variables were sent in the subscription, that means that all the device location events will be listened.
          if(!variables.ids || variables.ids.length == 0){
            return true;
          }
          return variables.ids.filter(id => id == payload.deviceLocationEvent.id).length > 0;
        }),
    },
  },
}

function getResponseFromBackEnd$(response) {
  return Rx.Observable.of(response)
    .map(resp => {
      if (resp.result.code != 200) {
        const err = new Error();
        err.name = 'Error';
        err.message = resp.result.error;
        Error.captureStackTrace(err, 'Error');
        throw err;
      }
      return resp.data;
    });
}

broker.getMaterializedViewsUpdates$(['deviceLocationEvent']).subscribe(
  evt => {
    
    pubsub.publish('deviceLocationEvent', { deviceLocationEvent: evt.data });
  },
  (error) => console.error('Error listening deviceLocationEvent', error),
  () => console.log('deviceLocationEvent listener STOPPED.')
);
