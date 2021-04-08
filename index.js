
const {AsBind} = require("as-bind");

const fs = require("fs");
//const loader = require("@assemblyscript/loader");
const imports = { /* imports go here */ };
//const wasmModule = loader.instantiateSync(fs.readFileSync(__dirname + "/build/optimized.wasm"), imports);

const wasmModule = AsBind.instantiateSync(fs.readFileSync(__dirname + "/build/optimized.wasm"), imports);
module.exports = wasmModule.exports;

// Get our memory object from the exports
const memory = module.exports.memory;
// Create a shared Uint8Array. It can be accessed from both of Wasm and JS.
const wasmByteMemoryArray = new Uint8Array(memory.buffer);

//const countFirstAxisData = require('./index').countFirstAxisData;
const JsonEncoderWasm = require('./index').JsonEncoderWasm;




const SerialPort = require('serialport');
const ByteLength = require('@serialport/parser-byte-length');
let numberOfData = 0;

const port = new SerialPort('/dev/cu.usbserial-0001', {
    baudRate: 9600,
    autoOpen: false
})


const serial_read = function() {
    
    port.open(function (err){
        if (err) {
            return console.log('Error opening port: ', err.message)
        }

        port.write('main screen turn on', function(err) {
            if (err) {
                return console.log('Error on write: ', err.message)
            }
            console.log('message written')
        })
    })

    /*Read 9 length byte data (Data of Axis from KUKA).
    First 4 Bytes are for the number of the axis. 5th Byte is for the sign(positiv, negativ), and the remains are for the axis in degrees.
    */
    //TODO: Check the order of bytes from KUKA (e.g. LITTLE_ENDIAN)
    const parser = port.pipe(new ByteLength({length:9}))

    /*
    * Buffer must be flushed once, because some bytes are already written after opening ports.
    * Auto-open is disabled to set the flush.
    */
    port.on('open', function (){
        port.flush(function (err){
            if(err){
                console.log(err)
            }
        })


        parser.on('data', function (data){
            const dataArray = new Uint8Array(data)
            const jsonData = JsonEncoderWasm(dataArray)

            if(jsonData.length>1){
                mqtt_publish(jsonData)
            }

        })
    })

}


//MQTT
const mqtt = require('mqtt')
const topic = 'KUKA'
const options = {
    clientId:"wasmNode",
    port:1883,
    host:"localhost",
    username:"wasmretrofitting",
    password:"wasmretrofitting",
    reconnectPeriod:1000
}
const client  = mqtt.connect(options);
// https://www.emqx.io/mqtt/public-mqtt5-broker
//const client = mqtt.connect('mqtt://broker.emqx.io');

//Subscribe the broker
client.on('connect', function () {
    client.subscribe(topic, function (err) {
        if (!err) {
            console.log('Connected')
        }
    })
})

//Listening messages from the broker
client.on('message', function (topic, message) {
    // message is Buffer
    console.log(message.toString())
    if(message.toString()==='EndConnection'){
        client.end()
    }
});

//Display Errors
client.on('error', function(err) {
    console.dir(err)
})

const mqtt_publish = function (msg){

    //Check the connection
    if(!client.connected){
        client.reconnect()
    }
    client.publish(topic, 'Test: ')
    client.publish(topic, msg)
}

serial_read()