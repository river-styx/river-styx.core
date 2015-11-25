'use strict';
const _ = require('lodash');
const events = require('./events');

const defaultOptions = {
	listeners: []
};

module.exports = function RiverStyxClient(options) {
	_.defaults(options, defaultOptions);

	const listeners = options.listeners.map(listenerConfig => {
		const ListernModule = require(`./listeners/${listenerConfig.type}`);
		const listener = new ListernModule(listenerConfig);

		return listener;
	});

	return {
		start: () => Promise.all(listeners.map(listener => listener.start())),
		stop: () => {
			return new Promise((resolve) => {
				Promise.all(listeners.map(listener => {
					if (listener.stop) {
						listener.stop();
					}
				}));
				events.removeAllListeners();
				resolve();
			});
		},
		on: (type, handler) => {
			events.on('message-received', message => {
				if (message.type !== type) {
					return;
				}

				handler(message);
			});
		}
	};
};
