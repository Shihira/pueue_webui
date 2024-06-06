import React from 'react';
import {
    Button,
    Card,
    CardBody,
} from '@patternfly/react-core';

import { pueueManager } from '../pueue-manager';

const ExampleView = () => {
    return (
        <Card>
            <CardBody>
                <Button onClick={() => pueueManager.pueue('add', {}, ['sleep 5 ; echo Clicked'])}>
                    Click Me!
                </Button>
            </CardBody>
        </Card>
    );
};

export const exportedView = {
    priority: 0,
    view: <ExampleView key='example-view'/>
};
