var amqp = require('amqp');
var events = require('events');
var _ = require('lodash');

var originalCreateConnection = amqp.createConnection;

var interceptedConnections = {};
var queues = {};
var exchanges = {};

function createConnectionIntercept(options) {
	var connectionKey = generateConnectionKey(options);
	if(interceptedConnections[generateConnectionKey(options)]) {
		console.log('Create Connection intercepted.', { key: connectionKey });

		return interceptedConnections[generateConnectionKey(options)].createConnection(options);
	}

	console.log('Create Connection with no interception.', { key: connectionKey, interceptedKeys: Object.keys(interceptedConnections.join(',')) });
	return originalCreateConnection(options);
}

function generateConnectionKey(options) {
	return options.host + ':' + (options.port || 5672);
}

function QueueIntercept(queueName, options) {
	var subscriptions = [];

	return { 
		name: queueName, 
		options: options, 
		api: {
			bind: function(exchange, routingKey) {
				if(!exchanges[exchange]) {
					throw new Error('Could not find exchange: ' + exchange);
				}

				console.log('Queue Bound to exchange', { queue: queueName, exchange: exchange });
				exchanges[exchange].boundQueues.push(queueName)
			},
			subscribe: function (subscriptionOptions, messageHandler) {
				subscriptions.push({ options: subscriptionOptions, handler: messageHandler });
			},
			shift: function() {
				console.log('Subscriber acknowledged.');
			}
		},
		publish: function(message) {
			_.each(subscriptions, function(subscription) {
				console.log('Sending message to subscriber', { message: message });
				subscription.handler({ data: message });
			});
		}
	};
}

function ConnectionIntercept(options) {
	var eventEmitter = new events.EventEmitter();

	return {
		createConnection: function(options) {
			console.log('Allowing connection');

			setImmediate(function() {
				console.log('Sending ready event');
				eventEmitter.emit('ready');
			});

			return {
				queue: function(queueName, options, callback) {
					if(queues[queueName]) {
						console.log('Queue already exists.', { queue: queueName });
					}
					else {
						console.log('Queue Created', { queue: queueName, options: options });
						queues[queueName] = new QueueIntercept(queueName, options);
					}

					callback(queues[queueName].api);
				},
				exchange: function(name, options, callback) {
					console.log('Exchange Created', { queue: name, options: options });

					callback({
						publish: function(routingKey, message) {
							if(exchanges[name].messageInterceptor) {
								console.log('Message Intercepted to exchange', { exchange: name });
								exchanges[name].messageInterceptor(routingKey, { data: message });
							}
						}
					});
				},
				close: function() {},
				on: function(eventName, handler) {
					console.log('Client subscribed to event: ' + eventName);

					eventEmitter.on(eventName, handler);
				}
			};
		},
		api: {
			exchange: function(exchangeName, messageReceivedCallback) {
				exchanges[exchangeName] = {
					boundQueues: [],
					messageInterceptor: messageReceivedCallback
				};

				return {
					publish: (function(routingKey, message) {
						console.log('Event published to exchange', { exchange: exchangeName, routingKey: routingKey });

						if(!this.boundQueues.length) {
							throw new Error('Queue implementation todo.')
							return console.log('No bound queues, message queued');
						}

						_.each(this.boundQueues, function(queue) {
							console.log('Publishing message to bound queue', { queue: queue });

							queues[queue].publish(message);
						});
					}).bind(exchanges[exchangeName])
				};
			}
		},
		clearEvents: function() {
			eventEmitter.removeAllListeners();
		}
	};
}

amqp.createConnection = createConnectionIntercept;

module.exports = {
	mock: function(options) {
		var connectionKey = generateConnectionKey(options);
		
		if(!interceptedConnections[connectionKey]) {
			interceptedConnections[connectionKey] = new ConnectionIntercept(options);
		}

		return interceptedConnections[connectionKey].api;
	},
	reset: function() {
		console.log('Reset message queue intercepts');

		_.each(interceptedConnections, function(connection) {
			connection.clearEvents();
		});

		interceptedConnections = {};
		queues = {};
		exchanges = {};
	}
}

