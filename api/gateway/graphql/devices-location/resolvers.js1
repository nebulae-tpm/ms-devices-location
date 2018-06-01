const withFilter = require('graphql-subscriptions').withFilter;
const PubSub = require('graphql-subscriptions').PubSub;
const broker = require('../../broker/BrokerFactory')();
const pubsub = new PubSub();
const Rx = require('rxjs');

module.exports = {
  Query: {
    getDevicesLocation(root, args, context) {
      console.log('Graphql query getDevicesLocation ', new Date());
      return broker
        .forwardAndGetReply$(
          'Device',
          'gateway.graphql.query.getDevicesLocation',
          { root, args, jwt: context.encodedToken },
          2000
        )
        .toPromise();
    },
    getDeviceGroups(root, args, context) {
      console.log('Graphql query getDeviceGroups ', new Date());
      return broker
        .forwardAndGetReply$(
          'Device',
          'gateway.graphql.query.getDeviceGroups',
          { root, args, jwt: context.encodedToken },
          2000
        )
        .toPromise();
    }
  },
  Subscription: {
    deviceLocationEvent: {
      subscribe: withFilter((payload, variables, context, info) => {
        return pubsub.asyncIterator('deviceLocationEvent');
      },
        (payload, variables, context, info) => {
          //return payload.deviceLocationReportedEvent.lastName === variables.lastName;
          return true;
        }),
    },
  },
}

broker.getMaterializedViewsUpdates$(['deviceLocationEvent']).subscribe(
  evt => {
    console.log("Subscription response1 => ", evt);
    pubsub.publish('deviceLocationEvent', { deviceLocationEvent: evt.data });
  },
  (error) => console.error('Error listening deviceLocationEvent', error),
  () => console.log('deviceLocationEvent listener STOPPED')
);
