const withFilter = require('graphql-subscriptions').withFilter;
const PubSub = require('graphql-subscriptions').PubSub;
const pubsub = new PubSub();
const Rx = require('rxjs');

module.exports = {
  Query: {
    getDevicesLocation(root, args, context) {
      return context.broker
        .forwardAndGetReply$(
          'projects/ne-tpm-prod/topics/Device',
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
        const subscription = context.broker.getMaterializedViewsUpdates$(['deviceLocationReportedEvent']).subscribe(
          evt => {
            pubsub.publish('deviceLocationReportedEvent', { deviceLocationReportedEvent: evt.data })
          },
          (error) => console.error('Error listening deviceLocationReportedEvent', error),
          () => console.log('deviceLocationReportedEvent listener STOPPED')
        );

        context.webSocket.onUnSubscribe = Rx.Observable.create((observer) => {
          subscription.unsubscribe();
          observer.next('rxjs subscription had been terminated');
          observer.complete();
        });
        return pubsub.asyncIterator('deviceLocationReportedEvent');
      },
        (payload, variables, context, info) => {
          //return payload.deviceLocationReportedEvent.lastName === variables.lastName;
          return true;
        }),
    },
  },
}
