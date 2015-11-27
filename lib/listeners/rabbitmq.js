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

	function connect(options) {
		return new Promise((resolve) => {
			const connection = amqp.createConnection(options);

			connection.on('ready', () => {
				if (connected) {
					return;
				}

				connected = true;

				resolve(connection);
			});

			connection.on('error', e => console.log('Error connecting to RabbitMQ', { message: e.message }));

			connection.on('end', () => console.log('Rabbit MQ connection lost'));
		});
	}

	function connectToQueue(connection) {
		return new Promise(resolve => {
			connection.queue(config.queue, { autoDelete: false }, queue => resolve(queue));
		});
	}

	function bindQueueToExchange(queue) {
		return new Promise((resolve) => {
			queue.bind(config.exchange, config.routing);
			resolve(queue);
		});
	}

	function subscribeToQueue(queue) {
		return new Promise(resolve => {
			queue.subscribe({ ack: true }, messageReceived.bind(undefined, queue));
			resolve(queue);
		});
	}

	function startUp() {
		const options = { host: config.host };

		if (config.port) {
			options.port = config.port;
		}

		console.log('Connecting to Rabbit MQ', options);

		return connect(options)
			.then(connectToQueue)
			.then(subscribeToQueue)
			.then(bindQueueToExchange);
	}

	return {
		start: startUp
	};
};
