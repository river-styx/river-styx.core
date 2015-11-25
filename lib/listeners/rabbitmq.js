'use strict';

const amqp = require('amqp');
const events = require('../events');

module.exports = function AmqpListener(config) {
	let connected;

	console.log('Initialising Rabbit MQ listener');

	function messageReceived(queue, msg) {
		console.log('Message received', { msg: msg });

		if (!msg.data) {
			console.log('Message received with no data.', { msg: msg });
			return queue.shift();
		}

		events.emit('message-received', JSON.parse(msg.data.toString('utf-8')));
		queue.shift();
	}

	function queueReady(resolve, queue) {
		console.log('Connected to Queue');
		console.log('Binding Queue to exchange.', { exchange: config.exchange, routingKey: config.routing });
		queue.bind(config.exchange, config.routing);

		queue.subscribe({ ack: true }, messageReceived.bind(undefined, queue));

		console.log('Queue connected and bound.');

		resolve();
	}

	function connectionReady(resolve, reject, connection) {
		if (connected) {
			return;
		}

		connected = true;
		console.log('Connected to Rabbit MQ');
		console.log('Connecting to Queue to Rabbit MQ', { queue: config.queue });

		connection.queue(config.queue, { autoDelete: false }, queueReady.bind(undefined, resolve));
	}

	function startUp(eventEmitter, resolve, reject) {
		const options = { host: config.host };

		if (config.port) {
			options.port = config.port;
		}

		const connection = amqp.createConnection(options);

		console.log('Connecting to Rabbit MQ', options);

		connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));

		connection.on('error', function(e) {
			console.log('Error connecting to RabbitMQ', { message: e.message });
		});

		connection.on('end', function() {
			console.log('Rabbit MQ connection lost');
		});
	}

	function start(eventEmitter) {
		return new Promise(startUp.bind(undefined, eventEmitter));
	}

	return {
		start: start
	};
};
