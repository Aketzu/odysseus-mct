
// FIXME:  backend-data-source.js and random-data-source.js are largely the same

function BackendTelemetryPlugin(options) {
    const METHOD = "backend"
    
    return function (openmct) {
        const listener = {}
        const previous = {}

        function fetchBackendJson(box) {
            let headers = new Headers()
            if (window.odysseusDictionary.backend.password) {
                headers.append('Authorization', 'Basic ' + btoa(window.odysseusDictionary.backend.username + ':' + window.odysseusDictionary.backend.password))
            }
            return fetch(`${window.odysseusDictionary.backend.url}/engineering/box/${box}`, {headers: headers})
            .then(function(response) {
                return response.json();
            })
    }

        function getNextValue(config, previous) {
            const pollFrequency = config.pollFrequency || 10000
            if (!previous || Date.now() > previous.timestamp + pollFrequency) {
                return fetchBackendJson(config.box)
                .then(function(json) {
                    const value = json.value && json.value[config.field]
                    console.log("Returning " + value + " for box '" + config.box + "'")
                    return {
                        timestamp: Date.now(),
                        value
                    }
                }).catch(error => {
                    console.log("Backend data fetch error", error)
                    return {
                        timestamp: Date.now()
                    }
                })
            } else {
                return {
                    timestamp: previous.timestamp
                }
            }
        }

        setInterval(function () {
            Object.keys(listener).forEach(function (key) {
                const m = findDictionaryMeasurement(key)
                if (m && m.source && m.source.method === METHOD) {
                    const possiblePromise = getNextValue(m.source, previous[key])
                    // Accept both direct value and promises
                    Promise.resolve(possiblePromise).then(obj => {
                        previous[key] = obj
                        if (obj && typeof obj.value !== 'undefined') {
                            const point = {
                                timestamp: Date.now(),
                                value: obj.value,
                                id: key
                            }
                            listener[key](point)
                        }
                    })
                }
             });
        }, 1000)

        var provider = {
            supportsSubscribe: function (domainObject) {
                const m = findDictionaryMeasurement(domainObject.identifier.key)
                return ((domainObject.type === 'odysseus.telemetry') &&
                    m && m.source && m.source.method == METHOD)
            },
            subscribe: function (domainObject, callback) {
                listener[domainObject.identifier.key] = callback;
                return function unsubscribe() {
                    delete listener[domainObject.identifier.key];
                };
            },
            supportsRequest: function (domainObject) {
                return this.supportsSubscribe(domainObject);
            },
            request: function (domainObject, options) {
                // No historical data supported
                return Promise.resolve([])
            }
        };

        openmct.telemetry.addProvider(provider);
    }
}
