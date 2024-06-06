import React from 'react';
import {
    Button,
    Card,
    CardBody,
} from '@patternfly/react-core';

import { pueueManager } from '../pueue-manager';
import { getContext } from '../utils';

const ExampleView = () => {
    const context = getContext();
    const group = 'example';

    return (
        <Card>
            <CardBody>
                <Button onClick={async () => {
                        await pueueManager.pueue(['group', 'add'], {}, [group]).then((r) => r && context.addAlert);
                        await pueueManager.pueue('parallel', {group}, ['8']).then(context.addAlert);
                        await pueueManager.pueue('clean', {group}, []).then(context.addAlert);

                        const add = (settings : any, cmd : string) =>
                            pueueManager.pueue('add', {
                                    group,
                                    print_task_id: true, // so the command would return an ID instead of a message string
                                    ...settings,
                                }, [cmd]);

                        const task1 = await add({label: 'task1',                      }, 'sleep 2 ; echo task1');
                        const task2 = await add({label: 'task2',                      }, 'sleep 5 ; echo task2');
                        const task3 = await add({label: 'task3', after: [task1, task2]}, 'sleep 6 ; echo task3');
                        const task4 = await add({label: 'task4', after: [task1, task2]}, 'sleep 2 ; echo task4');
                        const task5 = await add({label: 'task5', after: [task3, task4]}, 'sleep 5 ; echo task5');

                        context.addAlert('Tasks added');
                    }}
                >
                    Add Tasks
                </Button>
                {' '}
                <Button onClick={async () => {
                        await pueueManager.pueue('clean', {group}, []).then(context.addAlert);
                        await pueueManager.pueue(['group', 'remove'], {}, [group]).then(context.addAlert);
                    }}
                >
                    Delete Tasks
                </Button>
            </CardBody>
        </Card>
    );
};

export const exportedView = {
    priority: 0,
    view: <ExampleView key='example-view'/>
};
