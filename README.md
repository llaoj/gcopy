<p align="center">
  <img alt="GCopy Logo" src="docs/gcopy.png" height="120" />
  <p align="center">Share your clipboard. Text, Screenshot, File are supported.</p>
</p>

---

A clipboard synchronization tool that powered by Golang.

**`Text`, `Screenshot`, `File` are supported** 

This is a tool to synchronize clipboards between different operating systems.

Every second, the Client pushes or pulls clipboard content from Server.

## Simplest usage

If you have two device, they are in the same LAN.

on first device:

```
/path/to/gcopy --role=server,client
```

the other:

```
/path/to/gcopy --role=client --token=<output-token> --server=<server-ip>:3375
```

## Tow usage mode

### server&client <-> clients

This mode requires one device to simultaneously act as both the server and client. These clients must be on the same LAN and should be able to access each other.

![](docs/mode1.png)

Refer to the simplest usage

### clients <-> server <-> clients

In this mode, it is more flexible but requires a minimum of three devices, with one of them serving as the server. Clients do not need to be able to access each other, but it is required that clients can access the server.

![](docs/mode2.png)

server:

```
/path/to/gcopy --role=server
```

on first device:

```
/path/to/gcopy --role=client --token=<output-token> --server=<server-ip>:3375
```

the other:

```
/path/to/gcopy --role=client --token=<output-token> --server=<server-ip>:3375
```

## Read more

- [The work mechanism](docs/mechanism.md)

## Limitations

- Only tested on windows 10 & macOS Monterey 
- It can only synchronize one file at a time

## Community

You have questions, need support and or just want to talk about GCopy?

Here are ways to get in touch with the community:

Email: qustwwy@163.com

Wechat:

<img width="200" src="docs/wechat-lllaoj.png">