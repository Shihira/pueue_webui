#!/usr/bin/env python3

import json
import subprocess

class PueueError(Exception):
    pass

class PueueController:
    def __init__(self, commands=['pueue']):
        self.commands = commands
        self.as_json = False
        self.remove_envs = False
        self.remove_trailing_line_feed = True
        self.timeout = None

    def __getattr__(self, subcommand):
        return PueueController(self.commands + [subcommand])

    def __call__(self, *args, **kwargs):
        cmd_args = self.commands[:]

        # controller options defaults
        if 'json' in kwargs and kwargs['json']:
            self.as_json = True
        #if self.commands[-1] == 'status':
        #    self.remove_envs = True

        for _k, a in kwargs.items():
            if _k.startswith('__controller_'):
                setattr(self, _k[len('__controller_'):], a)
                continue

            k = _k.replace('_', '-')
            if isinstance(a, list):
                for sub_a in a:
                    cmd_args += ["--" + k, str(sub_a)]
            elif a is None:
                pass
            elif a is True:
                cmd_args += ["--" + k]
            else:
                cmd_args += ["--" + k, str(a)]

        if args:
            cmd_args += ["--"]
            for a in args:
                cmd_args += [str(a)]

        proc = subprocess.run(cmd_args, capture_output=True, encoding='utf-8', stdin=subprocess.DEVNULL, timeout=self.timeout)

        # post processing
        if proc.returncode == 0:
            result = proc.stdout
            if self.as_json:
                result = json.loads(result)
                if self.remove_envs and 'tasks' in result:
                    for id in result['tasks']:
                        result['tasks'][id]['envs'] = {}
            else:
                if self.remove_trailing_line_feed:
                    if len(result) > 0 and result[-1] == '\n':
                        result = result[:-1]
            proc.result = result

        return proc

