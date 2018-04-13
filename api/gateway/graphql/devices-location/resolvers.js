const withFilter = require('graphql-subscriptions').withFilter;
const PubSub = require('graphql-subscriptions').PubSub;
const pubsub = new PubSub();
const Rx = require('rxjs');

module.exports = {
  Query: {
    author(_, { firstName, lastName }, context, info) {
      return { id: '1233', firstName, lastName, age:  1526};
    },
  },
  Mutation: {
    createAuthor: (root, args, context, info) => {
      const authorAdded = { id: Math.random(), firstName: args.firstName, lastName: args.lastName };
      pubsub.publish('authorAdded', { authorAdded });
      return authorAdded;
    },
  },
  Subscription: {
    authorEvent: {

      subscribe: withFilter((payload, variables, context, info) => {
        const subscription = context.broker.getEvents$(['authorEvent']).subscribe(
          evt => {
            console.log(`authorEvent received: ${JSON.stringify({ authorEvent: evt.data })}`);
            pubsub.publish('authorEvent', { authorEvent: evt.data })
          },
          (error) => console.error('Error listening authorEvent', error),
          () => console.log('authorEvent listener STOPED :D')
        );

        context.webSocket.onUnSubscribe = Rx.Observable.create((observer) => {
          subscription.unsubscribe();
          observer.next('rxjs subscription had been terminated');
          observer.complete();
        });
        return pubsub.asyncIterator('authorEvent');
      },
        (payload, variables, context, info) => {
          //return payload.authorEvent.lastName === variables.lastName;
          return true;
        }),
    },
    authorAdded: {
      subscribe(payload, variables, context, info) {
        context.webSocket.onUnSubscribe = Rx.Observable.of('ACTION RX STREAM');
        return pubsub.asyncIterator('authorAdded');
      },
    },
    // deviceLocationReportedEvent: {
    //   subscribe: withFilter((payload, variables, context, info) => {
    //     const subscription = context.broker.getEvents$(['deviceLocationReportedEvent']).subscribe(
    //       evt => {
    //         console.log(`deviceLocationReportedEvent received: ${JSON.stringify({ deviceLocationReportedEvent: evt.data })}`);
    //         pubsub.publish('deviceLocationReportedEvent', { deviceLocationReportedEvent: evt.data })
    //       },
    //       (error) => console.error('Error listening deviceLocationReportedEvent', error),
    //       () => console.log('deviceLocationReportedEvent listener STOPED :D')
    //     );

    //     context.webSocket.onUnSubscribe = Rx.Observable.create((observer) => {
    //       subscription.unsubscribe();
    //       observer.next('rxjs subscription had been terminated');
    //       observer.complete();
    //     });
    //     return pubsub.asyncIterator('deviceLocationReportedEvent');
    //   },
    //     (payload, variables, context, info) => {
    //       //return payload.deviceLocationReportedEvent.lastName === variables.lastName;
    //       return true;
    //     }),
    // },
  },
}

