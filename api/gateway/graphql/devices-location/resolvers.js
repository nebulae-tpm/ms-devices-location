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
          500
        )
        .toPromise();
    }
  },
  Subscription: {
    deviceLocationReportedEvent: {
      subscribe: withFilter((payload, variables, context, info) => {
        return pubsub.asyncIterator('deviceLocationReportedEvent');
      },
        (payload, variables, context, info) => {
          //return payload.deviceLocationReportedEvent.lastName === variables.lastName;
          return true;
        }),
    },
  },
}

broker.getMaterializedViewsUpdates$(['deviceLocationReportedEvent']).subscribe(
  evt => {
    console.log("Subscription response1 => ", evt);
    pubsub.publish('deviceLocationReportedEvent', { deviceLocationReportedEvent: evt.data });
  },
  (error) => console.error('Error listening deviceLocationReportedEvent', error),
  () => console.log('deviceLocationReportedEvent listener STOPPED')
);
