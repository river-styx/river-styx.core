var expect = require('expect.js');
var amqpSub = require('./lib/amqp-sub');
var riverStyx = require('../index');

describe('river-styx.core', function() {
	var inputExchange;

	beforeEach(function() {
		var mockAmqpServer = amqpSub.mock({ host: '127.0.0.1', port: 5672 })
		inputExchange = mockAmqpServer.exchange('river-styx');
	});

	afterEach(function() {
		amqpSub.reset();
	});

	function createClient(config, done) {
		var client = new riverStyx.Client(config);

		return {
			startAndPublish: (routingKey, message) => client.start().then(() => inputExchange.publish(routingKey, message)),
			on: client.on,
			stop: () =>  {
				client.stop().then(done.bind(undefined, null));
			}
		}
	}

	describe('on', function() {
		describe('reciept of a rabbit mq message', function() {
			it('executes the attached handler for matching type', function(done) {
				var client = createClient({
						listeners: [
							{
								type: 'rabbitmq',
								exchange: 'river-styx',
								host: '127.0.0.1',
								port: 5672
							}
						]
					}, done);

				client.on('example', () =>  client.stop());

				client.startAndPublish('', '{ "type": "example" }');
			});

			it('does not execute the attached handler for non-matching type', function(done) {
				var called = false;
				var client = createClient({
						listeners: [
							{
								type: 'rabbitmq',
								exchange: 'river-styx',
								host: '127.0.0.1',
								port: 5672
							}
						]
					}, done);

				client.on('different', () => called = true);

				client.startAndPublish('', '{ "type": "example" }');

				setTimeout(() => {
					expect(called).to.eql(false);
					client.stop();
				}, 10);
			});

			it('passes the deserialized object to the handler', function(done) {
				var client = createClient({
						listeners: [
							{
								type: 'rabbitmq',
								exchange: 'river-styx',
								host: '127.0.0.1',
								port: 5672
							}
						]
					}, done);

				client.on('example', message => {
					expect(message).to.eql({ type: "example", a: 1 })

					client.stop()
				});

				client.startAndPublish('', '{ "type": "example", "a": 1 }');
			});
		});
	});
});
