# Pueue WebUI

A simple WebUI for my favourite CLI tool [pueue](https://github.com/Nukesor/pueue), an easy-to-use workflow management tool dedicated on local machine dispatching.

Given so many process management/workflow dispatching tools out there, pueue is still having several advantages over some big and mature projects:

1. Compared to many others pueue is very LIGHTWEIGHT, without need of a huge bunch of environment setup or containerize
2. Compared to PM2, pueue supports task dependencies so that you can design a resuable task topology
3. Compared to Azkaban and etc., pueue supports Windows (uh-huh!)

The only thing regretful is its lack of a GUI, something useful when one's getting tired to type anything. And that's what this project is trying to solve: it glues some UNIX-ish little tools like websocketd and pueue.

## Getting Started

1. Prerequisitions. Should be easily found in your favourite package manager.
    - Supports Windows, Linux and MacOS as pueue itself does
    - [websocketd](https://github.com/joewalnes/websocketd): the Web UI relies on websocketd to serve static files and call python glue scripts over JSONRPC
    - [pueue and pueued](https://github.com/Nukesor/pueue)
    - Python 3.7+
    - NodeJS 20.0+ and NPM (Required to build from source)
2. Build static files from source
    - Clone the reposity and cd into it
    ```bash
    cd static
    npm install
    npm run build

    cd ..
    pip3 install --user -r requirements.txt
    python3 main.py --port 9092
    ```
3. Access the WebUI at [http://localhost:9092](http://localhost:9092)

## Features

1. Add/kill/remove/restart tasks easily
2. Monitor realtime states of tasks

![](docs/pic1.png)

3. Follow the log changes
4. Edit spawn options of existing tasks

![](docs/pic2.png)

## Disclaimer

The project is still in a very early stage and is extremely unstable. Tests are very coarse, so please aware that you are supposed to be mindful of your own data and system when using this project, and that the author of this project is not responsible for any of your data lost.

## FAQs

## Todos

- [ ] Minimize Static Assets
- [ ] Responsive Adaptation
- [ ] Task Filtering and Sorting
- [ ] Redhat Cockpit Supports
- [ ] Maybe rewrite the Python part into NodeJS?

