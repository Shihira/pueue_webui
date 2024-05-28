import json
import time
import os
import sys
import subprocess
import watchdog.observers
import watchdog.events
import threading
import pathlib
import platform

from pueue_controller import PueueController, PueueError

jsonrpc_methods = {}
print_lock = threading.Lock()

def jsonrpc_method(method):
    global jsonrpc_methods
    jsonrpc_methods[method.__name__] = method
    return method

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

        response = json.dumps({
            'jsonrpc': '2.0',
            'id': _id,
            'result': {
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        })

        with print_lock:
            print(response, flush=True)

    t = threading.Thread(target=f)
    t.start()

observer = watchdog.observers.Observer()

class StatusUpdatedHandler(watchdog.events.FileSystemEventHandler):
    def __init__(self):
        self.last_call = 0

    def on_any_event(self, event):
        if time.time() - self.last_call < 0.1:
            return

        response = json.dumps({
            'jsonrpc': '2.0',
            'method': 'onStatusUpdated',
            #'params': [repr(event)],
            'params': [],
        })

        with print_lock:
            print(response, flush=True)

        self.last_call = time.time()

def stdio_main():
    observer.start()
    if platform.system() == "Windows":
        observer.schedule(StatusUpdatedHandler(), str(pathlib.Path.home() / 'AppData/Local/pueue'), recursive=False)
    elif platform.system() == "Darwin":
        observer.schedule(StatusUpdatedHandler(), str(pathlib.Path.home() / 'Library/Application Support/pueue'), recursive=False)

    while True:
        request = {}
        response = None
        try:
            request_str = input()
            #print('<- ' + request_str, file=sys.stderr)
            request = json.loads(request_str)
            method_name = request['method']
            is_async = method_name.endswith('_async')

            result = jsonrpc_methods[method_name](*([request['id']] if is_async else []) + request['params'])

            if is_async:
                continue

            response = json.dumps({
                'jsonrpc': '2.0',
                'result': result,
                'id': request['id']
            }, separators=(',', ':'))
        except PueueError as e:
            response = json.dumps({
                'jsonrpc': '2.0',
                'error': { 'code': 32001, 'message': f'PueueError({e.args[0]})', 'data': str(e.args[1]) },
                'id': request['id'] if id in request else None
            }, separators=(',', ':'))
        except EOFError:
            break
        except KeyboardInterrupt:
            break
        except Exception as e:
            import traceback
            response = json.dumps({
                'jsonrpc': '2.0',
                'error': { 'code': 32600, 'message': type(e).__name__, 'data': traceback.format_exc() },
                'id': request['id'] if id in request else None
            }, separators=(',', ':'))

        #print('-> ' + response, file=sys.stderr)
        with print_lock:
            if response is not None:
                print(response, flush=True)

    observer.stop()


if __name__ == "__main__":
    if '--ws' in sys.argv:
        cwd = os.path.abspath(os.path.dirname(__file__))
        subprocess.run(['websocketd',
                        '--staticdir=' + cwd + '/static',
                        '--port=9092', '--address=localhost',
                        '--passenv', ','.join(list(os.environ.keys())),
                        sys.executable, os.path.abspath(__file__)
                        ])
    else:
        stdio_main()


