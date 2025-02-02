import SerialPortModule from "serialport";

import {
    CommunicationInterface,
    CommunicationInterfaceHost,
    ConnectionErrorCode
} from "instrument/connection/interface";

const CONF_CHUNK_SIZE = 64;

export class SerialInterface implements CommunicationInterface {
    port: any;
    connectedCalled = false;
    data: string | undefined;

    constructor(private host: CommunicationInterfaceHost) {
        this.sendNextChunkCallback = this.sendNextChunkCallback.bind(this);
    }

    connect() {
        try {
            const SerialPort = require("serialport") as typeof SerialPortModule;
            this.port = new SerialPort(
                this.host.connectionParameters.serialParameters.port,
                {
                    baudRate: this.host.connectionParameters.serialParameters.baudRate,
                    rtscts: true
                },
                (err: any) => {
                    if (err) {
                        this.host.setError(ConnectionErrorCode.NONE, err.toString());
                        this.destroy();
                    } else {
                        if (!this.connectedCalled) {
                            this.connectedCalled = true;
                            this.host.connected();
                        }
                    }
                }
            );
        } catch (err) {
            this.host.setError(ConnectionErrorCode.NONE, "Invalid port!");
            this.destroy();
            return;
        }

        this.port.on("open", () => {
            if (!this.connectedCalled) {
                this.connectedCalled = true;
                this.host.connected();
            }
        });

        this.port.on("error", (err: any) => {
            this.host.setError(ConnectionErrorCode.NONE, err.toString());
            this.destroy();
        });

        this.port.on("data", (data: any) => {
            this.host.onData(data.toString("binary"));
        });
    }

    isConnected() {
        return this.port && this.port.isOpen;
    }

    destroy() {
        if (this.port) {
            if (this.port.isOpen) {
                this.port.close();
            }
            this.port = undefined;
        }
        this.host.disconnected();
    }

    sendNextChunkCallback() {
        if (this.port && this.data) {
            let nextChunk;
            if (this.data.length <= CONF_CHUNK_SIZE) {
                nextChunk = this.data;
                this.data = undefined;
            } else {
                nextChunk = this.data.slice(0, CONF_CHUNK_SIZE);
                this.data = this.data.slice(CONF_CHUNK_SIZE);
            }

            this.port.write(nextChunk, "binary");

            if (this.data) {
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    }

    write(data: string) {
        if (this.data) {
            this.data += data;
        } else {
            this.data = data;
            this.port.drain(this.sendNextChunkCallback);
        }
    }

    disconnect() {
        this.destroy();
    }
}
