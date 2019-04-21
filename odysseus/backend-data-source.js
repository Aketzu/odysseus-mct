
function BackendTelemetryPlugin() {
    const METHOD = "backend"

    function fetchBackendField(type, id, field) {
        let headers = new Headers()
        if (window.odysseusDictionary.backend.password) {
            headers.append('Authorization', 'Basic ' + btoa(window.odysseusDictionary.backend.username + ':' + window.odysseusDictionary.backend.password))
        }
        return fetch(`${window.odysseusDictionary.backend.url}/data/${type}/${id}`, {headers: headers})
        .then(response => response.json())
        .then(json => json[field])
    }

    return function (openmct) {
        var provider = {
            supportsSubscribe: function (domainObject) {
                const m = findDictionaryMeasurement(domainObject.identifier.key)
                return ((domainObject.type === 'odysseus.telemetry') &&
                    m && m.source && m.source.method === METHOD)
            },
            subscribe: function (domainObject, callback) {
                const key = domainObject.identifier.key
                const m = findDictionaryMeasurement(key)
                const socket = io(`${window.odysseusDictionary.backend.url}/data?data=/data/${m.source.type}/${m.source.id}`);
                socket.on('dataUpdate', function(type,id,data){
                    const point = {
                        timestamp: Date.now(),
                        value: data[m.source.field],
                        id: key
                    }
                    callback(point)
                })
                return () => {
                    socket.close()
                }
            },
            supportsRequest: function (domainObject) {
                return this.supportsSubscribe(domainObject);
            },
            request: function (domainObject, options) {
                if (options.end > Date.now() - 10000) {
                    // Requesting recent data - mock that a new data point is at current time (fixes various stuff)
                    const key = domainObject.identifier.key
                    const m = findDictionaryMeasurement(key)
                    if (m && m.source && m.source.method === METHOD) {
                        return fetchBackendField(m.source.type, m.source.id, m.source.field)
                        .then(value => {
                            return [{
                                timestamp: Date.now(),
                                value: value,
                                id: key
                            }]
                        })
                    }
                }
                // No historical data supported
                return Promise.resolve([])
            }
        };

        openmct.telemetry.addProvider(provider);
    }
}
