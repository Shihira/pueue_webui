#!/usr/bin/env python3

import json
import time
import os
import sys
import subprocess
import watchdog.events
import threading
import pathlib
import platform

from pueue_controller import PueueController, PueueError
from typing import Dict

jsonrpc_methods = {}

log_subscriber: Dict[str, int] = {}

print_lock = threading.Lock()
log_subscriber_lock = threading.Lock()

if platform.system() == "Windows":
    if 'LOCALAPPDATA' in os.environ:
        pueue_path = pathlib.Path(os.environ['LOCALAPPDATA']) / 'pueue'
    else:
        pueue_path = pathlib.Path.home() / 'AppData/Local' / 'pueue'
elif platform.system() == "Darwin":
    pueue_path = pathlib.Path.home() / 'Library/Application Support' / 'pueue'
elif platform.system() == "Linux":
    if 'XDG_DATA_HOME' in os.environ:
        pueue_path = pathlib.Path(os.environ['XDG_DATA_HOME']) / 'pueue'
    else:
        pueue_path = pathlib.Path.home() / '.local/share' / 'pueue'

logs_path = pueue_path / 'task_logs'

def jsonrpc_method(method):
    global jsonrpc_methods
    jsonrpc_methods[method.__name__] = method
    return method

def jsonrpc_response(r):
    if r:
        r['jsonrpc'] = '2.0'
        resp = json.dumps(r, separators=(',', ':'))
        with print_lock:
            print(resp, flush=True)

@jsonrpc_method
def pueue(subcommands, options={}, args=[]):
    if isinstance(subcommands, str):
        subcommands = [subcommands]
    controller = PueueController(['pueue'] + subcommands)
    proc = controller(*args, **options)

    if proc.returncode == 0:
        return proc.result
    else:
        raise PueueError(proc.returncode, proc.stdout + proc.stderr)

@jsonrpc_method
def run_local_command_async(_id, commands):
    def f():
        proc = subprocess.run(commands, capture_output=True, encoding='utf-8', stdin=subprocess.DEVNULL)

        jsonrpc_response({
            'id': _id,
            'result': {
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        })

    t = threading.Thread(target=f)
    t.start()

@jsonrpc_method
def pueue_webui_meta(data=None):
    config_path = pueue_path / 'pueue_webui.json'
    if not config_path.exists():
        config_path.write_text('{}')
    if data is None:
        conf = json.loads(config_path.read_text())
        conf['cwd'] = os.getcwd()
        if 'groups' not in conf:
            conf['groups'] = {}
        return conf
    else:
        config_path.write_text(json.dumps(data))
        return 'Meta stored'

@jsonrpc_method
def pueue_edit(id, kvs):
    import tempfile
    f = tempfile.NamedTemporaryFile(suffix='pueue_webui', delete=False)
    fpath = pathlib.Path(f.name)
    f.close()

    edit_procs = ''

    for k, v in kvs.items():
        if not v:
            continue

        fpath.write_text('import pathlib\nimport sys\npathlib.Path(sys.argv[1]).write_text(%s)' % repr(v))
        edit = PueueController(['pueue', 'edit'])
        proc = edit(id, __controller_env_override={'EDITOR': f'{sys.executable} {fpath}'}, **{k: True})
        if proc.returncode == 0:
            edit_procs += f'{k}: {proc.result}\n'
        else:
            raise PueueError(proc.returncode, proc.stdout + proc.stderr)

    fpath.unlink()

    return edit_procs


class LogUpdatedHandler(watchdog.events.FileSystemEventHandler):
    def __init__(self):
        self.last_call = 0

    def on_any_event(self, event):
        print('log', event, file=sys.stderr)

        path = pathlib.Path(event.src_path)
        if not path.exists():
            return

        subscribed = True
        prev_size = 0
        curr_size = path.stat().st_size

        with log_subscriber_lock:
            subscribed = path.stem in log_subscriber
            if subscribed:
                prev_size = log_subscriber[path.stem]
                log_subscriber[path.stem] = curr_size

        if prev_size > curr_size:
            prev_size = 0

        if subscribed and prev_size != curr_size:
            content = ''
            with path.open('rb') as f:
                f.seek(prev_size)
                bytes = f.read(curr_size - prev_size)
                content = bytes.decode('utf-8', errors='ignore')

            jsonrpc_response({
                'method': 'onLogUpdated',
                'params': [path.stem, prev_size, curr_size, content],
            })

        self.last_call = time.time()

@jsonrpc_method
def pueue_log_subscription(taskId, addOrDel, options):
    path = (logs_path / f'{taskId}.log')

    if addOrDel:
        max_lines = int(options.get('lines', 1000))
        max_bytes = int(options.get('bytes', 500000))

        start_size = 0
        end_size = 0
        content = ''

        if path.exists():
            end_size = path.stat().st_size
            start_size = max(0, end_size - max_bytes)

            with path.open('rb') as f:
                f.seek(start_size)
                bytes = f.read(end_size - start_size)
                content = bytes.decode('utf-8', errors='ignore')
                content = '\n'.join(content.split('\n')[-max_lines:])

        with log_subscriber_lock:
            log_subscriber[taskId] = end_size

        return [path.stem, start_size, end_size, content]
    else:
        with log_subscriber_lock:
            del log_subscriber[taskId]
        return True



class StatusUpdatedHandler(watchdog.events.FileSystemEventHandler):
    def __init__(self):
        self.last_call = 0

    def on_any_event(self, event):
        print('status', event, file=sys.stderr)

        if time.time() - self.last_call < 0.1:
            return

        jsonrpc_response({
            'jsonrpc': '2.0',
            'method': 'onStatusUpdated',
            #'params': [repr(event)],
            'params': [],
        })

        self.last_call = time.time()

def stdio_main():
    observer = None
    import watchdog.observers.polling
    observer = watchdog.observers.polling.PollingObserver()
    #import watchdog.observers
    #observer = watchdog.observers.Observer()

    observer.start()
    observer.schedule(StatusUpdatedHandler(), str(pueue_path), recursive=False)
    observer.schedule(LogUpdatedHandler(), str(logs_path), recursive=False)

    while True:
        request = {}
        try:
            request_str = input()
            #print('<- ' + request_str, file=sys.stderr)
            request = json.loads(request_str)
            method_name = request['method']
            is_async = method_name.endswith('_async')

            result = jsonrpc_methods[method_name](*([request['id']] if is_async else []) + request['params'])

            if is_async:
                continue

            jsonrpc_response({
                'result': result,
                'id': request['id']
            })
        except PueueError as e:
            jsonrpc_response({
                'error': { 'code': 32001, 'message': f'PueueError({e.args[0]})', 'data': str(e.args[1]) },
                'id': request['id'] if 'id' in request else None
            })
        except EOFError:
            break
        except KeyboardInterrupt:
            break
        except Exception as e:
            import traceback
            jsonrpc_response({
                'error': { 'code': 32600, 'message': type(e).__name__, 'data': traceback.format_exc() },
                'id': request['id'] if 'id' in request else None
            })

    observer.stop()

def ws_main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', action='store', default='localhost', type=str)
    parser.add_argument('--port', action='store', default='9092', type=str)
    args = parser.parse_args(sys.argv[1:])

    import shutil

    for exe in ['websocketd', 'pueue']:
        websocketd = shutil.which(exe)
        if not websocketd:
            print(f'pueue_webui requires {exe} that is not found in PATH, you might have to install it with your package manager first.', file=sys.stderr)
            exit(1)

    cwd = os.path.abspath(os.path.dirname(__file__))
    subprocess.run(['websocketd',
                    '--staticdir=' + cwd + '/static',
                    '--port=' + args.port, '--address=' + args.host,
                    '--passenv', ','.join(list(os.environ.keys())),
                    sys.executable, os.path.abspath(__file__), '--stdio'
                    ])

if __name__ == "__main__":
    if '--stdio' in sys.argv:
        stdio_main()
    else:
        ws_main()


